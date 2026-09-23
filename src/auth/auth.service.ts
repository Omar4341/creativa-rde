import { ConflictException, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppConfigService } from '../config/app-config.service.js';
import { DatabaseService } from '../database/database.service.js';
import type { LoginDto } from './dto/login.dto.js';
import type { RegisterDto } from './dto/register.dto.js';
import type { AuthProfile, AuthenticatedUser } from './auth.types.js';

@Injectable()
export class AuthService {
  constructor(private readonly database: DatabaseService, private readonly config: AppConfigService) {}

  async register(input: RegisterDto) {
    const { data, error } = await this.database.client.auth.admin.createUser({
      email: input.email, password: input.password, email_confirm: true,
      user_metadata: { full_name: input.full_name },
    });
    if (error || !data.user) {
      if (error && this.isDuplicateEmail(error)) throw new ConflictException({ code: 'AUTH_EMAIL_ALREADY_REGISTERED', message: 'An account with this email already exists.' });
      throw new InternalServerErrorException({ code: 'AUTH_REGISTRATION_FAILED', message: 'Registration could not be completed.' });
    }
    const { error: profileError } = await this.database.client.from('profiles').insert({
      id: data.user.id, full_name: input.full_name, email: input.email,
      phone: input.phone ?? null, role: 'USER',
    });
    if (profileError) {
      await this.database.client.auth.admin.deleteUser(data.user.id);
      throw new InternalServerErrorException({ code: 'AUTH_PROFILE_CREATION_FAILED', message: 'Registration could not be completed.' });
    }
    const session = await this.signInClient().auth.signInWithPassword({ email: input.email, password: input.password });
    if (session.error || !session.data.session) {
      await this.database.client.from('profiles').delete().eq('id', data.user.id);
      await this.database.client.auth.admin.deleteUser(data.user.id);
      throw new InternalServerErrorException({ code: 'AUTH_SESSION_CREATION_FAILED', message: 'Registration could not be completed.' });
    }
    return { access_token: session.data.session.access_token, refresh_token: session.data.session.refresh_token, profile: await this.getProfile(data.user.id) };
  }

  async login(input: LoginDto) {
    const { data, error } = await this.signInClient().auth.signInWithPassword({ email: input.email, password: input.password });
    if (error || !data.session || !data.user) throw new UnauthorizedException({ code: 'AUTH_INVALID_CREDENTIALS', message: 'Email or password is incorrect.' });
    return { access_token: data.session.access_token, refresh_token: data.session.refresh_token, profile: await this.getProfile(data.user.id) };
  }

  async validateAccessToken(token: string): Promise<AuthenticatedUser> {
    const { data, error } = await this.database.client.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException({ code: 'AUTH_TOKEN_INVALID', message: 'The access token is invalid or expired.' });
    return { id: data.user.id, profile: await this.getProfile(data.user.id) };
  }

  async logout(token: string): Promise<void> {
    const { error } = await this.database.client.auth.admin.signOut(token, 'local');
    if (error) throw new UnauthorizedException({ code: 'AUTH_TOKEN_INVALID', message: 'The access token is invalid or expired.' });
  }

  private async getProfile(id: string): Promise<AuthProfile> {
    const { data, error } = await this.database.client.from('profiles').select('*').eq('id', id).maybeSingle();
    if (error || !data || !data.is_active) throw new UnauthorizedException({ code: 'AUTH_PROFILE_UNAVAILABLE', message: 'The authenticated profile is unavailable.' });
    return data as AuthProfile;
  }

  private signInClient(): SupabaseClient {
    return createClient(this.config.supabaseUrl, this.config.supabaseAnonKey, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
  }

  private isDuplicateEmail(error: { code?: string; status?: number; message?: string }): boolean {
    return error.code === 'email_exists' || /already registered|already exists/i.test(error.message ?? '');
  }
}
