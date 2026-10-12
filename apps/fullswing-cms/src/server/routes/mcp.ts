import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { EntraMcpAuthenticator } from '../../auth/mcp-authentication.js';
import { McpAuthenticationError } from '../../auth/mcp-authentication.js';
import type { BlogSearchSource, McpBlogServer } from '../../mcp/blog-tools.js';
import { createMcpBlogServer } from '../../mcp/blog-tools.js';

interface ActiveMcpSession extends McpBlogServer {
  lastUsedAt: number;
}

export interface McpRouteDependencies {
  authenticator?: EntraMcpAuthenticator;
  resourceUrl?: URL | string;
  allowAnonymous?: boolean;
  resolveBlogSource(): Promise<BlogSearchSource>;
}

const MAX_MCP_SESSIONS = 100;
const MCP_SESSION_IDLE_MS = 30 * 60 * 1000;

function hasAllowedOrigin(request: FastifyRequest, expectedOrigin: string): boolean {
  const host = request.headers.host;
  if (!host || host.toLocaleLowerCase('en-US') !== new URL(expectedOrigin).host.toLocaleLowerCase('en-US')) {
    return false;
  }

  const origin = request.headers.origin;
  if (origin === undefined) return true;
  try {
    return new URL(origin).origin === expectedOrigin;
  } catch {
    return false;
  }
}

function unauthorized(reply: FastifyReply, authenticator: EntraMcpAuthenticator, statusCode: 401 | 403, message: string) {
  const metadataUrl = new URL('/.well-known/oauth-protected-resource/mcp', authenticator.resourceUrl.origin);
  const challenge = 'Bearer '
    + `resource_metadata="${metadataUrl.href}", scope="${authenticator.scopeUri}"`;
  reply
    .header('www-authenticate', challenge)
    .code(statusCode)
    .type('application/json; charset=utf-8');
  return reply.send({ error: message });
}

export async function registerMcpRoutes(
  app: FastifyInstance,
  dependencies: McpRouteDependencies,
): Promise<void> {
  const authenticator = dependencies.authenticator;
  const allowAnonymous = dependencies.allowAnonymous ?? false;
  if (!authenticator && !allowAnonymous) {
    throw new Error('An MCP authenticator is required unless allowAnonymous is enabled.');
  }

  const rawResourceUrl = dependencies.resourceUrl
    ?? (authenticator ? authenticator.resourceUrl : undefined);
  if (!rawResourceUrl) {
    throw new Error('A resourceUrl is required for MCP routes.');
  }
  const resourceUrl = typeof rawResourceUrl === 'string' ? new URL(rawResourceUrl) : rawResourceUrl;

  if (authenticator) {
    const metadataUrl = new URL('/.well-known/oauth-protected-resource/mcp', authenticator.resourceUrl.origin);
    app.get(metadataUrl.pathname, async (_request, reply) => reply
      .type('application/json; charset=utf-8')
      .send({
        resource: authenticator.resourceUrl.href,
        authorization_servers: [authenticator.authorizationServer],
        scopes_supported: [authenticator.scopeUri],
        bearer_methods_supported: ['header'],
      }));
  }

  const source: BlogSearchSource = {
    async listBlogs() {
      return (await dependencies.resolveBlogSource()).listBlogs();
    },
    async readBlog(id) {
      return (await dependencies.resolveBlogSource()).readBlog(id);
    },
  };
  const sessions = new Map<string, ActiveMcpSession>();
  app.addHook('onClose', async () => {
    await Promise.all([...sessions.values()].map(session => session.server.close()));
    sessions.clear();
  });

  async function removeExpiredSessions(): Promise<void> {
    const now = Date.now();
    for (const [sessionId, session] of sessions) {
      if (now - session.lastUsedAt > MCP_SESSION_IDLE_MS) {
        sessions.delete(sessionId);
        await session.server.close();
      }
    }
  }

  app.all('/mcp', { bodyLimit: 64 * 1024 }, async (request, reply) => {
    const resourceOrigin = resourceUrl.origin;
    if (!hasAllowedOrigin(request, resourceOrigin)) {
      return reply.code(403).send({ error: 'The MCP request origin is not allowed.' });
    }

    let authInfo;
    if (authenticator) {
      try {
        authInfo = await authenticator.authenticate(request.headers.authorization);
      } catch (error) {
        if (allowAnonymous && (!request.headers.authorization || request.headers.authorization.trim() === '')) {
          authInfo = undefined;
        } else if (error instanceof McpAuthenticationError) {
          return unauthorized(reply, authenticator, error.statusCode, error.message);
        } else {
          throw error;
        }
      }
    }

    await removeExpiredSessions();
    const suppliedSessionId = request.headers['mcp-session-id'];
    let session = typeof suppliedSessionId === 'string' ? sessions.get(suppliedSessionId) : undefined;
    const initialize = typeof request.body === 'object' && request.body !== null
      && 'method' in request.body && request.body.method === 'initialize';
    if (suppliedSessionId && !session) {
      return reply.code(404).send({ error: 'The MCP session is invalid or expired.' });
    }
    if (!session) {
      if (!initialize) {
        return reply.code(400).send({ error: 'Initialize an MCP session before sending requests.' });
      }
      if (sessions.size >= MAX_MCP_SESSIONS) {
        return reply.code(503).send({ error: 'The MCP server has reached its active session limit.' });
      }
      let newSession: ActiveMcpSession;
      const created = createMcpBlogServer(
        source,
        sessionId => sessions.set(sessionId, newSession),
        sessionId => sessions.delete(sessionId),
      );
      newSession = { ...created, lastUsedAt: Date.now() };
      await created.server.connect(created.transport);
      session = newSession;
    }
    session.lastUsedAt = Date.now();

    const target = new URL(request.url, resourceUrl);
    if (target.origin !== resourceOrigin || target.pathname !== '/mcp') {
      return reply.code(400).send({ error: 'The MCP request target is invalid.' });
    }

    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (name === 'content-length' || name === 'transfer-encoding' || name === 'host' || value === undefined) continue;
      headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
    const webRequest = new Request(target, {
      method: request.method,
      headers,
      ...(request.method === 'GET' || request.method === 'HEAD' ? {} : { body: JSON.stringify(request.body) }),
    });
    const response = await session.transport.handleRequest(webRequest, {
      parsedBody: request.body,
      authInfo,
    });
    response.headers.forEach((value, name) => {
      if (name !== 'content-length' && name !== 'transfer-encoding' && name !== 'connection') {
        reply.header(name, value);
      }
    });
    const body = await response.text();
    return reply.code(response.status).send(body);
  });
}
