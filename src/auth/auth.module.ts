import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';

@Module({ imports: [AppConfigModule], controllers: [AuthController], providers: [AuthService, JwtAuthGuard] })
export class AuthModule {}
