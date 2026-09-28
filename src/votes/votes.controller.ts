import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';


import { Role } from '../common/types/roles.enum.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { VotesService } from './votes.service.js';
import { VoteDto } from './dto/vote.dto.js';

@Controller('votes')
export class VotesController {
  constructor(private readonly votes: VotesService) {}

  @Post()
  @Roles(Role.USER)
  @HttpCode(HttpStatus.CREATED)
  async cast(@CurrentUser() user: AuthenticatedUser, @Body() input: VoteDto) {
    await this.votes.cast(user.id, input);
    return { success: true, data: null };
  }

  @Delete(':questionId')
  @Roles(Role.USER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('questionId') questionId: string) {
    await this.votes.remove(user.id, questionId);
  }
}
