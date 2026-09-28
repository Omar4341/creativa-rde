import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/app-config.module.js';
import { QrService } from './qr.service.js';

@Module({
  imports: [AppConfigModule],
  providers: [QrService],
  exports: [QrService],
})
export class QrModule {}
