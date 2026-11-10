// Local test settings (D-72). `ng build --configuration local` replaces `environment.ts` with this file.
// The local Supabase stack runs in Docker (`supabase start` in system/backend). The emulators reach it
// through `adb reverse tcp:54321 tcp:54321`. The key is the fixed publishable key of the local stack. It is public.
import type { AppPlatform } from '../app/core/platform.service';

export const environment = {
  production: false,
  supabaseUrl: 'http://127.0.0.1:54321',
  supabaseKey: 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH',
  platformOverride: null as AppPlatform | null,
  // Test builds: `window.ojtFaults.set({ drop, serverError })` adds network faults (D-20).
  faultInjection: true,
};
