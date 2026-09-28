import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { QrService } from '../qr/qr.service.js';
import type { CheckInDto, UpdateAttendanceDto } from './dto/attendance.dto.js';

export interface AttendanceRecord {
  id: string; registration_id: string; status: string;
  checked_in_at: string | null; checked_in_by: string | null;
  notes: string | null; created_at: string; updated_at: string;
}

@Injectable()
export class AttendanceService {
  constructor(private readonly db: DatabaseService, private readonly qr: QrService) {}

  /**
   * QR check-in. The backend is the ONLY verifier.
   * Flow: verify signature/expiry → match jti against stored qr_token (rejects stale codes)
   * → confirm registration status → reject double check-in → mark PRESENT.
   */
  async checkIn(qrToken: string, adminId: string): Promise<{ attendance: AttendanceRecord; registration: Record<string, unknown> }> {
    const { registrationId, jti } = this.qr.verify(qrToken);

    const { data: reg, error: regErr } = await this.db.client
      .from('registrations').select('*').eq('id', registrationId).maybeSingle();
    if (regErr || !reg) throw new BadRequestException({ code: 'ATTENDANCE_QR_INVALID', message: 'This QR code is invalid.' });

    // Reject stale tokens: jti must match the latest issued token for this registration
    if (reg.qr_token && reg.qr_token !== jti) {
      throw new BadRequestException({ code: 'ATTENDANCE_QR_INVALID', message: 'This QR code is no longer valid. A newer one was issued.' });
    }

    if (reg.status !== 'CONFIRMED') {
      throw new UnprocessableEntityException({ code: 'ATTENDANCE_REGISTRATION_NOT_CONFIRMED', message: 'This registration is not confirmed.' });
    }

    const { data: attendance, error: attErr } = await this.db.client
      .from('attendance').select('*').eq('registration_id', registrationId).maybeSingle();
    if (attErr || !attendance) {
      throw new NotFoundException({ code: 'ATTENDANCE_NOT_FOUND', message: 'Attendance record not found.' });
    }
    if (attendance.status === 'PRESENT') {
      throw new ConflictException({ code: 'ATTENDANCE_ALREADY_CHECKED_IN', message: 'This attendee has already been checked in.' });
    }

    const { data: updated, error: updErr } = await this.db.client
      .from('attendance')
      .update({ status: 'PRESENT', checked_in_at: new Date().toISOString(), checked_in_by: adminId, updated_at: new Date().toISOString() })
      .eq('id', attendance.id)
      .select('*')
      .maybeSingle();
    if (updErr || !updated) throw new UnprocessableEntityException({ code: 'ATTENDANCE_NOT_FOUND', message: 'Check-in could not be completed.' });

    return { attendance: updated as AttendanceRecord, registration: reg };
  }

  async eventAttendance(eventId: string, page: number, limit: number, status?: string): Promise<{ attendance: AttendanceRecord[]; total: number }> {
    let query = this.db.client
      .from('attendance')
      .select('*, registrations!inner(id, event_id, type, user_id, guest_name, guest_email)', { count: 'exact' })
      .eq('registrations.event_id', eventId);
    if (status) query = query.eq('status', status);
    const from = (page - 1) * limit;
    const { data, error, count } = await query.order('created_at', { ascending: false }).range(from, from + limit - 1);
    if (error) throw new NotFoundException({ code: 'ATTENDANCE_NOT_FOUND', message: 'Attendance could not be listed.' });
    return { attendance: (data ?? []) as unknown as AttendanceRecord[], total: count ?? 0 };
  }

  async myAttendance(userId: string): Promise<AttendanceRecord[]> {
    const { data, error } = await this.db.client
      .from('attendance')
      .select('*, registrations!inner(id, event_id, user_id, events(title, starts_at))')
      .eq('registrations.user_id', userId);
    if (error) throw new NotFoundException({ code: 'ATTENDANCE_NOT_FOUND', message: 'Attendance could not be listed.' });
    return (data ?? []) as unknown as AttendanceRecord[];
  }

  async manualUpdate(attendanceId: string, adminId: string, input: UpdateAttendanceDto): Promise<AttendanceRecord> {
    const { data: existing } = await this.db.client
      .from('attendance').select('*').eq('id', attendanceId).maybeSingle();
    if (!existing) throw new NotFoundException({ code: 'ATTENDANCE_NOT_FOUND', message: 'Attendance record not found.' });

    // PRESENT cannot be undone; ABSENT → PRESENT is the only manual override into PRESENT
    if (existing.status === 'PRESENT' && input.status !== 'PRESENT') {
      throw new UnprocessableEntityException({ code: 'ATTENDANCE_NOT_FOUND', message: 'A completed check-in cannot be undone.' });
    }

    const patch: Record<string, unknown> = { status: input.status, updated_at: new Date().toISOString() };
    if (input.status === 'PRESENT') {
      patch.checked_in_at = new Date().toISOString();
      patch.checked_in_by = adminId;
    }
    if (input.notes !== undefined) patch.notes = input.notes;

    const { data, error } = await this.db.client
      .from('attendance').update(patch).eq('id', attendanceId).select('*').maybeSingle();
    if (error || !data) throw new UnprocessableEntityException({ code: 'ATTENDANCE_NOT_FOUND', message: 'Attendance could not be updated.' });
    return data as AttendanceRecord;
  }
}
