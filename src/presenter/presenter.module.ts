import { Module } from '@nestjs/common';
import { PresenterController } from './presenter.controller.js';
import { PresenterService } from './presenter.service.js';



@Module({
  controllers: [PresenterController],
  providers: [PresenterService],
})
export class PresenterModule {}
