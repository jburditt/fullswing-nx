import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload } from 'jose';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import type { AdminAllowlist, AdministratorIdentity } from './identity-provider.js';

export class McpAuthenticationError extends Error {
  constructor(readonly statusCode: 401 | 403, message: string) {
    super(message);
    this.name = 'McpAuthenticationError';
  }
}

export class InvalidMcpAccessTokenError extends Error {
  constructor() {
    super('The Entra access token is invalid or expired.');
    this.name = 'InvalidMcpAccessTokenError';
  }
}

export type AccessTokenVerifier = (token: string) => Promise<JWTPayload>;

export interface McpAuthenticationOptions {
  tenantId: string;
  clientId: string;
  resourceUrl: string;
  allowlist: AdminAllowlist;
  verifyAccessToken?: AccessTokenVerifier;
}

function createEntraVerifier(tenantId: string, clientId: string): AccessTokenVerifier {
  const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
  const jwks = createRemoteJWKSet(
    new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`),
  );
  return async token => {
    const { payload } = await jwtVerify(token, jwks, {
      algorithms: ['RS256'],
      audience: clientId,
      issuer,
    });
    return payload;
  };
}

function requiredClaim(payload: JWTPayload, name: string): string | undefined {
  const claim = payload[name];
  return typeof claim === 'string' && claim.length > 0 ? claim : undefined;
}

function scopesFrom(payload: JWTPayload): string[] {
  const rawScopes = payload.scp;
  return typeof rawScopes === 'string' ? rawScopes.split(/\s+/).filter(Boolean) : [];
}

export class EntraMcpAuthenticator {
  readonly authorizationServer: string;
  readonly scopeName = 'mcp.read';
  readonly scopeUri: string;
  readonly resourceUrl: URL;
  private readonly verifyAccessToken: AccessTokenVerifier;

  constructor(
    private readonly options: McpAuthenticationOptions,
  ) {
    this.resourceUrl = new URL(options.resourceUrl);
    if (this.resourceUrl.protocol !== 'https:' || this.resourceUrl.pathname !== '/mcp'
      || this.resourceUrl.username || this.resourceUrl.password || this.resourceUrl.search || this.resourceUrl.hash
      || !/^[A-Za-z0-9.-]{1,128}$/.test(options.tenantId)
      || !/^[A-Za-z0-9.-]{1,128}$/.test(options.clientId)) {
      throw new Error('MCP Entra authentication settings are invalid.');
    }
    this.authorizationServer = `https://login.microsoftonline.com/${options.tenantId}/v2.0`;
    this.scopeUri = `api://${options.clientId}/${this.scopeName}`;
    this.verifyAccessToken = options.verifyAccessToken
      ?? createEntraVerifier(options.tenantId, options.clientId);
  }

  async authenticate(authorization: string | undefined): Promise<AuthInfo> {
    const match = /^Bearer ([^\s]+)$/i.exec(authorization ?? '');
    const token = match?.[1];
    if (!token || token.length > 16_384) {
      throw new McpAuthenticationError(401, 'A valid Entra access token is required.');
    }

    let payload: JWTPayload;
    try {
      payload = await this.verifyAccessToken(token);
    } catch (error) {
      if (error instanceof InvalidMcpAccessTokenError || error instanceof errors.JOSEError) {
        throw new McpAuthenticationError(401, 'The Entra access token is invalid or expired.');
      }
      throw error;
    }

    const tenantId = requiredClaim(payload, 'tid');
    const objectId = requiredClaim(payload, 'oid');
    const scopes = scopesFrom(payload);
    if (!tenantId || !objectId || tenantId !== this.options.tenantId) {
      throw new McpAuthenticationError(401, 'The Entra access token does not identify an allowed tenant user.');
    }
    if (!scopes.includes(this.scopeName)) {
      throw new McpAuthenticationError(403, 'The Entra access token does not include the MCP read scope.');
    }

    const identity: AdministratorIdentity = {
      tenantId,
      objectId,
      displayName: requiredClaim(payload, 'name') ?? objectId,
      email: requiredClaim(payload, 'preferred_username'),
    };
    if (!await this.options.allowlist.isAllowed(identity)) {
      throw new McpAuthenticationError(403, 'This Entra identity is not an approved CMS administrator.');
    }

    const clientId = requiredClaim(payload, 'azp') ?? requiredClaim(payload, 'appid') ?? this.options.clientId;
    return {
      token,
      clientId,
      scopes,
      expiresAt: typeof payload.exp === 'number' ? payload.exp : undefined,
      resource: this.resourceUrl,
      extra: { tenantId, objectId },
    };
  }
}
