import assert from 'node:assert/strict';
import test from 'node:test';
import {
  EntraIdentityProvider,
  MsalEntraOAuthClient,
  createMsalCachePlugin,
  type EntraOAuthClient,
} from '../../src/auth/entra-authentication.js';
import { FakeSecretStore } from '../support/fakes.js';
import type {
  AccountInfo,
  AuthenticationResult,
  AuthorizationCodeRequest,
  AuthorizationUrlRequest,
  IConfidentialClientApplication,
  SilentFlowRequest,
  TokenCacheContext,
} from '@azure/msal-node';
import type { AdministratorIdentity } from '../../src/auth/identity-provider.js';

function createClient(identity: AdministratorIdentity) {
  const calls = { authorizationStates: [] as string[], codes: [] as string[], cacheReferences: [] as string[] };
  const client: EntraOAuthClient = {
    async createAuthorizationUrl(state) {
      calls.authorizationStates.push(state);
      return `https://login.microsoftonline.com/authorize?state=${encodeURIComponent(state)}`;
    },
    async exchangeAuthorizationCode(code) {
      calls.codes.push(code);
      return { identity, tokenCacheReference: 'cache-reference-1' };
    },
    async getGraphAccessToken(sessionId) {
      calls.cacheReferences.push(sessionId);
      return 'delegated-test-token';
    },
  };
  return { client, calls };
}

const identity: AdministratorIdentity = {
  tenantId: 'tenant-a',
  objectId: 'object-a',
  displayName: 'CMS Admin',
};

test('beginSignIn creates a unique state value and passes it to Entra', async () => {
  const { client, calls } = createClient(identity);
  const provider = new EntraIdentityProvider(client);
  const first = await provider.beginSignIn('/dashboard');
  const second = await provider.beginSignIn('/dashboard');

  assert.notEqual(first.state, second.state);
  assert.deepEqual(calls.authorizationStates, [first.state, second.state]);
  assert.equal(new URL(first.authorizationUrl).searchParams.get('state'), first.state);
});

test('completeSignIn rejects mismatched state before exchanging the authorization code', async () => {
  const { client, calls } = createClient(identity);
  const provider = new EntraIdentityProvider(client);

  await assert.rejects(
    provider.completeSignIn({ code: 'authorization-code', state: 'returned-state', expectedState: 'stored-state' }),
    /sign-in could not be completed/i,
  );
  assert.deepEqual(calls.codes, []);
});

test('completeSignIn returns the identity from the successfully exchanged code', async () => {
  const { client, calls } = createClient(identity);
  const provider = new EntraIdentityProvider(client);

  const result = await provider.completeSignIn({ code: 'authorization-code', state: 'same-state', expectedState: 'same-state' });

  assert.equal(result.identity.objectId, identity.objectId);
  assert.equal(result.tokenCacheReference, 'cache-reference-1');
  assert.deepEqual(calls.codes, ['authorization-code']);
});

test('Graph access tokens are resolved server-side for the authenticated session', async () => {
  const { client, calls } = createClient(identity);
  const provider = new EntraIdentityProvider(client);

  assert.equal(await provider.getGraphAccessToken('cache-reference-1'), 'delegated-test-token');
  assert.deepEqual(calls.cacheReferences, ['cache-reference-1']);
});

test('MSAL adapter requests the configured delegated scope and resolves the cached account', async () => {
  let authorizationRequest: AuthorizationUrlRequest | undefined;
  let codeRequest: AuthorizationCodeRequest | undefined;
  let silentRequest: SilentFlowRequest | undefined;
  let lookedUpHomeAccountId: string | undefined;
  const account = {
    homeAccountId: 'home-account-1',
    environment: 'login.microsoftonline.com',
    tenantId: 'tenant-a',
    username: 'admin@example.test',
    localAccountId: 'object-a',
    name: 'CMS Admin',
  } satisfies AccountInfo;
  const authenticationResult = {
    account,
    tenantId: 'tenant-a',
    uniqueId: 'object-a',
    accessToken: 'authorization-access-token',
  } as AuthenticationResult;
  const client = {
    async getAuthCodeUrl(request: AuthorizationUrlRequest) {
      authorizationRequest = request;
      return 'https://login.microsoftonline.com/authorize';
    },
    async acquireTokenByCode(request: AuthorizationCodeRequest) {
      codeRequest = request;
      return authenticationResult;
    },
    getTokenCache() {
      return {
        async getAccountByHomeId(homeAccountId: string) {
          lookedUpHomeAccountId = homeAccountId;
          return account;
        },
      };
    },
    async acquireTokenSilent(request: SilentFlowRequest) {
      silentRequest = request;
      return { ...authenticationResult, accessToken: 'delegated-graph-token' };
    },
  } as unknown as IConfidentialClientApplication;
  const adapter = new MsalEntraOAuthClient({
    clientId: 'client-id',
    tenantId: 'tenant-a',
    clientSecret: 'server-only-secret',
    redirectUri: 'https://cms.example.test/auth/callback',
    cacheSecretReference: 'entra-cache',
    secretStore: new FakeSecretStore(),
  }, client);

  assert.equal(await adapter.createAuthorizationUrl('state-1', '/dashboard'), 'https://login.microsoftonline.com/authorize');
  const principal = await adapter.exchangeAuthorizationCode('authorization-code', 'state-1');
  const accessToken = await adapter.getGraphAccessToken(principal.tokenCacheReference);

  assert.deepEqual(authorizationRequest?.scopes, ['Files.ReadWrite']);
  assert.equal(authorizationRequest?.state, 'state-1');
  assert.equal(codeRequest?.state, 'state-1');
  assert.equal(principal.identity.objectId, 'object-a');
  assert.equal(principal.tokenCacheReference, 'home-account-1');
  assert.equal(lookedUpHomeAccountId, 'home-account-1');
  assert.equal(silentRequest?.account.homeAccountId, 'home-account-1');
  assert.equal(accessToken, 'delegated-graph-token');
});

test('MSAL cache plugin restores and persists tokens only through the server-side secret store', async () => {
  const secrets = new FakeSecretStore();
  await secrets.set('entra-cache', 'serialized-before');
  let deserializedCache: string | undefined;
  let serializedCache = 'serialized-after';
  const context = {
    cacheHasChanged: false,
    tokenCache: {
      deserialize(value: string) {
        deserializedCache = value;
      },
      serialize() {
        return serializedCache;
      },
    },
  } as unknown as TokenCacheContext;
  const plugin = createMsalCachePlugin(secrets, 'entra-cache');

  await plugin.beforeCacheAccess(context);
  await plugin.afterCacheAccess(context);
  assert.equal(deserializedCache, 'serialized-before');
  assert.equal(await secrets.get('entra-cache'), 'serialized-before');

  serializedCache = 'serialized-updated';
  const changedContext = {
    ...context,
    cacheHasChanged: true,
  } as unknown as TokenCacheContext;
  await plugin.afterCacheAccess(changedContext);
  assert.equal(await secrets.get('entra-cache'), 'serialized-updated');
});