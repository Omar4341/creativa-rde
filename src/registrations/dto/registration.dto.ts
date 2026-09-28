import { IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class PreRegisterDto {
  @IsUUID()
  event_id!: string;
}

export class WalkInDto {
  @IsUUID()
  event_id!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(1) @MaxLength(200)
  guest_name!: string;

  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toLowerCase() : value)
  @IsString() @MaxLength(320)
  guest_email?: string;

  @IsOptional() @IsString() @MaxLength(32)
  guest_phone?: string;

  @IsOptional() @IsIn([true, false])
  force?: boolean;
}
