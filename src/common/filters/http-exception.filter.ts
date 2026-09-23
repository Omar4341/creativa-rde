import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

interface ErrorBody {
  code: string;
  message: string;
  details: unknown[];
}

interface ErrorResponse {
  success: false;
  error: ErrorBody;
}

/**
 * Global HTTP exception filter.
 * Converts all exceptions into the approved error envelope:
 * { success: false, error: { code, message, details } }
 *
 * In production: stack traces and raw error internals are suppressed.
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isProduction = process.env['NODE_ENV'] === 'production';

    let status: number;
    let code: string;
    let message: string;
    let details: unknown[] = [];

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        code = this.statusToCode(status);
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const body = exceptionResponse as Record<string, unknown>;
        code = (body['code'] as string | undefined) ?? this.statusToCode(status);
        message = (body['message'] as string | undefined) ?? exception.message;
        // class-validator returns an array of messages
        if (Array.isArray(body['message'])) {
          code = 'VALIDATION_ERROR';
          message = 'Input validation failed.';
          details = body['message'] as string[];
        }
      } else {
        code = this.statusToCode(status);
        message = exception.message;
      }
    } else {
      // Unhandled error — log it, return 500
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      code = 'INTERNAL_SERVER_ERROR';
      message = isProduction
        ? 'An internal error occurred. Please try again later.'
        : (exception instanceof Error ? exception.message : String(exception));

      this.logger.error(
        `Unhandled exception on ${request.method} ${request.url}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ErrorResponse = {
      success: false,
      error: { code, message, details },
    };

    response.status(status).json(body);
  }

  private statusToCode(status: number): string {
    const map: Record<number, string> = {
      400: 'VALIDATION_ERROR',
      401: 'AUTH_TOKEN_INVALID',
      403: 'AUTH_INSUFFICIENT_ROLE',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      422: 'UNPROCESSABLE_ENTITY',
      429: 'RATE_LIMIT_EXCEEDED',
      500: 'INTERNAL_SERVER_ERROR',
    };
    return map[status] ?? `HTTP_${status}`;
  }
}
