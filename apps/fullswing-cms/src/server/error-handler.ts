import type { FastifyInstance } from 'fastify';
import { CmsError, ValidationError } from '../content/domain/content-errors.js';

export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof CmsError) {
      request.log.info({ requestId: request.id, errorCode: error.code }, 'CMS request rejected');
      const body = error instanceof ValidationError
        ? { error: { code: error.code, message: error.message, issues: error.issues } }
        : { error: { code: error.code, message: error.message } };
      return reply.code(error.statusCode).send(body);
    }

    const errorName = error instanceof Error ? error.name : typeof error;
    request.log.error({ requestId: request.id, errorName }, 'Unexpected CMS error');
    return reply.code(500).send({
      error: {
        code: 'internal-error',
        message: 'An unexpected error occurred.',
      },
    });
  });
}