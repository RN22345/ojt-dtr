// The one Supabase client of the app (frontend rule 11).
// Pages and components must not use it. They use a repository or a core service (frontend rule 3).
import { InjectionToken, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { authStorageFor } from './auth/token-storage';
import { faultFetch } from './http/fault-setup';
import { withTimeout } from './http/fetch-wrapper';
import { PlatformService } from './platform.service';

function clientFetch(): typeof fetch {
  return faultFetch(withTimeout(fetch.bind(globalThis)));
}

export const SUPABASE = new InjectionToken<SupabaseClient>('SUPABASE', {
  providedIn: 'root',
  factory: () =>
    createClient(environment.supabaseUrl, environment.supabaseKey, {
      auth: {
        storage: authStorageFor(inject(PlatformService).platform),
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
      global: { fetch: clientFetch() },
    }),
});
