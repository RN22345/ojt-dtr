// The fault injector of a test build (D-20). The release build replaces this file with `fault-setup.prod.ts`.
import { environment } from '../../../environments/environment';
import { FaultConfig, NO_FAULTS, withFaults } from './fetch-wrapper';

/** The fault rates of a test build (D-20). Device tests set them with `window.ojtFaults.set(...)`. */
let faults: FaultConfig = NO_FAULTS;

/**
 * Gives the fetch function of the Supabase client. A test build adds the fault injector and the
 * `globalThis.ojtFaults` hook. A build with no fault injection gives `base` back.
 */
export function faultFetch(base: typeof fetch): typeof fetch {
  if (!environment.faultInjection) {
    return base;
  }
  (globalThis as { ojtFaults?: unknown }).ojtFaults = {
    set: (config: FaultConfig) => (faults = config),
    get: () => faults,
  };
  return withFaults(base, () => faults);
}
