import { Module } from '@nestjs/common';
import { VotesController } from './votes.controller.js';
import { VotesService } from './votes.service.js';
import { QuestionsModule } from '../questions/questions.module.js';



@Module({
  imports: [QuestionsModule],
  controllers: [VotesController],
  providers: [VotesService],
})
export class VotesModule {}
