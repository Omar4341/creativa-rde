import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';


import { Role } from '../common/types/roles.enum.js';
import { PaginationDto, paginationMeta } from '../common/dto/pagination.dto.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { RegistrationsService } from './registrations.service.js';
import { PreRegisterDto, WalkInDto } from './dto/registration.dto.js';
import { Body } from '@nestjs/common';

@Controller('registrations')
export class RegistrationsController {
  constructor(private readonly registrations: RegistrationsService) {}

  @Post('pre-register')
  @Roles(Role.USER)
  async preRegister(@CurrentUser() user: AuthenticatedUser, @Body() input: PreRegisterDto) {
    return { success: true, data: { registration: await this.registrations.preRegister(user.id, input.event_id) } };
  }

  @Post('walk-in')
  @Roles(Role.ADMIN)
  async walkIn(@CurrentUser() user: AuthenticatedUser, @Body() input: WalkInDto) {
    return { success: true, data: await this.registrations.walkIn(user.id, input) };
  }

  @Get('my')
  @Roles(Role.USER)
  async my(@CurrentUser() user: AuthenticatedUser, @Query() query: PaginationDto) {
    const page = query.page ?? 1, limit = query.limit ?? 20;
    const { registrations, total } = await this.registrations.myRegistrations(user.id, page, limit);
    return { success: true, data: { registrations }, meta: paginationMeta(page, limit, total) };
  }

  @Get('event/:eventId')
  @Roles(Role.ADMIN)
  async eventRegistrations(@Param('eventId') eventId: string, @Query() query: PaginationDto & { type?: string; status?: string }) {
    const page = query.page ?? 1, limit = query.limit ?? 20;
    const { registrations, total } = await this.registrations.eventRegistrations(eventId, page, limit, query.type, query.status);
    return { success: true, data: { registrations }, meta: paginationMeta(page, limit, total) };
  }

  @Delete(':id')
  @Roles(Role.USER, Role.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    await this.registrations.cancel(id, user.id, user.profile.role === 'ADMIN');
  }

  @Get(':id/qr')
  @Roles(Role.USER)
  async getQr(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return { success: true, data: await this.registrations.getQr(id, user.id) };
  }
}
