import { Body, Controller, Get, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import type { AuthenticatedUser } from './auth.types.js';
import { AuthService } from './auth.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}
  @Public()
  @Post('register')
  async register(@Body() input: RegisterDto) { return { success: true, data: await this.auth.register(input) }; }
  @Public()
  @Post('login')
  async login(@Body() input: LoginDto) { return { success: true, data: await this.auth.login(input) }; }
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Headers('authorization') authorization: string): Promise<void> {
    await this.auth.logout(authorization.replace(/^Bearer\s+/i, ''));
  }
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) { return { success: true, data: { profile: user.profile } }; }
}
