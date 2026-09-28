import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Role } from '../common/types/roles.enum.js';
import { PaginationDto, paginationMeta } from '../common/dto/pagination.dto.js';
import type { AuthenticatedUser } from '../auth/auth.types.js';
import { UsersService } from './users.service.js';
import { UpdateProfileDto } from './dto/update-profile.dto.js';
import { IsIn, IsString } from 'class-validator';

class UpdateRoleDto {
  @IsString() @IsIn(['USER', 'ADMIN', 'PRESENTER'])
  role!: 'USER' | 'ADMIN' | 'PRESENTER';
}

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('profile')
  profile(@CurrentUser() user: AuthenticatedUser) {
    return { success: true, data: { profile: user.profile } };
  }

  @Patch('profile')
  async updateProfile(@CurrentUser() user: AuthenticatedUser, @Body() input: UpdateProfileDto) {
    return { success: true, data: { profile: await this.users.updateProfile(user.id, input) } };
  }

  @Get()
  @Roles(Role.ADMIN)
  async list(@Query() query: PaginationDto & { role?: string }) {
    const page = query.page ?? 1, limit = query.limit ?? 20;
    const { users, total } = await this.users.listUsers(page, limit, query.role);
    return { success: true, data: { users }, meta: paginationMeta(page, limit, total) };
  }

  @Patch(':id/role')
  @Roles(Role.ADMIN)
  async assignRole(@Param('id') id: string, @Body() input: UpdateRoleDto) {
    return { success: true, data: { profile: await this.users.assignRole(id, input.role) } };
  }
}
