// The release build has no fault injector (D-20, TC-ST-Q-SE-02).
// The production configuration replaces `fault-setup.ts` with this file (angular.json).

/** Gives the fetch function of the Supabase client. The release build adds no faults. */
export function faultFetch(base: typeof fetch): typeof fetch {
  return base;
}
