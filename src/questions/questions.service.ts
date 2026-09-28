import { ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import type { CreateQuestionDto } from './dto/question.dto.js';

export interface QuestionRecord {
  id: string; event_id: string; asked_by: string; content: string;
  status: string; vote_count: number; is_anonymous: boolean;
  created_at: string; updated_at: string;
}

@Injectable()
export class QuestionsService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Q&A eligibility (MVP, non-configurable):
   * USER must have a CONFIRMED registration AND PRESENT attendance for the event.
   * Throws 403 QUESTION_NOT_ELIGIBLE on failure.
   */
  async assertEligibility(userId: string, eventId: string): Promise<void> {
    const { data: reg } = await this.db.client
      .from('registrations')
      .select('id, status')
      .eq('event_id', eventId)
      .eq('user_id', userId)
      .maybeSingle();

    if (!reg || reg.status !== 'CONFIRMED') {
      throw new ForbiddenException({ code: 'QUESTION_NOT_ELIGIBLE', message: 'You must have a confirmed registration for this event.' });
    }

    const { data: att } = await this.db.client
      .from('attendance')
      .select('status')
      .eq('registration_id', reg.id)
      .maybeSingle();

    if (!att || att.status !== 'PRESENT') {
      throw new ForbiddenException({ code: 'QUESTION_NOT_ELIGIBLE', message: 'You must be checked in to participate in Q&A.' });
    }
  }

  async assertSessionActive(eventId: string): Promise<void> {
    const { data } = await this.db.client
      .from('qna_sessions')
      .select('is_active')
      .eq('event_id', eventId)
      .maybeSingle();
    if (!data?.is_active) {
      throw new UnprocessableEntityException({ code: 'QUESTION_SESSION_INACTIVE', message: 'The Q&A session is not active.' });
    }
  }

  async submit(userId: string, input: CreateQuestionDto): Promise<QuestionRecord> {
    await this.assertEligibility(userId, input.event_id);
    await this.assertSessionActive(input.event_id);

    const { data, error } = await this.db.client
      .from('questions')
      .insert({ event_id: input.event_id, asked_by: userId, content: input.content, is_anonymous: input.is_anonymous ?? false })
      .select('*')
      .maybeSingle();
    if (error || !data) {
      throw new UnprocessableEntityException({ code: 'QUESTION_NOT_FOUND', message: 'Question could not be submitted.' });
    }
    // Strip asked_by from the response — anonymity is enforced at API level
    const { asked_by: _askedBy, ...safe } = data as QuestionRecord;
    return safe as QuestionRecord;
  }

  /**
   * User-facing active questions. No asked_by identity — enforced regardless of is_anonymous.
   * USER requires confirmed registration; ADMIN always has access.
   */
  async activeQuestions(eventId: string, requester: { id: string; role: string }, page: number, limit: number): Promise<{ questions: Record<string, unknown>[]; total: number }> {
    if (requester.role === 'USER') {
      const { data: reg } = await this.db.client
        .from('registrations').select('id, status')
        .eq('event_id', eventId).eq('user_id', requester.id).maybeSingle();
      if (!reg || reg.status !== 'CONFIRMED') {
        throw new ForbiddenException({ code: 'QUESTION_NOT_ELIGIBLE', message: 'You must have a confirmed registration for this event.' });
      }
    }

    const from = (page - 1) * limit;
    const { data, error, count } = await this.db.client
      .from('questions')
      .select('id, event_id, content, status, vote_count, is_anonymous, created_at', { count: 'exact' })
      .eq('event_id', eventId)
      .in('status', ['QUEUED', 'DISPLAYED'])
      .order('vote_count', { ascending: false })
      .order('created_at', { ascending: true })
      .range(from, from + limit - 1);
    if (error) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND', message: 'Questions could not be listed.' });

    // Per-user vote state
    const ids = (data ?? []).map((q: { id: string }) => q.id);
    let votedIds = new Set<string>();
    if (ids.length > 0 && requester.role === 'USER') {
      const { data: votes } = await this.db.client
        .from('question_votes').select('question_id')
        .eq('user_id', requester.id).in('question_id', ids);
      votedIds = new Set((votes ?? []).map((v: { question_id: string }) => v.question_id));
    }

    return {
      questions: (data ?? []).map((q: Record<string, unknown> & { id: string }) => ({
        ...q,
        user_has_voted: votedIds.has(q.id),
      })),
      total: count ?? 0,
    };
  }

  /** ADMIN: full ranked list with all statuses and asker identity. */
  async rankedQuestions(eventId: string): Promise<QuestionRecord[]> {
    const { data, error } = await this.db.client
      .from('questions')
      .select('*, profiles(full_name, email)')
      .eq('event_id', eventId)
      .order('vote_count', { ascending: false })
      .order('created_at', { ascending: true });
    if (error) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND', message: 'Questions could not be listed.' });
    return (data ?? []) as unknown as QuestionRecord[];
  }

  async updateStatus(questionId: string, status: string): Promise<QuestionRecord> {
    const allowed = ['QUEUED', 'DISPLAYED', 'ANSWERED', 'ARCHIVED', 'HIDDEN'];
    if (!allowed.includes(status)) {
      throw new UnprocessableEntityException({ code: 'QUESTION_INVALID_STATUS_TRANSITION', message: 'Invalid question status.' });
    }
    const { data, error } = await this.db.client
      .from('questions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', questionId)
      .select('*')
      .maybeSingle();
    if (error || !data) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND', message: 'Question not found.' });
    return data as QuestionRecord;
  }

  async getById(questionId: string): Promise<QuestionRecord> {
    const { data, error } = await this.db.client
      .from('questions').select('*').eq('id', questionId).maybeSingle();
    if (error || !data) throw new NotFoundException({ code: 'QUESTION_NOT_FOUND', message: 'Question not found.' });
    return data as QuestionRecord;
  }
}
