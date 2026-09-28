import { IsIn, IsInt, IsISO8601, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreateEventDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString() @MinLength(3) @MaxLength(200)
  title!: string;

  @IsOptional() @IsString() @MaxLength(5000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(300)
  location?: string;

  @IsISO8601()
  starts_at!: string;

  @IsISO8601()
  ends_at!: string;

  @IsOptional() @IsISO8601()
  registration_deadline?: string;

  @Type(() => Number) @IsInt() @Min(1) @Max(100000)
  capacity!: number;

  @IsOptional() @IsString() @MaxLength(2048)
  banner_url?: string;
}

export class UpdateEventDto {
  @IsOptional() @IsString() @MinLength(3) @MaxLength(200)
  title?: string;

  @IsOptional() @IsString() @MaxLength(5000)
  description?: string;

  @IsOptional() @IsString() @MaxLength(300)
  location?: string;

  @IsOptional() @IsISO8601()
  starts_at?: string;

  @IsOptional() @IsISO8601()
  ends_at?: string;

  @IsOptional() @IsISO8601()
  registration_deadline?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000)
  capacity?: number;

  @IsOptional() @IsString() @MaxLength(2048)
  banner_url?: string;
}

export class UpdateEventStatusDto {
  @IsIn(['DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED', 'CANCELLED'])
  status!: 'DRAFT' | 'PUBLISHED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';
}
