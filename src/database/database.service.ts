import { Injectable } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppConfigService } from '../config/app-config.service.js';

/**
 * Backend-only Supabase client. The service-role key bypasses RLS and must
 * never be exposed to frontend code or returned by an API endpoint.
 */
@Injectable()
export class DatabaseService {
  readonly client: SupabaseClient;

  constructor(config: AppConfigService) {
    this.client = createClient(
      config.supabaseUrl,
      config.supabaseServiceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );
  }
}
