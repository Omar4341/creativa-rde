import { IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CheckInDto {
  @IsString() @MinLength(1)
  qr_token!: string;
}

export class UpdateAttendanceDto {
  @IsIn(['PENDING', 'PRESENT', 'ABSENT', 'NO_SHOW'])
  status!: 'PENDING' | 'PRESENT' | 'ABSENT' | 'NO_SHOW';

  @IsOptional() @IsString() @MaxLength(1000)
  notes?: string;
}
