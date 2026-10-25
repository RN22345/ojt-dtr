// The one Supabase client of the app (frontend rule 11).
// Pages and components must not use it. They use a repository or a core service (frontend rule 3).
import { InjectionToken, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../environments/environment';
import { authStorageFor } from './auth/token-storage';
import { PlatformService } from './platform.service';

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
      // S2: test builds give the fault injector fetch here (D-20).
    }),
});
