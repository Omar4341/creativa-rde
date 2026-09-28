import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Module({ imports: [AppConfigModule], controllers: [AuthController], providers: [AuthService], exports: [AuthService] })
export class AuthModule {}
