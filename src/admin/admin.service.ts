import {
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { EventsService } from '../events/events.service.js';
import { QuestionsService } from '../questions/questions.service.js';

export interface QnaSession {
  id: string; event_id: string; is_active: boolean;
  current_question_id: string | null; updated_at: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DatabaseService,
    private readonly events: EventsService,
    private readonly questions: QuestionsService,
  ) {}

  private async getOrCreateSession(eventId: string): Promise<QnaSession> {
    const { data } = await this.db.client
      .from('qna_sessions').select('*').eq('event_id', eventId).maybeSingle();
    if (data) return data as QnaSession;
    const { data: created, error } = await this.db.client
      .from('qna_sessions').insert({ event_id: eventId, is_active: false }).select('*').maybeSingle();
    if (error || !created) throw new UnprocessableEntityException({ code: 'QNA_SESSION_NOT_FOUND', message: 'Q&A session could not be created.' });
    return created as QnaSession;
  }

  async activateQna(eventId: string): Promise<QnaSession> {
    await this.events.getById(eventId, true);
    const session = await this.getOrCreateSession(eventId);
    const { data, error } = await this.db.client
      .from('qna_sessions')
      .update({ is_active: true, updated_at: new Date().toISOString() })
      .eq('id', session.id)
      .select('*')
      .maybeSingle();
    if (error || !data) throw new UnprocessableEntityException({ code: 'QNA_SESSION_ALREADY_ACTIVE', message: 'Q&A session could not be activated.' });
    return data as QnaSession;
  }

  async deactivateQna(eventId: string): Promise<QnaSession> {
    const session = await this.getOrCreateSession(eventId);
    const { data, error } = await this.db.client
      .from('qna_sessions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', session.id)
      .select('*')
      .maybeSingle();
    if (error || !data) throw new UnprocessableEntityException({ code: 'QNA_SESSION_NOT_ACTIVE', message: 'Q&A session could not be deactivated.' });
    return data as QnaSession;
  }

  /**
   * Present a question. Realtime broadcasts the qna_sessions UPDATE;
   * the presenter screen then refetches via GET /presenter/event/:id/current.
   */
  async presentQuestion(eventId: string, questionId: string): Promise<QnaSession> {
    const session = await this.getOrCreateSession(eventId);
    if (!session.is_active) {
      throw new UnprocessableEntityException({ code: 'QNA_SESSION_NOT_ACTIVE', message: 'The Q&A session must be active to present questions.' });
    }
    const question = await this.questions.getById(questionId);
    if (question.event_id !== eventId) {
      throw new UnprocessableEntityException({ code: 'QUESTION_CANNOT_PRESENT', message: 'This question does not belong to this event.' });
    }
    if (question.status !== 'QUEUED' && question.status !== 'DISPLAYED') {
      throw new UnprocessableEntityException({ code: 'QUESTION_CANNOT_PRESENT', message: 'Only queued questions can be presented.' });
    }

    // DB composite FK (event_id, current_question_id) enforces same-event integrity
    const { data, error } = await this.db.client
      .from('qna_sessions')
      .update({ current_question_id: questionId, updated_at: new Date().toISOString() })
      .eq('id', session.id)
      .select('*')
      .maybeSingle();
    if (error || !data) throw new UnprocessableEntityException({ code: 'QUESTION_CANNOT_PRESENT', message: 'Question could not be presented.' });

    await this.db.client
      .from('questions')
      .update({ status: 'DISPLAYED', updated_at: new Date().toISOString() })
      .eq('id', questionId);

    return data as QnaSession;
  }

  async clearPresented(eventId: string): Promise<QnaSession> {
    const session = await this.getOrCreateSession(eventId);
    const { data, error } = await this.db.client
      .from('qna_sessions')
      .update({ current_question_id: null, updated_at: new Date().toISOString() })
      .eq('id', session.id)
      .select('*')
      .maybeSingle();
    if (error || !data) throw new UnprocessableEntityException({ code: 'QNA_SESSION_NOT_FOUND', message: 'Presented question could not be cleared.' });
    return data as QnaSession;
  }

  // ── Presenter assignments ────────────────────────────────────────────────
  async assignPresenter(eventId: string, presenterId: string, adminId: string): Promise<Record<string, unknown>> {
    await this.events.getById(eventId, true);
    const { data: profile } = await this.db.client
      .from('profiles').select('id, role').eq('id', presenterId).maybeSingle();
    if (!profile) throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'Presenter not found.' });
    if (profile.role !== 'PRESENTER') {
      throw new UnprocessableEntityException({ code: 'USER_NOT_FOUND', message: 'This user does not have the PRESENTER role.' });
    }

    // Reactivate if a revoked assignment exists; otherwise insert
    const { data: existing } = await this.db.client
      .from('presenter_assignments').select('*')
      .eq('event_id', eventId).eq('presenter_id', presenterId).maybeSingle();

    if (existing) {
      const { data, error } = await this.db.client
        .from('presenter_assignments')
        .update({ is_active: true, assigned_by: adminId, updated_at: new Date().toISOString() })
        .eq('id', (existing as { id: string }).id)
        .select('*')
        .maybeSingle();
      if (error || !data) throw new UnprocessableEntityException({ code: 'USER_NOT_FOUND', message: 'Assignment could not be created.' });
      return data;
    }

    const { data, error } = await this.db.client
      .from('presenter_assignments')
      .insert({ event_id: eventId, presenter_id: presenterId, assigned_by: adminId })
      .select('*')
      .maybeSingle();
    if (error || !data) throw new UnprocessableEntityException({ code: 'USER_NOT_FOUND', message: 'Assignment could not be created.' });
    return data;
  }

  async revokePresenter(eventId: string, presenterId: string): Promise<void> {
    const { error } = await this.db.client
      .from('presenter_assignments')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('event_id', eventId)
      .eq('presenter_id', presenterId);
    if (error) throw new UnprocessableEntityException({ code: 'USER_NOT_FOUND', message: 'Assignment could not be revoked.' });
  }

  async listAssignments(eventId: string): Promise<Record<string, unknown>[]> {
    const { data, error } = await this.db.client
      .from('presenter_assignments')
      .select('*, profiles!presenter_assignments_presenter_id_fkey(id, full_name, email)')
      .eq('event_id', eventId);
    if (error) throw new NotFoundException({ code: 'EVENT_NOT_FOUND', message: 'Assignments could not be listed.' });
    return (data ?? []) as unknown as Record<string, unknown>[];
  }

  // ── Dashboard (Phase 11) ─────────────────────────────────────────────────
  async dashboard(eventId: string): Promise<Record<string, unknown>> {
    const event = await this.events.getById(eventId, true);
    const stats = await this.events.getStats(eventId);
    const questions = await this.questions.rankedQuestions(eventId);

    const { data: qnaSession } = await this.db.client
      .from('qna_sessions').select('is_active, current_question_id').eq('event_id', eventId).maybeSingle();

    return {
      event,
      stats: { ...stats, qna_active: qnaSession?.is_active ?? false },
      questions_ranked: questions,
    };
  }
}
