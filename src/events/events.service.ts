import { ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { CreateEventDto, UpdateEventDto } from './dto/event.dto.js';

export interface EventRecord {
  id: string; title: string; description: string | null; location: string | null;
  starts_at: string; ends_at: string; registration_deadline: string | null;
  capacity: number; status: string; banner_url: string | null; created_by: string;
  created_at: string; updated_at: string;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PUBLISHED', 'CANCELLED'],
  PUBLISHED: ['ONGOING', 'CANCELLED'],
  ONGOING: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
};

@Injectable()
export class EventsService {
  constructor(private readonly db: DatabaseService) {}

  async list(page: number, limit: number, status?: string, search?: string): Promise<{ events: EventRecord[]; total: number }> {
    let query = this.db.client.from('events').select('*', { count: 'exact' });
    // Public listing excludes DRAFT; status filter further narrows
    if (status) query = query.eq('status', status);
    else query = query.neq('status', 'DRAFT');
    if (search) query = query.ilike('title', `%${search}%`);
    query = query.order('starts_at', { ascending: false });
    const from = (page - 1) * limit;
    const { data, error, count } = await query.range(from, from + limit - 1);
    if (error) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Events could not be listed.' });
    return { events: (data ?? []) as EventRecord[], total: count ?? 0 };
  }

  async listAll(page: number, limit: number): Promise<{ events: EventRecord[]; total: number }> {
    const from = (page - 1) * limit;
    const { data, error, count } = await this.db.client
      .from('events').select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, from + limit - 1);
    if (error) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Events could not be listed.' });
    return { events: (data ?? []) as EventRecord[], total: count ?? 0 };
  }

  async getById(id: string, includeDraft = false): Promise<EventRecord> {
    const { data, error } = await this.db.client.from('events').select('*').eq('id', id).maybeSingle();
    if (error || !data) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    const event = data as EventRecord;
    if (!includeDraft && event.status === 'DRAFT') {
      throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    }
    return event;
  }

  async create(input: CreateEventDto, createdBy: string): Promise<EventRecord> {
    const { data, error } = await this.db.client
      .from('events')
      .insert({ ...input, created_by: createdBy })
      .select('*')
      .maybeSingle();
    if (error || !data) throw new UnprocessableEntityException({ code: 'EVENT_NOT_AVAILABLE', message: 'Event could not be created.' });
    return data as EventRecord;
  }

  async update(id: string, input: UpdateEventDto): Promise<EventRecord> {
    const event = await this.getById(id, true);
    if (event.status !== 'DRAFT' && event.status !== 'PUBLISHED') {
      throw new ForbiddenException({ code: 'EVENT_CANNOT_EDIT', message: 'This event can no longer be edited.' });
    }
    const { data, error } = await this.db.client
      .from('events')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error || !data) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    return data as EventRecord;
  }

  async updateStatus(id: string, status: string): Promise<EventRecord> {
    const event = await this.getById(id, true);
    const allowed = VALID_TRANSITIONS[event.status] ?? [];
    if (!allowed.includes(status)) {
      throw new UnprocessableEntityException({ code: 'EVENT_INVALID_TRANSITION', message: `Cannot change status from ${event.status} to ${status}.` });
    }
    const { data, error } = await this.db.client
      .from('events')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error || !data) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found.' });
    return data as EventRecord;
  }

  async remove(id: string): Promise<void> {
    const event = await this.getById(id, true);
    if (event.status !== 'DRAFT') {
      throw new UnprocessableEntityException({ code: 'EVENT_CANNOT_DELETE', message: 'Only draft events can be deleted.' });
    }
    const { error } = await this.db.client.from('events').delete().eq('id', id);
    if (error) throw new UnprocessableEntityException({ code: 'EVENT_CANNOT_DELETE', message: 'Event could not be deleted.' });
  }

  async getStats(id: string): Promise<Record<string, number>> {
    const event = await this.getById(id, true);
    const { count: confirmed } = await this.db.client
      .from('registrations').select('*', { count: 'exact', head: true })
      .eq('event_id', id).eq('status', 'CONFIRMED');
    const { count: present } = await this.db.client
      .from('attendance').select('*, registrations!inner(event_id)', { count: 'exact', head: true })
      .eq('registrations.event_id', id).eq('status', 'PRESENT');
    const { count: questions } = await this.db.client
      .from('questions').select('*', { count: 'exact', head: true })
      .eq('event_id', id);
    return {
      capacity: event.capacity,
      confirmed_count: confirmed ?? 0,
      present_count: present ?? 0,
      questions_count: questions ?? 0,
      available_seats: Math.max(event.capacity - (confirmed ?? 0), 0),
    };
  }
}
