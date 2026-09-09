import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import type { PartitionRequest } from '../interfaces/partition-request.interface';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('GlobalExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>() as PartitionRequest;
    const requestId = request.requestId;

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    if (exception instanceof HttpException) {
      const payload = exception.getResponse();
      const message =
        typeof payload === 'object' && payload !== null && 'message' in payload
          ? String((payload as { message: unknown }).message)
          : exception.message;
      response.status(status).json({
        success: false,
        error: {
          code: this.mapCode(status),
          message,
        },
      });
      return;
    }

    // Log the full stack trace for unexpected errors so they can be diagnosed
    const prismaError = this.getPrismaErrorDetails(exception);
    this.logger.error({
      message: 'Unhandled exception',
      requestId,
      method: request.method,
      path: request.originalUrl,
      partition: request.partition?.slug,
      ...prismaError,
    }, exception instanceof Error ? exception.stack : String(exception));

    response.status(status).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred.',
        ...(requestId ? { requestId } : {}),
      },
    });
  }

  private getPrismaErrorDetails(exception: unknown): Record<string, unknown> {
    if (!exception || typeof exception !== 'object') return {};

    const candidate = exception as { code?: unknown; meta?: unknown };
    if (typeof candidate.code !== 'string' || !candidate.code.startsWith('P')) return {};

    const meta = candidate.meta && typeof candidate.meta === 'object'
      ? candidate.meta as Record<string, unknown>
      : undefined;
    return {
      prismaCode: candidate.code,
      ...(typeof meta?.['modelName'] === 'string' ? { prismaModel: meta['modelName'] } : {}),
      ...(typeof meta?.['target'] === 'string' ? { prismaTarget: meta['target'] } : {}),
      ...(typeof meta?.['table'] === 'string' ? { prismaTable: meta['table'] } : {}),
      ...(typeof meta?.['column'] === 'string' ? { prismaColumn: meta['column'] } : {}),
    };
  }

  private mapCode(status: number): string {
    switch (status) {
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND';
      case HttpStatus.BAD_REQUEST:
        return 'BAD_REQUEST';
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED';
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN';
      case HttpStatus.CONFLICT:
        return 'CONFLICT';
      default:
        return 'REQUEST_FAILED';
    }
  }
}
