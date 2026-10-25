// Profile repository: the only path to profile data (frontend rule 3).
// S1: it reads the server. S2: on mobile it reads the local database first (FR-AUTH-04).
import { Injectable, inject } from '@angular/core';
import { Role, isRole } from '../../core/auth/access';
import { SUPABASE } from '../../core/supabase.client';

export interface Profile {
  id: string;
  role: Role;
  fullName: string;
  status: 'active' | 'inactive';
}

interface ProfileRow {
  id: string;
  role: string;
  full_name: string;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileRepository {
  private readonly supabase = inject(SUPABASE);

  /** Gives the profile, or null if RLS does not show it. Throws on a network or server error. */
  async fetchById(id: string): Promise<Profile | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('id, role, full_name, status')
      .eq('id', id)
      .maybeSingle<ProfileRow>();
    if (error) {
      throw error;
    }
    if (!data || !isRole(data.role)) {
      return null;
    }
    return {
      id: data.id,
      role: data.role,
      fullName: data.full_name,
      status: data.status === 'active' ? 'active' : 'inactive',
    };
  }
}
