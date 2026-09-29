import { timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { AdminAllowlist } from '../auth/identity-provider.js';
import type { CmsSession, SessionStore } from '../auth/session-store.js';

const SESSION_COOKIE = 'fullswing_cms_session';
const PUBLIC_GET_PATHS = new Set(['/login', '/auth/callback']);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface RequestGuardDependencies {
  sessions: SessionStore;
  allowlist: AdminAllowlist;
  developmentSession?: CmsSession;
}

function matchesToken(expected: string, received: string | undefined): boolean {
  if (!received) {
    return false;
  }

  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

function getCsrfToken(request: FastifyRequest): string | undefined {
  const header = request.headers['x-csrf-token'];
  if (typeof header === 'string') {
    return header;
  }

  if (request.body && typeof request.body === 'object' && '_csrf' in request.body) {
    const token = (request.body as { _csrf?: unknown })._csrf;
    return typeof token === 'string' ? token : undefined;
  }

  return undefined;
}

export function registerRequestGuards(
  app: FastifyInstance,
  dependencies: RequestGuardDependencies,
): void {
  app.addHook('onRequest', async (request, reply) => {
    const requestUrl = new URL(request.url, 'http://localhost');
    if (dependencies.developmentSession && request.method === 'GET' && (
      requestUrl.pathname === '/login' || requestUrl.pathname === '/auth/callback'
    )) {
      return reply.redirect('/dashboard', 303);
    }

    const isPublicGet = request.method === 'GET' && (
      PUBLIC_GET_PATHS.has(requestUrl.pathname) || requestUrl.pathname.startsWith('/assets/')
    );
    if (isPublicGet) {
      return;
    }

    let session = dependencies.developmentSession;
    if (!session) {
      const signedCookie = request.cookies[SESSION_COOKIE];
      const unsignedCookie = signedCookie ? request.unsignCookie(signedCookie) : undefined;
      const sessionId = unsignedCookie?.value;
      if (!unsignedCookie?.valid || typeof sessionId !== 'string' || !sessionId) {
        return reply.redirect(`/login?returnTo=${encodeURIComponent(requestUrl.pathname)}`, 302);
      }

      session = await dependencies.sessions.get(sessionId);
    }

    if (!session || session.expiresAt <= Date.now()) {
      if (session) await dependencies.sessions.delete(session.id);
      reply.clearCookie(SESSION_COOKIE, { path: '/' });
      return reply.redirect(`/login?returnTo=${encodeURIComponent(requestUrl.pathname)}`, 302);
    }

    if (!await dependencies.allowlist.isAllowed(session.identity)) {
      await dependencies.sessions.delete(session.id);
      reply.clearCookie(SESSION_COOKIE, { path: '/' });
      return reply.code(403).send({ error: 'Access denied.' });
    }

    request.cmsSession = session;
  });

  app.addHook('preValidation', async (request, reply) => {
    if (SAFE_METHODS.has(request.method)) {
      return;
    }

    const session = request.cmsSession;
    if (!session || !matchesToken(session.csrfToken, getCsrfToken(request))) {
      return reply.code(403).send({ error: 'The request could not be verified.' });
    }
    request.csrfVerified = true;
  });
}