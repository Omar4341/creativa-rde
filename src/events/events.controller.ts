import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../common/types/roles.enum.js';
import { PaginationDto, paginationMeta } from '../common/dto/pagination.dto.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { EventsService } from './events.service.js';
import { CreateEventDto, UpdateEventDto, UpdateEventStatusDto } from './dto/event.dto.js';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  // ── Public: browse published events ──────────────────────────────────────
  @Public()
  @Get()
  async list(@Query() query: PaginationDto & { status?: string; search?: string }) {
    const page = query.page ?? 1, limit = query.limit ?? 20;
    const { events, total } = await this.events.list(page, limit, query.status, query.search);
    return { success: true, data: { events }, meta: paginationMeta(page, limit, total) };
  }

  @Public()
  @Get(':id')
  async getById(@Param('id') id: string) {
    return { success: true, data: { event: await this.events.getById(id) } };
  }

  // ── ADMIN: full CRUD ─────────────────────────────────────────────────────
  @Get('admin/all')
  @Roles(Role.ADMIN)
  async listAll(@Query() query: PaginationDto) {
    const page = query.page ?? 1, limit = query.limit ?? 20;
    const { events, total } = await this.events.listAll(page, limit);
    return { success: true, data: { events }, meta: paginationMeta(page, limit, total) };
  }

  @Post()
  @Roles(Role.ADMIN)
  async create(@CurrentUser() user: AuthenticatedUser, @Body() input: CreateEventDto) {
    return { success: true, data: { event: await this.events.create(input, user.id) } };
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  async update(@Param('id') id: string, @Body() input: UpdateEventDto) {
    return { success: true, data: { event: await this.events.update(id, input) } };
  }

  @Patch(':id/status')
  @Roles(Role.ADMIN)
  async updateStatus(@Param('id') id: string, @Body() input: UpdateEventStatusDto) {
    return { success: true, data: { event: await this.events.updateStatus(id, input.status) } };
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async remove(@Param('id') id: string) {
    await this.events.remove(id);
    return { success: true, data: null };
  }

  @Get('admin/:id/stats')
  @Roles(Role.ADMIN)
  async stats(@Param('id') id: string) {
    return { success: true, data: { stats: await this.events.getStats(id) } };
  }
}
