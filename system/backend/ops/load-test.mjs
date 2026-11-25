// Load test TC-ST-Q-PE-03 (QR-PE-03, QR-PE-07): 20 virtual users for 5 minutes. Each user sends a list
// request, then waits 0.5 s. It uses the seed accounts ojt1, fac1, and admin. It reads only.
// Usage, in system/backend/:  node --env-file=.env ops/load-test.mjs [seconds]   (default 300)
// Pass: p95 800 ms or less, error rate under 1%.
import { createClient } from '@supabase/supabase-js';
const env = process.env;
const DURATION = Number(process.argv[2] ?? 300) * 1000, VUS = 20;
async function login(email) {
  const c = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password: env.SEED_PASSWORD });
  if (error) throw error; return c;
}
const [ojt, fac, adm] = [await login('ojt1@test.local'), await login('fac1@test.local'), await login('admin@test.local')];
const reqs = [
  ['ojt punches', () => ojt.from('punches').select('*').order('device_time', { ascending: false }).limit(50)],
  ['ojt reports', () => ojt.from('weekly_reports').select('*').limit(50)],
  ['ojt notifications', () => ojt.from('notifications').select('*').limit(50)],
  ['fac punches', () => fac.from('punches').select('*').limit(50)],
  ['fac reports', () => fac.from('weekly_reports').select('*').eq('status','submitted').limit(50)],
  ['adm dashboard', () => adm.rpc('admin_dashboard')],
  ['adm audit', () => adm.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50)],
];
const times = [], errs = {}, by = {}; let n = 0;
const end = Date.now() + DURATION;
async function vu() { while (Date.now() < end) { const [name, f] = reqs[n++ % reqs.length]; const t = performance.now(); const r = await f(); const d = performance.now() - t; times.push(d); (by[name] ??= []).push(d); if (r.error) errs[name] = (errs[name] ?? 0) + 1; await new Promise(r => setTimeout(r, 500)); } }
await Promise.all(Array.from({ length: VUS }, vu));
times.sort((a, b) => a - b);
const p = (q) => times[Math.floor(q * (times.length - 1))].toFixed(0);
const e = Object.values(errs).reduce((a, b) => a + b, 0);
for (const [k, v] of Object.entries(by)) { v.sort((a,b)=>a-b); console.log(k, "n", v.length, "p50", v[Math.floor(v.length*0.5)].toFixed(0), "p95", v[Math.floor(0.95*(v.length-1))].toFixed(0)); }
console.log(JSON.stringify({ requests: times.length, p50: p(0.5), p95: p(0.95), p99: p(0.99), max: p(1), errors: e, errorRate: (100 * e / times.length).toFixed(2) + '%', errs }));
