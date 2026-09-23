import { describe, it, expect } from 'vitest';
import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller.js';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get(HealthController);
  });

  it('should return success: true with status ok', () => {
    const result = controller.check();
    expect(result.success).toBe(true);
    expect(result.data.status).toBe('ok');
    expect(typeof result.data.timestamp).toBe('string');
    expect(typeof result.data.uptime).toBe('number');
  });

  it('should return a valid ISO timestamp', () => {
    const result = controller.check();
    expect(() => new Date(result.data.timestamp)).not.toThrow();
    expect(new Date(result.data.timestamp).toISOString()).toBe(result.data.timestamp);
  });
});
