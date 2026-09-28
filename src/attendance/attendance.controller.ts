import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';


import { Role } from '../common/types/roles.enum.js';
import { PaginationDto, paginationMeta } from '../common/dto/pagination.dto.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { AttendanceService } from './attendance.service.js';
import { CheckInDto, UpdateAttendanceDto } from './dto/attendance.dto.js';

@Controller('attendance')
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('check-in')
  @Roles(Role.ADMIN)
  async checkIn(@CurrentUser() user: AuthenticatedUser, @Body() input: CheckInDto) {
    return { success: true, data: await this.attendance.checkIn(input.qr_token, user.id) };
  }

  @Get('event/:eventId')
  @Roles(Role.ADMIN)
  async eventAttendance(@Param('eventId') eventId: string, @Query() query: PaginationDto & { status?: string }) {
    const page = query.page ?? 1, limit = query.limit ?? 20;
    const { attendance, total } = await this.attendance.eventAttendance(eventId, page, limit, query.status);
    return { success: true, data: { attendance }, meta: paginationMeta(page, limit, total) };
  }

  @Get('my')
  @Roles(Role.USER)
  async my(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: { attendance: await this.attendance.myAttendance(user.id) } };
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() input: UpdateAttendanceDto) {
    return { success: true, data: { attendance: await this.attendance.manualUpdate(id, user.id, input) } };
  }
}
