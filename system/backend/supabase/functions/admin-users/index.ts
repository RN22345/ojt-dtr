// Edge Function admin-users (D-70, point 1; FR-AUTH-07).
// Request: POST with JSON { action, ... }. Only an active admin can call it.
// Actions: create, update, deactivate, activate, reset_password.
// Success: HTTP 200 with JSON. Error: HTTP 4xx or 5xx with JSON { error: '<code>' }.
//
// The function uses two clients:
// - The service client (service role key from the function environment) for Auth user changes.
// - The caller client (JWT of the calling admin) for changes to `profiles`.
//   Thus the audit trigger records the calling admin as the actor (FR-AUD-01).
//   The creation of a user is the one exception: the database trigger on auth.users
//   makes the profile row, so the actor of that audit entry is empty.
import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const ROLES = ['ojt', 'facilitator', 'admin'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTACT = /^[0-9+() -]{0,20}$/;

class Fail extends Error {
  constructor(public code: string, public status = 400) {
    super(code);
  }
}

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function text(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined;
}

function checkName(v: unknown): string {
  const s = text(v)?.trim();
  if (!s || s.length > 200) throw new Fail('invalid_full_name');
  return s;
}

function checkContact(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || !CONTACT.test(v)) throw new Fail('invalid_contact_no');
  return v;
}

function checkRole(v: unknown): string {
  if (typeof v !== 'string' || !ROLES.includes(v)) throw new Fail('invalid_role');
  return v;
}

function checkPassword(v: unknown): string {
  if (typeof v !== 'string' || v.length < 8 || v.length > 72) throw new Fail('weak_password');
  return v;
}

function checkUserId(v: unknown): string {
  if (typeof v !== 'string' || !UUID.test(v)) throw new Fail('invalid_user_id');
  return v;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const authHeader = req.headers.get('Authorization') ?? '';
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    // 1. The caller must be an active admin.
    const jwt = authHeader.replace(/^Bearer\s+/i, '');
    const { data: who, error: whoError } = await caller.auth.getUser(jwt);
    if (whoError || !who.user) throw new Fail('forbidden', 403);
    const me = who.user.id;
    const { data: mine } = await caller
      .from('profiles')
      .select('role, status, deleted_at')
      .eq('id', me)
      .maybeSingle();
    if (!mine || mine.role !== 'admin' || mine.status !== 'active' || mine.deleted_at) {
      throw new Fail('forbidden', 403);
    }

    // 2. The request body.
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      throw new Fail('invalid_json');
    }
    if (!body || typeof body !== 'object') throw new Fail('invalid_json');

    switch (body.action) {
      case 'create': {
        const email = text(body.email)?.trim().toLowerCase() ?? '';
        if (!EMAIL.test(email) || email.length > 254) throw new Fail('invalid_email');
        const password = checkPassword(body.password);
        const fullName = checkName(body.full_name);
        const role = checkRole(body.role);
        const contact = checkContact(body.contact_no);
        const { data, error } = await service.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          app_metadata: { role },
          user_metadata: { full_name: fullName },
        });
        if (error || !data.user) {
          if (error?.code === 'email_exists' || /already|registered|exists/i.test(error?.message ?? '')) {
            throw new Fail('email_taken');
          }
          if (error?.code === 'weak_password') throw new Fail('weak_password');
          throw new Fail('create_failed', 500);
        }
        // The database trigger makes the profile before the role is in app_metadata. Thus the trigger
        // gives the status 'inactive'. Set the role, the status, and the contact number as the admin.
        const { error: upError } = await caller
          .from('profiles')
          .update({ role, status: 'active', contact_no: contact })
          .eq('id', data.user.id);
        if (upError) throw new Fail('profile_update_failed', 500);
        return reply(200, { user_id: data.user.id });
      }

      case 'update': {
        const userId = checkUserId(body.user_id);
        const changes: Record<string, unknown> = {};
        if (body.full_name !== undefined) changes.full_name = checkName(body.full_name);
        if (body.contact_no !== undefined) changes.contact_no = checkContact(body.contact_no);
        if (body.role !== undefined) changes.role = checkRole(body.role);
        if (Object.keys(changes).length === 0) throw new Fail('no_changes');
        if (changes.role !== undefined && userId === me) throw new Fail('self_role_change');
        const { data, error } = await caller.from('profiles').update(changes).eq('id', userId).select('id');
        if (error) throw new Fail('profile_update_failed', 500);
        if (!data || data.length === 0) throw new Fail('not_found', 404);
        if (changes.role !== undefined) {
          const { error: metaError } = await service.auth.admin.updateUserById(userId, {
            app_metadata: { role: changes.role },
          });
          if (metaError) throw new Fail('auth_update_failed', 500);
        }
        return reply(200, { ok: true });
      }

      case 'deactivate':
      case 'activate': {
        const userId = checkUserId(body.user_id);
        const off = body.action === 'deactivate';
        if (off && userId === me) throw new Fail('self_deactivate');
        const { data, error } = await caller
          .from('profiles')
          .update({ status: off ? 'inactive' : 'active' })
          .eq('id', userId)
          .select('id');
        if (error) throw new Fail('profile_update_failed', 500);
        if (!data || data.length === 0) throw new Fail('not_found', 404);
        const { error: banError } = await service.auth.admin.updateUserById(userId, {
          ban_duration: off ? '876000h' : 'none',
        });
        if (banError) throw new Fail('auth_update_failed', 500);
        return reply(200, { ok: true });
      }

      case 'reset_password': {
        const userId = checkUserId(body.user_id);
        const password = checkPassword(body.password);
        const { data: found } = await caller.from('profiles').select('id').eq('id', userId).maybeSingle();
        if (!found) throw new Fail('not_found', 404);
        const { error } = await service.auth.admin.updateUserById(userId, { password });
        if (error) {
          if (error.code === 'weak_password') throw new Fail('weak_password');
          throw new Fail('auth_update_failed', 500);
        }
        return reply(200, { ok: true });
      }

      default:
        throw new Fail('unknown_action');
    }
  } catch (e) {
    if (e instanceof Fail) return reply(e.status, { error: e.code });
    console.error('admin-users', e);
    return reply(500, { error: 'internal_error' });
  }
});
