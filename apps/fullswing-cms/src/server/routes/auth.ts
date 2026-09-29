import type { FastifyInstance } from 'fastify';
import type { AdminAllowlist, IdentityProvider } from '../../auth/identity-provider.js';
import type { SessionService } from '../../auth/session-service.js';
import { CmsError } from '../../content/domain/content-errors.js';
import { renderLoginPage } from '../../views/login.js';

const OAUTH_STATE_COOKIE = 'fullswing_cms_oauth_state';
const SESSION_COOKIE = 'fullswing_cms_session';

interface AuthRouteDependencies {
  identityProvider: IdentityProvider;
  allowlist: AdminAllowlist;
  sessions: SessionService;
  secureCookies: boolean;
}

interface LoginQuery {
  returnTo?: string;
}

interface CallbackQuery {
  code?: string;
  state?: string;
  error?: string;
}

interface OAuthStateCookie {
  state: string;
  returnTo: string;
}

function readOAuthStateCookie(value: string | undefined, app: FastifyInstance): OAuthStateCookie {
  const unsigned = value ? app.unsignCookie(value) : undefined;
  if (!unsigned?.valid || typeof unsigned.value !== 'string') {
    throw new CmsError('authentication-required', 'Sign-in could not be completed.', 401);
  }

  let state: unknown;
  try {
    state = JSON.parse(unsigned.value);
  } catch {
    throw new CmsError('authentication-required', 'Sign-in could not be completed.', 401);
  }
  if (!state || typeof state !== 'object' || !('state' in state) || !('returnTo' in state)) {
    throw new CmsError('authentication-required', 'Sign-in could not be completed.', 401);
  }

  const payload = state as { state: unknown; returnTo: unknown };
  if (typeof payload.state !== 'string' || typeof payload.returnTo !== 'string') {
    throw new CmsError('authentication-required', 'Sign-in could not be completed.', 401);
  }
  return { state: payload.state, returnTo: payload.returnTo };
}

export function registerAuthRoutes(app: FastifyInstance, dependencies: AuthRouteDependencies): void {
  app.get<{ Querystring: LoginQuery }>('/login', async (request, reply) => {
    const signIn = await dependencies.identityProvider.beginSignIn(request.query.returnTo ?? '/dashboard');
    const statePayload = JSON.stringify({ state: signIn.state, returnTo: signIn.returnTo });
    reply.setCookie(OAUTH_STATE_COOKIE, statePayload, {
      httpOnly: true,
      maxAge: 10 * 60,
      path: '/',
      sameSite: 'lax',
      secure: dependencies.secureCookies,
      signed: true,
    });

    return reply.type('text/html; charset=utf-8').send(renderLoginPage(signIn.authorizationUrl));
  });

  app.get<{ Querystring: CallbackQuery }>('/auth/callback', async (request, reply) => {
    const stateCookie = readOAuthStateCookie(request.cookies[OAUTH_STATE_COOKIE], app);
    if (request.query.error || !request.query.code || !request.query.state) {
      reply.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
      throw new CmsError('authentication-required', 'Sign-in was not completed.', 401);
    }

    const principal = await dependencies.identityProvider.completeSignIn({
      code: request.query.code,
      state: request.query.state,
      expectedState: stateCookie.state,
    });
    if (!await dependencies.allowlist.isAllowed(principal.identity)) {
      reply.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
      return reply.code(403).send({ error: 'Access denied.' });
    }

    const session = await dependencies.sessions.create(principal);
    const maxAge = Math.max(1, Math.ceil((session.expiresAt - Date.now()) / 1000));
    reply.setCookie(SESSION_COOKIE, session.id, {
      httpOnly: true,
      maxAge,
      path: '/',
      sameSite: 'lax',
      secure: dependencies.secureCookies,
      signed: true,
    });
    reply.clearCookie(OAUTH_STATE_COOKIE, { path: '/' });
    return reply.redirect(stateCookie.returnTo, 303);
  });

  app.post('/auth/logout', async (request, reply) => {
    const session = request.cmsSession;
    if (session) {
      await dependencies.sessions.destroy(session.id);
    }
    reply.clearCookie(SESSION_COOKIE, { path: '/' });
    return reply.redirect('/login', 303);
  });
}