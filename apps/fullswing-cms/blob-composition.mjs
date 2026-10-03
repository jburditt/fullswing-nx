import { BlobServiceClient } from '@azure/storage-blob';
import { ConfiguredAdminAllowlist } from './.build/src/auth/admin-allowlist.js';
import { EntraIdentityProvider, MsalEntraOAuthClient } from './.build/src/auth/entra-authentication.js';
import { BlobConfigurationStore, EncryptedBlobSecretStore } from './.build/src/config/blob-stores.js';
import { BlobContentStorageProvider } from './.build/src/content/storage/blob-content-provider.js';
import { ContentProviderRegistry } from './.build/src/content/storage/provider-registry.js';

class MemorySessionStore {
  sessions = new Map();

  async get(id) {
    const session = this.sessions.get(id);
    return session ? structuredClone(session) : undefined;
  }

  async set(session) {
    this.sessions.set(session.id, structuredClone(session));
  }

  async delete(id) {
    this.sessions.delete(id);
  }
}

function requiredSetting(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

export async function createCmsDependencies() {
  const connectionString = requiredSetting('CMS_BLOB_CONNECTION_STRING');
  const encryptionKey = Buffer.from(requiredSetting('CMS_SECRET_ENCRYPTION_KEY'), 'base64');
  if (encryptionKey.length !== 32) {
    throw new Error('CMS_SECRET_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  }

  const blobService = BlobServiceClient.fromConnectionString(connectionString);
  const container = blobService.getContainerClient(process.env.CMS_BLOB_CONTAINER_NAME?.trim() || 'fullswing-cms-state');
  await container.createIfNotExists();

  const configurationStore = new BlobConfigurationStore(container);
  const secretStore = new EncryptedBlobSecretStore(container, encryptionKey);
  const contentProviders = new ContentProviderRegistry();
  contentProviders.register('blob', (settings, revision) => new BlobContentStorageProvider(
    container,
    revision,
    typeof settings.contentPrefix === 'string' ? settings.contentPrefix : 'content',
  ));
  const tenantId = requiredSetting('CMS_ENTRA_TENANT_ID');
  const adminObjectIds = requiredSetting('CMS_ADMIN_OBJECT_IDS')
    .split(',')
    .map(objectId => objectId.trim())
    .filter(Boolean);
  if (adminObjectIds.length === 0) throw new Error('CMS_ADMIN_OBJECT_IDS must include at least one object ID.');

  const oauthClient = new MsalEntraOAuthClient({
    clientId: requiredSetting('CMS_ENTRA_CLIENT_ID'),
    tenantId,
    clientSecret: requiredSetting('CMS_ENTRA_CLIENT_SECRET'),
    redirectUri: requiredSetting('CMS_ENTRA_REDIRECT_URI'),
    signInScopes: ['openid', 'profile', 'email'],
    cacheSecretReference: 'entra-msal-token-cache',
    secretStore,
  });

  return {
    configurationStore,
    secretStore,
    sessionStore: new MemorySessionStore(),
    identityProvider: new EntraIdentityProvider(oauthClient),
    allowlist: new ConfiguredAdminAllowlist(adminObjectIds.map(objectId => ({ tenantId, objectId }))),
    contentProviders,
    registerOneDrive: false,
    sessionCookieSecret: requiredSetting('CMS_SESSION_COOKIE_SECRET'),
    secureCookies: true,
  };
}