import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator.js';

interface HealthResponse {
  success: true;
  data: {
    status: 'ok';
    timestamp: string;
    uptime: number;
  };
}

/**
 * Health check endpoint.
 * GET /health → 200 { success: true, data: { status: 'ok', ... } }
 *
 * Used by deployment platforms and load balancers to verify the service is running.
 * Does NOT check database connectivity (that is a Phase 2 concern).
 */
@Controller('health')
@Public()
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      success: true,
      data: {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
      },
    };
  }
}
