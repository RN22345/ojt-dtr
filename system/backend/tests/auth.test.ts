import { describe, expect, it } from 'vitest';
import { env, newClient, SEED } from './helpers';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('TC-CI-AUTH-01 login and refresh endpoints (FR-AUTH-01, QR-SE-03)', () => {
  it('TC-CI-AUTH-01 gives tokens for a valid login', async () => {
    const client = newClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: SEED.ojt1.email,
      password: env('SEED_PASSWORD'),
    });
    expect(error).toBeNull();
    expect(data.session?.access_token).toBeTruthy();
    expect(data.session?.refresh_token).toBeTruthy();
    expect(data.user?.id).toBe(SEED.ojt1.id);
  });

  it('TC-CI-AUTH-01 rejects a wrong password', async () => {
    const client = newClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: SEED.ojt1.email,
      password: `${env('SEED_PASSWORD')}-wrong`,
    });
    expect(error).not.toBeNull();
    expect(data.session).toBeNull();
  });

  it('TC-CI-AUTH-01 gives a new token pair on refresh and rejects a used refresh token', async () => {
    const client = newClient();
    const login = await client.auth.signInWithPassword({ email: SEED.ojt1.email, password: env('SEED_PASSWORD') });
    const firstRefresh = login.data.session!.refresh_token;

    const refreshed = await client.auth.refreshSession({ refresh_token: firstRefresh });
    expect(refreshed.error).toBeNull();
    expect(refreshed.data.session?.refresh_token).toBeTruthy();
    expect(refreshed.data.session?.refresh_token).not.toBe(firstRefresh);

    // Supabase Auth accepts a used token for the reuse interval (10 s). After it, reuse must fail.
    await sleep(11_000);
    const reuse = await newClient().auth.refreshSession({ refresh_token: firstRefresh });
    expect(reuse.error).not.toBeNull();
    expect(reuse.data.session).toBeNull();
  });
});
