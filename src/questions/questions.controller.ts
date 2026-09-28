import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { IsIn } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';


import { Role } from '../common/types/roles.enum.js';
import { PaginationDto, paginationMeta } from '../common/dto/pagination.dto.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { QuestionsService } from './questions.service.js';
import { CreateQuestionDto } from './dto/question.dto.js';

class UpdateQuestionStatusDto {
  @IsIn(['QUEUED', 'DISPLAYED', 'ANSWERED', 'ARCHIVED', 'HIDDEN'])
  status!: 'QUEUED' | 'DISPLAYED' | 'ANSWERED' | 'ARCHIVED' | 'HIDDEN';
}

@Controller('questions')
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Post()
  @Roles(Role.USER)
  async submit(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateQuestionDto) {
    return { success: true, data: { question: await this.questions.submit(user.id, input) } };
  }

  @Get('event/:eventId/active')
  @Roles(Role.USER, Role.ADMIN)
  async active(@CurrentUser() user: AuthenticatedUser, @Param('eventId') eventId: string, @Query() query: PaginationDto) {
    const page = query.page ?? 1, limit = query.limit ?? 20;
    const { questions, total } = await this.questions.activeQuestions(eventId, { id: user.id, role: user.profile.role }, page, limit);
    return { success: true, data: { questions }, meta: paginationMeta(page, limit, total) };
  }

  @Get('event/:eventId/ranked')
  @Roles(Role.ADMIN)
  async ranked(@Param('eventId') eventId: string) {
    return { success: true, data: { questions: await this.questions.rankedQuestions(eventId) } };
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  async updateStatus(@Param('id') id: string, @Body() input: UpdateQuestionStatusDto) {
    return { success: true, data: { question: await this.questions.updateStatus(id, input.status) } };
  }
}
