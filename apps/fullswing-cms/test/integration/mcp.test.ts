import assert from 'node:assert/strict';
import test from 'node:test';
import { request as httpRequest } from 'node:http';
import type { JWTPayload } from 'jose';
import { EntraMcpAuthenticator, InvalidMcpAccessTokenError } from '../../src/auth/mcp-authentication.js';
import type { BlogContent } from '../../src/content/domain/content-entry.js';
import { createCmsApp } from '../../src/bootstrap.js';
import { ContentProviderRegistry } from '../../src/content/storage/provider-registry.js';
import {
  FakeAdminAllowlist,
  FakeConfigurationStore,
  FakeContentStorageProvider,
  FakeIdentityProvider,
  FakeSecretStore,
  FakeSessionStore,
  testAdministrator,
} from '../support/fakes.js';

const resourceUrl = 'https://cms.example.test/mcp';

function makeBlog(id: string, title: string, markdown: string, date: string): BlogContent {
  return {
    id,
    kind: 'blog',
    route: `/blog/${id}`,
    version: `version-${id}`,
    metadata: {
      title,
      author: 'Fullswing Team',
      date,
      dateValue: new Date(`${date}T00:00:00.000Z`),
      categories: ['Architecture'],
    },
    markdown,
  };
}

function createAuthenticator(allowlist = new FakeAdminAllowlist()): EntraMcpAuthenticator {
  return new EntraMcpAuthenticator({
    tenantId: testAdministrator.tenantId,
    clientId: 'mcp-resource-client',
    resourceUrl,
    allowlist,
    verifyAccessToken: async token => {
      if (token === 'invalid') throw new InvalidMcpAccessTokenError();
      return {
        tid: testAdministrator.tenantId,
        oid: token === 'not-allowlisted' ? 'someone-else' : testAdministrator.objectId,
        name: testAdministrator.displayName,
        preferred_username: testAdministrator.email,
        scp: token === 'wrong-scope' ? 'profile' : 'mcp.read',
        azp: 'registered-mcp-client',
        exp: 2_000_000_000,
      } satisfies JWTPayload;
    },
  });
}

async function createApp(allowlist = new FakeAdminAllowlist()) {
  const contentProvider = new FakeContentStorageProvider();
  contentProvider.seed(makeBlog(
    'cloud-patterns',
    'Cloud Application Patterns',
    '# Cloud Application Patterns\n\nUse an orchestrator for resilient deployments.',
    '2026-08-14',
  ));
  contentProvider.seed(makeBlog(
    'markdown-rendering',
    'Markdown Rendering',
    '# Markdown Rendering\n\nA static blog renders content at build time.',
    '2025-04-02',
  ));
  const providers = new ContentProviderRegistry();
  providers.register('memory', (_settings, revision) => new FakeContentStorageProvider('memory', revision));
  const app = await createCmsApp({
    configurationStore: new FakeConfigurationStore(),
    secretStore: new FakeSecretStore(),
    identityProvider: new FakeIdentityProvider(),
    sessionStore: new FakeSessionStore(),
    allowlist,
    contentProviders: providers,
    sessionCookieSecret: 'mcp-test-cookie-secret-with-more-than-32-characters',
    secureCookies: false,
    mcp: {
      authenticator: createAuthenticator(allowlist),
      resolveBlogSource: async () => ({
        async listBlogs() {
          return contentProvider.listBlogs();
        },
        async readBlog(id) {
          return contentProvider.readBlog(id);
        },
      }),
    },
  });
  return app;
}

const initializeMessage = {
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2025-11-25',
    capabilities: {},
    clientInfo: { name: 'integration-test', version: '1.0.0' },
  },
};

test('MCP metadata is discoverable, while MCP requests require Entra authentication', async () => {
  const app = await createApp();
  const metadata = await app.inject({
    method: 'GET',
    url: '/.well-known/oauth-protected-resource/mcp',
  });
  const anonymousMcp = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: { host: 'cms.example.test', 'content-type': 'application/json' },
    payload: initializeMessage,
  });
  const anonymousDashboard = await app.inject({ method: 'GET', url: '/dashboard' });
  await app.close();

  assert.equal(metadata.statusCode, 200);
  assert.deepEqual(metadata.json().authorization_servers, [
    'https://login.microsoftonline.com/tenant-test/v2.0',
  ]);
  assert.deepEqual(metadata.json().scopes_supported, ['api://mcp-resource-client/mcp.read']);
  assert.equal(anonymousMcp.statusCode, 401);
  assert.match(String(anonymousMcp.headers['www-authenticate']), /resource_metadata=/);
  assert.equal(anonymousDashboard.statusCode, 302);
});

test('MCP tools search and retrieve blog Markdown for allowlisted administrators', async () => {
  const app = await createApp();
  const headers = {
    host: 'cms.example.test',
    authorization: 'Bearer valid',
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
  };
  const initialize = await app.inject({ method: 'POST', url: '/mcp', headers, payload: initializeMessage });
  const sessionHeaders = {
    ...headers,
    'mcp-session-id': String(initialize.headers['mcp-session-id']),
  };
  const sessionWithoutAuth = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      host: 'cms.example.test',
      accept: 'application/json, text/event-stream',
      'content-type': 'application/json',
      'mcp-session-id': sessionHeaders['mcp-session-id'],
    },
    payload: { jsonrpc: '2.0', id: 5, method: 'tools/list', params: {} },
  });
  const toolList = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: sessionHeaders,
    payload: { jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} },
  });
  const writeToolAttempts = await Promise.all(['create_blog', 'save_blog', 'update_blog'].map(name =>
    app.inject({
      method: 'POST',
      url: '/mcp',
      headers: sessionHeaders,
      payload: {
        jsonrpc: '2.0',
        id: `write-attempt-${name}`,
        method: 'tools/call',
        params: { name, arguments: { id: 'cloud-patterns', markdown: 'Changed content' } },
      },
    }),
  ));
  const search = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: sessionHeaders,
    payload: {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'search_blogs', arguments: { query: 'orchestrator', category: 'Architecture' } },
    },
  });
  const unfilteredSearch = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: sessionHeaders,
    payload: {
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'search_blogs', arguments: { limit: 5 } },
    },
  });
  const results = JSON.parse(search.json().result.content[0].text) as {
    total: number;
    results: Array<{ id: string; metadata: { title: string }; excerpt: string }>;
  };
  const retrieved = await app.inject({
    method: 'POST',
    url: '/mcp',
    headers: sessionHeaders,
    payload: {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'get_blog', arguments: { id: results.results[0]?.id } },
    },
  });
  const blog = JSON.parse(retrieved.json().result.content[0].text) as {
    metadata: { title: string };
    markdown: string;
  };
  await app.close();

  assert.equal(initialize.statusCode, 200);
  assert.equal(sessionWithoutAuth.statusCode, 401);
  assert.equal(toolList.statusCode, 200);
  const listedTools = toolList.json().result.tools as Array<{
    name: string;
    annotations?: { readOnlyHint?: boolean; destructiveHint?: boolean };
  }>;
  assert.deepEqual(listedTools.map(tool => tool.name), ['search_blogs', 'get_blog']);
  assert.ok(listedTools.every(tool =>
    tool.annotations?.readOnlyHint === true && tool.annotations.destructiveHint === false,
  ));
  assert.ok(writeToolAttempts.every(response => {
    const body = response.json();
    return body.error !== undefined || body.result?.isError === true;
  }));
  assert.equal(search.statusCode, 200);
  assert.equal(unfilteredSearch.statusCode, 200);
  assert.equal(unfilteredSearch.json().result.isError, true);
  assert.equal(results.total, 1);
  assert.equal(results.results[0]?.metadata.title, 'Cloud Application Patterns');
  assert.match(results.results[0]?.excerpt ?? '', /orchestrator/i);
  assert.equal(retrieved.statusCode, 200);
  assert.equal(blog.metadata.title, 'Cloud Application Patterns');
  assert.match(blog.markdown, /orchestrator/);
});

test('MCP Streamable HTTP works over a live local HTTP listener', async () => {
  const app = await createApp();
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  assert.ok(address && typeof address === 'object');
  const endpoint = `http://127.0.0.1:${address.port}/mcp`;
  const post = (headers: Record<string, string>, payload: object) => new Promise<{
    statusCode: number;
    headers: import('node:http').IncomingHttpHeaders;
    body: string;
  }>((resolve, reject) => {
    const body = JSON.stringify(payload);
    const request = httpRequest(endpoint, {
      method: 'POST',
      headers: { ...headers, 'content-length': String(Buffer.byteLength(body)) },
    }, response => {
      const chunks: Buffer[] = [];
      response.on('data', chunk => chunks.push(Buffer.from(chunk)));
      response.on('end', () => resolve({
        statusCode: response.statusCode ?? 0,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    request.on('error', reject);
    request.end(body);
  });
  const headers = {
    host: 'cms.example.test',
    authorization: 'Bearer valid',
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
  };

  try {
    const initialize = await post(headers, initializeMessage);
    const sessionId = initialize.headers['mcp-session-id'];
    const initialized = JSON.parse(initialize.body) as {
      result?: { protocolVersion: string };
    };
    assert.equal(initialize.statusCode, 200);
    assert.equal(initialized.result?.protocolVersion, '2025-11-25');
    assert.ok(sessionId);

    const tools = await post({ ...headers, 'mcp-session-id': String(sessionId) }, {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
      params: {},
    });
    const listed = JSON.parse(tools.body) as {
      result?: { tools: Array<{ name: string }> };
    };
    assert.equal(tools.statusCode, 200);
    assert.deepEqual(listed.result?.tools.map(tool => tool.name), ['search_blogs', 'get_blog']);

    const search = await post({ ...headers, 'mcp-session-id': String(sessionId) }, {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'search_blogs', arguments: { query: 'orchestrator' } },
    });
    const searchResult = JSON.parse(search.body) as {
      result?: { content: Array<{ text: string }> };
    };
    const matchingBlog = JSON.parse(searchResult.result?.content[0]?.text ?? '{}') as {
      results?: Array<{ id: string }>;
    };
    const blogId = matchingBlog.results?.[0]?.id;
    assert.equal(search.statusCode, 200);
    assert.ok(blogId);

    const retrieved = await post({ ...headers, 'mcp-session-id': String(sessionId) }, {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'get_blog', arguments: { id: blogId } },
    });
    const retrievedResult = JSON.parse(retrieved.body) as {
      result?: { content: Array<{ text: string }> };
    };
    const blog = JSON.parse(retrievedResult.result?.content[0]?.text ?? '{}') as {
      metadata?: { title: string };
      markdown?: string;
    };
    assert.equal(retrieved.statusCode, 200);
    assert.equal(blog.metadata?.title, 'Cloud Application Patterns');
    assert.match(blog.markdown ?? '', /orchestrator/);
  } finally {
    await app.close();
  }
});

test('MCP rejects invalid tokens, non-allowlisted administrators, missing scopes, and foreign origins', async () => {
  const app = await createApp();
  const request = (authorization: string, origin?: string) => app.inject({
    method: 'POST',
    url: '/mcp',
    headers: {
      host: 'cms.example.test',
      authorization,
      'content-type': 'application/json',
      ...(origin ? { origin } : {}),
    },
    payload: initializeMessage,
  });
  const invalid = await request('Bearer invalid');
  const notAllowlisted = await request('Bearer not-allowlisted');
  const wrongScope = await request('Bearer wrong-scope');
  const foreignOrigin = await request('Bearer valid', 'https://attacker.example');
  await app.close();

  assert.equal(invalid.statusCode, 401);
  assert.equal(notAllowlisted.statusCode, 403);
  assert.equal(wrongScope.statusCode, 403);
  assert.equal(foreignOrigin.statusCode, 403);
});
