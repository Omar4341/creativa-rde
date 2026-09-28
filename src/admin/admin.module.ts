import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';
import { EventsModule } from '../events/events.module.js';
import { QuestionsModule } from '../questions/questions.module.js';



@Module({
  imports: [EventsModule, QuestionsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
