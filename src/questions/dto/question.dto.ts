import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateQuestionDto {
  @IsUUID()
  event_id!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(5) @MaxLength(500)
  content!: string;

  @IsOptional() @IsBoolean()
  is_anonymous?: boolean;
}

export class VoteDto {
  @IsUUID()
  question_id!: string;
}
