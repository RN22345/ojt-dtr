// Login, session restore, and logout (FR-AUTH-01 to FR-AUTH-03, FR-AUTH-05).
import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthError } from '@supabase/supabase-js';
import { Profile, ProfileRepository } from '../../data/repositories/profile.repository';
import { PlatformService } from '../platform.service';
import { SUPABASE } from '../supabase.client';
import { Role, homePath, roleAllowedOn } from './access';

export type SignInFailure =
  | 'invalid-credentials'
  | 'rate-limited'
  | 'network'
  | 'wrong-platform'
  | 'inactive'
  | 'unknown';

export type SignInResult = { ok: true; home: string } | { ok: false; reason: SignInFailure };

/** Maps a Supabase Auth error to a cause that the login page can show (QR-IC-04). */
export function signInFailureOf(error: AuthError): SignInFailure {
  if (error.status === 429) {
    return 'rate-limited';
  }
  if (error.status === 400 || error.code === 'invalid_credentials') {
    return 'invalid-credentials';
  }
  if (!error.status || error.name === 'AuthRetryableFetchError') {
    return 'network';
  }
  return 'unknown';
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase = inject(SUPABASE);
  private readonly profiles = inject(ProfileRepository);
  private readonly platform = inject(PlatformService).platform;

  private readonly profileState = signal<Profile | null>(null);
  readonly profile = this.profileState.asReadonly();
  readonly role = computed<Role | null>(() => this.profileState()?.role ?? null);

  private restoreTask: Promise<void> | null = null;

  /** Completes when the stored session is examined. Guards wait for it. */
  ready(): Promise<void> {
    this.restoreTask ??= this.restore();
    return this.restoreTask;
  }

  async signIn(email: string, password: string): Promise<SignInResult> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) {
      return { ok: false, reason: error ? signInFailureOf(error) : 'unknown' };
    }

    let profile: Profile | null;
    try {
      profile = await this.profiles.fetchById(data.user.id);
    } catch {
      // The login worked, but the profile did not load. Do not keep a session without a role.
      await this.endSession();
      return { ok: false, reason: 'network' };
    }

    if (!profile || profile.status !== 'active') {
      await this.endSession();
      return { ok: false, reason: 'inactive' };
    }
    // D-38: the client enforces the platform restriction. Sign out at once and keep no data.
    if (!roleAllowedOn(profile.role, this.platform)) {
      await this.endSession();
      return { ok: false, reason: 'wrong-platform' };
    }

    this.profileState.set(profile);
    return { ok: true, home: homePath(profile.role) };
  }

  /** FR-AUTH-05. S2 adds the CAUTION with the count of unsynced changes (QR-SF-01). */
  async signOut(): Promise<void> {
    await this.endSession();
  }

  private async endSession(): Promise<void> {
    this.profileState.set(null);
    // supabase-js removes the local session also when the server call fails (offline sign-out, QR-SE-03).
    await this.supabase.auth.signOut();
  }

  private async restore(): Promise<void> {
    const { data } = await this.supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) {
      return;
    }
    try {
      const profile = await this.profiles.fetchById(userId);
      if (profile && profile.status === 'active' && roleAllowedOn(profile.role, this.platform)) {
        this.profileState.set(profile);
      } else {
        await this.endSession();
      }
    } catch {
      // Network or server error: keep the session (frontend rule 12, QR-RE-08).
      // S2: read the profile from the local database here, so that the app opens offline (FR-AUTH-04).
    }
  }
}
