import type { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { logger } from './logger.js';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const correlationId = request.headers['x-correlation-id'] as string | undefined;

  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.code || 'APP_ERROR',
      message: error.message,
      correlationId,
    });
  }

  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: error.flatten().fieldErrors,
      correlationId,
    });
  }

  logger.error({ err: error, correlationId }, 'Unhandled error');
  return reply.status(500).send({
    error: 'INTERNAL_ERROR',
    message: 'Internal server error',
    correlationId,
  });
}
