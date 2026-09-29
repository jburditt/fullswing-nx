import cookie from '@fastify/cookie';
import formbody from '@fastify/formbody';
import fastifyStatic from '@fastify/static';
import Fastify, { type FastifyInstance } from 'fastify';
import { fileURLToPath } from 'node:url';
import type { CmsSession } from '../auth/session-store.js';
import { registerErrorHandler } from './error-handler.js';
import { cmsLoggerOptions } from './logger.js';

declare module 'fastify' {
  interface FastifyRequest {
    cmsSession: CmsSession | null;
    csrfVerified: boolean;
  }
}

export interface CreateAppOptions {
  sessionCookieSecret: string;
  secureCookies: boolean;
}

export function createApp(options: CreateAppOptions): FastifyInstance {
  const app = Fastify({
    bodyLimit: 1_048_576,
    logController: new Fastify.LogController({ disableRequestLogging: true }),
    logger: cmsLoggerOptions,
  });

  app.register(cookie, {
    secret: options.sessionCookieSecret,
    hook: 'onRequest',
    parseOptions: {
      httpOnly: true,
      path: '/',
      sameSite: 'lax',
      secure: options.secureCookies,
    },
  });
  app.register(formbody);
  app.register(fastifyStatic, {
    root: fileURLToPath(new URL('../../../public', import.meta.url)),
    prefix: '/',
  });
  app.decorateRequest('cmsSession', null);
  app.decorateRequest('csrfVerified', false);
  app.addHook('onSend', async (_request, reply, payload) => {
    reply
      .header('cache-control', 'no-store')
      .header('content-security-policy', "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'")
      .header('permissions-policy', 'camera=(), geolocation=(), microphone=()')
      .header('referrer-policy', 'no-referrer')
      .header('x-content-type-options', 'nosniff')
      .header('x-frame-options', 'DENY');
    return payload;
  });
  registerErrorHandler(app);

  return app;
}