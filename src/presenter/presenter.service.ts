import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';

export interface PresenterState {
  session: { is_active: boolean; updated_at: string | null };
  current_question: { id: string; content: string; created_at: string } | null;
}

/**
 * Read-only presenter state. The database is the source of truth;
 * Realtime only notifies — the presenter always refetches via this service.
 */
@Injectable()
export class PresenterService {
  constructor(private readonly db: DatabaseService) {}

  async getCurrentState(eventId: string): Promise<PresenterState> {
    const { data: event } = await this.db.client
      .from('events').select('id').eq('id', eventId).maybeSingle();
    if (!event) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Event not found.' });

    const { data: session } = await this.db.client
      .from('qna_sessions')
      .select('is_active, updated_at, current_question_id')
      .eq('event_id', eventId)
      .maybeSingle();

    if (!session) {
      return { session: { is_active: false, updated_at: null }, current_question: null };
    }

    if (!session.current_question_id) {
      return { session: { is_active: session.is_active, updated_at: session.updated_at }, current_question: null };
    }

    const { data: question } = await this.db.client
      .from('questions')
      .select('id, content, created_at')
      .eq('id', session.current_question_id)
      .maybeSingle();

    return {
      session: { is_active: session.is_active, updated_at: session.updated_at },
      current_question: question as { id: string; content: string; created_at: string } | null,
    };
  }
}
