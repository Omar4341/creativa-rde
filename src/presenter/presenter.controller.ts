import { Controller, Get, Param } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator.js';


import { Role } from '../common/types/roles.enum.js';
import { PresenterService } from './presenter.service.js';

@Controller('presenter')
export class PresenterController {
  constructor(private readonly presenter: PresenterService) {}

  @Get('event/:eventId/current')
  @Roles(Role.PRESENTER, Role.ADMIN)
  async current(@Param('eventId') eventId: string) {
    return { success: true, data: await this.presenter.getCurrentState(eventId) };
  }
}
