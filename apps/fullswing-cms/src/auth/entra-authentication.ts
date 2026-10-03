import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  ConfidentialClientApplication,
  type ICachePlugin,
  type IConfidentialClientApplication,
} from '@azure/msal-node';
import type { SecretStore } from '../config/secret-store.js';
import { CmsError } from '../content/domain/content-errors.js';
import type {
  AuthenticatedPrincipal,
  AdministratorIdentity,
  IdentityProvider,
  SignInCallback,
  SignInStart,
} from './identity-provider.js';

export interface EntraOAuthClient {
  createAuthorizationUrl(state: string, returnTo: string): Promise<string>;
  exchangeAuthorizationCode(code: string, state: string): Promise<AuthenticatedPrincipal>;
  getGraphAccessToken(tokenCacheReference: string): Promise<string>;
}

const GRAPH_SCOPES = ['Files.ReadWrite'];

export interface MsalEntraClientOptions {
  clientId: string;
  tenantId: string;
  clientSecret: string;
  redirectUri: string;
  signInScopes?: string[];
  cacheSecretReference: string;
  secretStore: SecretStore;
}

export function createMsalCachePlugin(secretStore: SecretStore, cacheSecretReference: string): ICachePlugin {
  return {
    beforeCacheAccess: async context => {
      const serializedCache = await secretStore.get(cacheSecretReference);
      if (serializedCache) {
        context.tokenCache.deserialize(serializedCache);
      }
    },
    afterCacheAccess: async context => {
      if (context.cacheHasChanged) {
        await secretStore.set(cacheSecretReference, context.tokenCache.serialize());
      }
    },
  };
}

export class MsalEntraOAuthClient implements EntraOAuthClient {
  private readonly client: IConfidentialClientApplication;

  constructor(
    private readonly options: MsalEntraClientOptions,
    client?: IConfidentialClientApplication,
  ) {
    this.client = client ?? new ConfidentialClientApplication({
      auth: {
        clientId: options.clientId,
        authority: `https://login.microsoftonline.com/${options.tenantId}`,
        clientSecret: options.clientSecret,
      },
      cache: { cachePlugin: createMsalCachePlugin(options.secretStore, options.cacheSecretReference) },
    });
  }

  async createAuthorizationUrl(state: string, _returnTo: string): Promise<string> {
    return this.client.getAuthCodeUrl({
      scopes: this.options.signInScopes ?? GRAPH_SCOPES,
      redirectUri: this.options.redirectUri,
      state,
    });
  }

  async exchangeAuthorizationCode(code: string, state: string): Promise<AuthenticatedPrincipal> {
    const result = await this.client.acquireTokenByCode({
      code,
      redirectUri: this.options.redirectUri,
      scopes: this.options.signInScopes ?? GRAPH_SCOPES,
      state,
    });
    if (!result.account?.homeAccountId || !result.tenantId || !result.uniqueId) {
      throw new Error('Entra did not return a complete account identity.');
    }

    return {
      identity: {
        tenantId: result.tenantId,
        objectId: result.uniqueId,
        displayName: result.account.name ?? result.account.username,
        email: result.account.username,
      },
      tokenCacheReference: result.account.homeAccountId,
    };
  }

  async getGraphAccessToken(tokenCacheReference: string): Promise<string> {
    const account = await this.client.getTokenCache().getAccountByHomeId(tokenCacheReference);
    if (!account) {
      throw new Error('No cached Entra account matches the authenticated session.');
    }

    const result = await this.client.acquireTokenSilent({ account, scopes: GRAPH_SCOPES });
    if (!result?.accessToken) {
      throw new Error('Entra did not return a delegated Microsoft Graph token.');
    }
    return result.accessToken;
  }
}

function statesMatch(expected: string, received: string): boolean {
  const expectedBytes = Buffer.from(expected);
  const receivedBytes = Buffer.from(received);
  return expectedBytes.length === receivedBytes.length && timingSafeEqual(expectedBytes, receivedBytes);
}

function safeReturnTo(value: string): string {
  const base = 'https://cms.invalid';
  const destination = new URL(value, base);
  return destination.origin === base
    ? `${destination.pathname}${destination.search}${destination.hash}`
    : '/dashboard';
}

export class EntraIdentityProvider implements IdentityProvider {
  constructor(
    private readonly client: EntraOAuthClient,
    private readonly createState: () => string = () => randomBytes(32).toString('base64url'),
  ) {}

  async beginSignIn(returnTo: string): Promise<SignInStart> {
    const state = this.createState();
    const safeDestination = safeReturnTo(returnTo);
    const authorizationUrl = await this.client.createAuthorizationUrl(state, safeDestination);
    return { authorizationUrl, state, returnTo: safeDestination };
  }

  async completeSignIn(callback: SignInCallback): Promise<AuthenticatedPrincipal> {
    if (!callback.code || !statesMatch(callback.expectedState, callback.state)) {
      throw new CmsError('authentication-required', 'Sign-in could not be completed.', 401);
    }

    try {
      return await this.client.exchangeAuthorizationCode(callback.code, callback.state);
    } catch {
      throw new CmsError('authentication-required', 'Sign-in could not be completed.', 401);
    }
  }

  async getGraphAccessToken(tokenCacheReference: string): Promise<string> {
    if (!tokenCacheReference) {
      throw new CmsError('authentication-required', 'Sign-in is required.', 401);
    }

    try {
      return await this.client.getGraphAccessToken(tokenCacheReference);
    } catch {
      throw new CmsError('provider-unavailable', 'OneDrive authentication is unavailable.', 502);
    }
  }
}