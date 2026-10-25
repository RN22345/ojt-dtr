// Storage for the Supabase session (QR-SE-03, frontend rule 8, D-42).
// Mobile: the secure storage plugin (Android Keystore, iOS Keychain).
// Web (admin): sessionStorage. The tab close removes the tokens. Never localStorage.
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import type { AppPlatform } from '../platform.service';

/** The storage interface that supabase-js uses (`auth.storage`). */
export interface AuthStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export class SecureAuthStorage implements AuthStorage {
  getItem(key: string): Promise<string | null> {
    return SecureStorage.getItem(key);
  }
  setItem(key: string, value: string): Promise<void> {
    return SecureStorage.setItem(key, value);
  }
  removeItem(key: string): Promise<void> {
    return SecureStorage.removeItem(key);
  }
}

export class SessionAuthStorage implements AuthStorage {
  async getItem(key: string): Promise<string | null> {
    return window.sessionStorage.getItem(key);
  }
  async setItem(key: string, value: string): Promise<void> {
    window.sessionStorage.setItem(key, value);
  }
  async removeItem(key: string): Promise<void> {
    window.sessionStorage.removeItem(key);
  }
}

export function authStorageFor(platform: AppPlatform): AuthStorage {
  return platform === 'mobile' ? new SecureAuthStorage() : new SessionAuthStorage();
}
