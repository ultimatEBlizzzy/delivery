import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { ApiErrorDetail, ApiErrorResponse } from '@hardware-delivery/shared';
import { RequestContext } from '../request-context';

interface PgError {
  code?: string;
  constraint?: string;
  detail?: string;
  table?: string;
  column?: string;
}

const STATUS_TEXT: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  413: 'Payload Too Large',
  415: 'Unsupported Media Type',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
};

/**
 * One consistent error envelope for the whole API:
 *   { statusCode, error, message, details?, requestId, path, timestamp }
 * Database errors are translated into safe, meaningful HTTP errors; internals are never leaked.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = RequestContext.get()?.requestId;

    const body = this.toBody(exception);
    body.requestId = requestId;
    body.path = request.originalUrl?.split('?')[0] ?? request.url;
    body.timestamp = new Date().toISOString();

    if (body.statusCode >= 500) {
      this.logger.error(
        `${request.method} ${body.path} -> ${body.statusCode} [${requestId}] ${
          exception instanceof Error ? exception.message : String(exception)
        }`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    if (response.headersSent) return;
    response.status(body.statusCode).json(body);
  }

  private toBody(exception: unknown): ApiErrorResponse {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const res = exception.getResponse();
      const base: ApiErrorResponse = {
        statusCode: status,
        error: STATUS_TEXT[status] ?? exception.name,
        message: exception.message,
      };
      if (typeof res === 'object' && res !== null) {
        const r = res as {
          message?: string | string[];
          error?: string;
          details?: ApiErrorDetail[];
        };
        if (r.details) base.details = r.details;
        if (Array.isArray(r.message)) base.message = r.message.join('; ');
        else if (typeof r.message === 'string') base.message = r.message;
        if (r.error && !STATUS_TEXT[status]) base.error = r.error;
      }
      return base;
    }

    if (exception instanceof QueryFailedError) {
      return this.fromDatabaseError(exception.driverError as PgError);
    }

    // Body-parser errors (malformed JSON, payload too large) carry a status.
    const maybe = exception as { status?: number; statusCode?: number; type?: string };
    const status = maybe?.status ?? maybe?.statusCode;
    if (status && status >= 400 && status < 500) {
      return {
        statusCode: status,
        error: STATUS_TEXT[status] ?? 'Bad Request',
        message:
          maybe.type === 'entity.too.large'
            ? 'Request body is too large'
            : maybe.type === 'entity.parse.failed'
              ? 'Request body is not valid JSON'
              : 'Bad request',
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: STATUS_TEXT[500],
      message: 'An unexpected error occurred. Please try again later.',
    };
  }

  private fromDatabaseError(err: PgError): ApiErrorResponse {
    switch (err.code) {
      case '23505': // unique_violation
        return {
          statusCode: 409,
          error: STATUS_TEXT[409],
          message: 'A record with these details already exists',
        };
      case '23503': // foreign_key_violation
        return {
          statusCode: 409,
          error: STATUS_TEXT[409],
          message:
            'The record is referenced by other data, or refers to something that does not exist',
        };
      case '23514': // check_violation
        return {
          statusCode: 400,
          error: STATUS_TEXT[400],
          message: 'The provided values are not allowed',
        };
      case '23502': // not_null_violation
        return { statusCode: 400, error: STATUS_TEXT[400], message: 'A required value is missing' };
      case '22P02': // invalid_text_representation (e.g. malformed uuid)
      case '22003': // numeric_value_out_of_range
        return {
          statusCode: 400,
          error: STATUS_TEXT[400],
          message: 'A provided value has an invalid format',
        };
      case '40001': // serialization_failure
      case '40P01': // deadlock_detected
        return {
          statusCode: 409,
          error: STATUS_TEXT[409],
          message: 'The request conflicted with another update. Please retry.',
        };
      default:
        return {
          statusCode: 500,
          error: STATUS_TEXT[500],
          message: 'An unexpected error occurred. Please try again later.',
        };
    }
  }
}

/** Build the structured 400 body for class-validator failures (used by the global ValidationPipe). */
export function validationExceptionFactory(
  errors: import('class-validator').ValidationError[],
): BadRequestException {
  const details: ApiErrorDetail[] = [];
  const walk = (list: import('class-validator').ValidationError[], prefix: string) => {
    for (const e of list) {
      const field = prefix ? `${prefix}.${e.property}` : e.property;
      if (e.constraints)
        details.push({ field, messages: [...new Set(Object.values(e.constraints))] });
      if (e.children?.length) walk(e.children, field);
    }
  };
  walk(errors, '');
  return new BadRequestException({
    message: 'Validation failed',
    details,
  });
}
