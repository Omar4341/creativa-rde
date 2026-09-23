import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppConfigModule } from './config/app-config.module.js';
import { AppConfigService } from './config/app-config.service.js';
import { HealthModule } from './health/health.module.js';

// Feature module stubs — will be implemented in later phases
import { DatabaseModule } from './database/database.module.js';
import { AuthModule } from './auth/auth.module.js';
import { UsersModule } from './users/users.module.js';
import { EventsModule } from './events/events.module.js';
import { RegistrationsModule } from './registrations/registrations.module.js';
import { AttendanceModule } from './attendance/attendance.module.js';
import { QrModule } from './qr/qr.module.js';
import { QuestionsModule } from './questions/questions.module.js';
import { VotesModule } from './votes/votes.module.js';
import { PresenterModule } from './presenter/presenter.module.js';
import { AdminModule } from './admin/admin.module.js';

@Module({
  imports: [
    // Configuration — global, validates env at startup
    AppConfigModule,

    // Rate limiting — configured from environment variables
    ThrottlerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        throttlers: [
          {
            ttl: config.throttleTtlSeconds * 1000, // ThrottlerModule expects milliseconds
            limit: config.throttleLimit,
          },
        ],
      }),
    }),

    // Infrastructure
    HealthModule,
    DatabaseModule,

    // Feature modules (stubs — implemented in later phases)
    AuthModule,
    UsersModule,
    EventsModule,
    RegistrationsModule,
    AttendanceModule,
    QrModule,
    QuestionsModule,
    VotesModule,
    PresenterModule,
    AdminModule,
  ],
})
export class AppModule {}
