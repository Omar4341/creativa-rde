import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service.js';
import { QuestionsService } from '../questions/questions.service.js';
import type { VoteDto } from './dto/vote.dto.js';

@Injectable()
export class VotesService {
  constructor(private readonly db: DatabaseService, private readonly questions: QuestionsService) {}

  async cast(userId: string, input: VoteDto): Promise<void> {
    const question = await this.questions.getById(input.question_id);

    // Eligibility: confirmed registration + PRESENT attendance for the question's event
    await this.questions.assertEligibility(userId, question.event_id);
    await this.questions.assertSessionActive(question.event_id);

    if (question.status !== 'QUEUED') {
      throw new UnprocessableEntityException({ code: 'VOTE_QUESTION_CLOSED', message: 'This question is no longer open for voting.' });
    }

    const { error } = await this.db.client
      .from('question_votes')
      .insert({ question_id: input.question_id, user_id: userId });
    if (error) {
      if (error.message.includes('unique_user_question_vote') || error.message.includes('duplicate key')) {
        throw new ConflictException({ code: 'VOTE_ALREADY_VOTED', message: 'You have already voted for this question.' });
      }
      throw new UnprocessableEntityException({ code: 'VOTE_QUESTION_CLOSED', message: 'Vote could not be cast.' });
    }
  }

  async remove(userId: string, questionId: string): Promise<void> {
    const question = await this.questions.getById(questionId);
    await this.questions.assertEligibility(userId, question.event_id);

    const { error, count } = await this.db.client
      .from('question_votes')
      .delete({ count: 'exact' })
      .eq('question_id', questionId)
      .eq('user_id', userId);
    if (error) throw new UnprocessableEntityException({ code: 'VOTE_NOT_FOUND', message: 'Vote could not be removed.' });
    if ((count ?? 0) === 0) throw new NotFoundException({ code: 'VOTE_NOT_FOUND', message: 'You have not voted for this question.' });
  }
}
