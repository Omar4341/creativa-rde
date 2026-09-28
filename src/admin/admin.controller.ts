import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { IsUUID } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';


import { Role } from '../common/types/roles.enum.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AdminService } from './admin.service.js';

class AssignPresenterDto {
  @IsUUID()
  presenter_id!: string;
}

@Controller('admin')
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  // ── Q&A control ───────────────────────────────────────────────────────────
  @Post('qna/:eventId/activate')
  async activateQna(@Param('eventId') eventId: string) {
    return { success: true, data: { qna_session: await this.admin.activateQna(eventId) } };
  }

  @Post('qna/:eventId/deactivate')
  async deactivateQna(@Param('eventId') eventId: string) {
    return { success: true, data: { qna_session: await this.admin.deactivateQna(eventId) } };
  }

  @Post('qna/:eventId/present/:questionId')
  async presentQuestion(@Param('eventId') eventId: string, @Param('questionId') questionId: string) {
    return { success: true, data: { qna_session: await this.admin.presentQuestion(eventId, questionId) } };
  }

  @Post('qna/:eventId/clear')
  async clearPresented(@Param('eventId') eventId: string) {
    return { success: true, data: { qna_session: await this.admin.clearPresented(eventId) } };
  }

  // ── Presenter assignments ──────────────────────────────────────────────────
  @Post('events/:eventId/presenter-assignments')
  async assignPresenter(@CurrentUser() user: AuthenticatedUser, @Param('eventId') eventId: string, @Body() input: AssignPresenterDto) {
    return { success: true, data: { assignment: await this.admin.assignPresenter(eventId, input.presenter_id, user.id) } };
  }

  @Delete('events/:eventId/presenter-assignments/:presenterId')
  async revokePresenter(@Param('eventId') eventId: string, @Param('presenterId') presenterId: string) {
    await this.admin.revokePresenter(eventId, presenterId);
    return { success: true, data: null };
  }

  @Get('events/:eventId/presenter-assignments')
  async listAssignments(@Param('eventId') eventId: string) {
    return { success: true, data: { assignments: await this.admin.listAssignments(eventId) } };
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  @Get('events/:eventId/dashboard')
  async dashboard(@Param('eventId') eventId: string) {
    return { success: true, data: await this.admin.dashboard(eventId) };
  }
}
