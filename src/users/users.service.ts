import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { AuthProfile } from '../auth/auth.types.js';
import type { UpdateProfileDto } from './dto/update-profile.dto.js';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  async getProfile(id: string): Promise<AuthProfile> {
    const { data, error } = await this.db.client.from('profiles').select('*').eq('id', id).maybeSingle();
    if (error || !data) throw new NotFoundException({ code: 'USER_PROFILE_NOT_FOUND', message: 'Profile not found.' });
    return data as AuthProfile;
  }

  async updateProfile(id: string, input: UpdateProfileDto): Promise<AuthProfile> {
    const { data, error } = await this.db.client
      .from('profiles')
      .update({ full_name: input.full_name, phone: input.phone, avatar_url: input.avatar_url, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error || !data) throw new NotFoundException({ code: 'USER_PROFILE_NOT_FOUND', message: 'Profile not found.' });
    return data as AuthProfile;
  }

  async listUsers(page: number, limit: number, role?: string): Promise<{ users: AuthProfile[]; total: number }> {
    let query = this.db.client.from('profiles').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    if (role) query = query.eq('role', role);
    const from = (page - 1) * limit;
    const { data, error, count } = await query.range(from, from + limit - 1);
    if (error) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Users could not be listed.' });
    return { users: (data ?? []) as AuthProfile[], total: count ?? 0 };
  }

  async assignRole(userId: string, role: string): Promise<AuthProfile> {
    const { data, error } = await this.db.client
      .from('profiles')
      .update({ role, updated_at: new Date().toISOString() })
      .eq('id', userId)
      .select('*')
      .maybeSingle();
    if (error || !data) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'User not found.' });
    return data as AuthProfile;
  }
}
