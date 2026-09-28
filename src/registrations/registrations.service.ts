import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { QrService } from '../qr/qr.service.js';
import type { WalkInDto } from './dto/registration.dto.js';

export interface RegistrationRecord {
  id: string; event_id: string; user_id: string | null;
  guest_name: string | null; guest_email: string | null; guest_phone: string | null;
  type: string; status: string;
  qr_token: string | null; qr_expires_at: string | null;
  registered_by: string | null; created_at: string; updated_at: string;
}

const RPC_ERROR_CODES = new Set([
  'EVENT_NOT_FOUND',
  'REGISTRATION_EVENT_NOT_AVAILABLE',
  'REGISTRATION_DEADLINE_PASSED',
  'REGISTRATION_EVENT_FULL',
]);

@Injectable()
export class RegistrationsService {
  constructor(private readonly db: DatabaseService, private readonly qr: QrService) {}

  /** Maps supabase RPC/DB errors to the approved error envelope. */
  private mapError(error: { message?: string; code?: string }, fallbackCode: string): never {
    const msg = error.message ?? '';
    if (RPC_ERROR_CODES.has(msg)) {
      if (msg === 'EVENT_NOT_FOUND') throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found.' });
      throw new UnprocessableEntityException({ code: msg, message: this.describe(msg) });
    }
    if (msg.includes('unique_user_event') || msg.includes('duplicate key')) {
      throw new ConflictException({ code: 'REGISTRATION_ALREADY_EXISTS', message: 'You are already registered for this event.' });
    }
    throw new UnprocessableEntityException({ code: fallbackCode, message: 'Registration could not be completed.' });
  }

  private describe(code: string): string {
    switch (code) {
      case 'REGISTRATION_EVENT_FULL': return 'This event has reached its maximum capacity.';
      case 'REGISTRATION_DEADLINE_PASSED': return 'The registration deadline for this event has passed.';
      case 'REGISTRATION_EVENT_NOT_AVAILABLE': return 'This event is not open for registration.';
      default: return 'Registration could not be completed.';
    }
  }

  async preRegister(userId: string, eventId: string): Promise<RegistrationRecord> {
    const { data, error } = await this.db.client.rpc('register_with_capacity', {
      p_event_id: eventId,
      p_user_id: userId,
      p_type: 'PRE_REGISTERED',
    });
    if (error || !data) this.mapError(error ?? {}, 'REGISTRATION_EVENT_NOT_AVAILABLE');
    return data as unknown as RegistrationRecord;
  }

  async walkIn(adminId: string, input: WalkInDto): Promise<{ registration: RegistrationRecord; warning?: { code: string; message: string; existing?: RegistrationRecord } }> {
    if (!input.force) {
      // Soft duplicate check on guest_email / guest_phone within the same event
      if (input.guest_email) {
        const { data: emailDup } = await this.db.client
          .from('registrations')
          .select('*')
          .eq('event_id', input.event_id)
          .eq('guest_email', input.guest_email)
          .neq('status', 'CANCELLED')
          .maybeSingle();
        if (emailDup) {
          throw new ConflictException({
            code: 'WALK_IN_POSSIBLE_DUPLICATE',
            message: 'A registration with this email already exists for this event. Pass force: true to override.',
            details: [{ existing_registration: { id: emailDup.id, guest_name: emailDup.guest_name, guest_email: emailDup.guest_email } }],
          });
        }
      }
      if (input.guest_phone) {
        const { data: phoneDup } = await this.db.client
          .from('registrations')
          .select('*')
          .eq('event_id', input.event_id)
          .eq('guest_phone', input.guest_phone)
          .neq('status', 'CANCELLED')
          .maybeSingle();
        if (phoneDup) {
          throw new ConflictException({
            code: 'WALK_IN_POSSIBLE_DUPLICATE',
            message: 'A registration with this phone already exists for this event. Pass force: true to override.',
            details: [{ existing_registration: { id: phoneDup.id, guest_name: phoneDup.guest_name, guest_phone: phoneDup.guest_phone } }],
          });
        }
      }
      // Informational: guest has an existing account
      if (input.guest_email) {
        const { data: profile } = await this.db.client
          .from('profiles').select('id').eq('email', input.guest_email).maybeSingle();
        if (profile) {
          // Proceed, but include the warning in the response
          const reg = await this.createWalkIn(adminId, input);
          return {
            registration: reg,
            warning: { code: 'WALK_IN_USER_HAS_ACCOUNT', message: 'This guest already has an account in the system.' },
          };
        }
      }
    }
    return { registration: await this.createWalkIn(adminId, input) };
  }

  private async createWalkIn(adminId: string, input: WalkInDto): Promise<RegistrationRecord> {
    const { data, error } = await this.db.client.rpc('register_with_capacity', {
      p_event_id: input.event_id,
      p_user_id: null,
      p_type: 'WALK_IN',
      p_guest_name: input.guest_name,
      p_guest_email: input.guest_email ?? null,
      p_guest_phone: input.guest_phone ?? null,
      p_registered_by: adminId,
    });
    if (error || !data) this.mapError(error ?? {}, 'REGISTRATION_EVENT_NOT_AVAILABLE');
    return data as unknown as RegistrationRecord;
  }

  async myRegistrations(userId: string, page: number, limit: number): Promise<{ registrations: RegistrationRecord[]; total: number }> {
    const from = (page - 1) * limit;
    const { data, error, count } = await this.db.client
      .from('registrations')
      .select('*, events(title, starts_at, ends_at, location, status)', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);
    if (error) throw new NotFoundException({ code: 'REGISTRATION_NOT_FOUND', message: 'Registrations could not be listed.' });
    return { registrations: (data ?? []) as unknown as RegistrationRecord[], total: count ?? 0 };
  }

  async eventRegistrations(eventId: string, page: number, limit: number, type?: string, status?: string): Promise<{ registrations: RegistrationRecord[]; total: number }> {
    let query = this.db.client.from('registrations').select('*', { count: 'exact' }).eq('event_id', eventId);
    if (type) query = query.eq('type', type);
    if (status) query = query.eq('status', status);
    const from = (page - 1) * limit;
    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + limit - 1);
    if (error) throw new NotFoundException({ code: 'REGISTRATION_NOT_FOUND', message: 'Registrations could not be listed.' });
    return { registrations: (data ?? []) as RegistrationRecord[], total: count ?? 0 };
  }

  async getById(id: string): Promise<RegistrationRecord> {
    const { data, error } = await this.db.client.from('registrations').select('*').eq('id', id).maybeSingle();
    if (error || !data) throw new NotFoundException({ code: 'REGISTRATION_NOT_FOUND', message: 'Registration not found.' });
    return data as RegistrationRecord;
  }

  async cancel(id: string, requesterId: string, isAdmin: boolean): Promise<void> {
    const reg = await this.getById(id);
    if (!isAdmin && reg.user_id !== requesterId) {
      throw new ForbiddenException({ code: 'AUTH_INSUFFICIENT_ROLE', message: 'You can only cancel your own registration.' });
    }
    if (reg.status === 'CANCELLED') {
      throw new UnprocessableEntityException({ code: 'REGISTRATION_CANNOT_CANCEL', message: 'This registration is already cancelled.' });
    }
    const { error } = await this.db.client
      .from('registrations')
      .update({ status: 'CANCELLED', updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new UnprocessableEntityException({ code: 'REGISTRATION_CANNOT_CANCEL', message: 'Registration could not be cancelled.' });
  }

  /**
   * Returns the signed QR JWT for the user's registration.
   * Generates on first call; the jti is stored in registrations.qr_token.
   */
  async getQr(registrationId: string, requesterId: string): Promise<{ qr_token: string; qr_expires_at: string }> {
    const reg = await this.getById(registrationId);
    if (reg.user_id !== requesterId) {
      throw new ForbiddenException({ code: 'AUTH_INSUFFICIENT_ROLE', message: 'You can only access your own registration.' });
    }
    if (reg.status !== 'CONFIRMED') {
      throw new UnprocessableEntityException({ code: 'REGISTRATION_NOT_FOUND', message: 'QR is only available for confirmed registrations.' });
    }

    // Always sign a fresh token; storing the jti invalidates previously issued QR codes.
    const { token, jti, expiresAt } = this.qr.sign(reg.id);
    const { error } = await this.db.client
      .from('registrations')
      .update({ qr_token: jti, qr_expires_at: expiresAt.toISOString(), updated_at: new Date().toISOString() })
      .eq('id', reg.id);
    if (error) throw new UnprocessableEntityException({ code: 'REGISTRATION_NOT_FOUND', message: 'QR could not be generated.' });
    return { qr_token: token, qr_expires_at: expiresAt.toISOString() };
  }

  private extractJti(token: string): string {
    const parts = token.split('.');
    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8')) as { jti?: string };
    return payload.jti ?? '';
  }
}
