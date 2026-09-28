import { IsUUID } from 'class-validator';

export class VoteDto {
  @IsUUID()
  question_id!: string;
}
