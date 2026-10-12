import { BlobServiceClient } from '@azure/storage-blob';
import { ConfiguredAdminAllowlist } from './.build/src/auth/admin-allowlist.js';
import { EntraIdentityProvider, MsalEntraOAuthClient } from './.build/src/auth/entra-authentication.js';
import { EntraMcpAuthenticator } from './.build/src/auth/mcp-authentication.js';
import { BlobConfigurationStore, EncryptedBlobSecretStore } from './.build/src/config/blob-stores.js';
import { BlobContentStorageProvider } from './.build/src/content/storage/blob-content-provider.js';
import { ContentProviderRegistry } from './.build/src/content/storage/provider-registry.js';
import { CmsError } from './.build/src/content/domain/content-errors.js';

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
  const allowAnonymousMcp = process.env.NODE_ENV !== 'production'
    && process.env.CMS_MCP_ALLOW_ANONYMOUS?.trim().toLowerCase() === 'true';
  let authenticator;
  const rawResourceUrl = process.env.CMS_MCP_RESOURCE_URL?.trim() || 'https://localhost:3000/mcp';
  const tenantId = process.env.CMS_ENTRA_TENANT_ID?.trim();
  const clientId = process.env.CMS_ENTRA_CLIENT_ID?.trim();
  const adminObjectIdsRaw = process.env.CMS_ADMIN_OBJECT_IDS?.trim();

  let allowlist;
  if (adminObjectIdsRaw && tenantId) {
    const adminObjectIds = adminObjectIdsRaw
      .split(',')
      .map(objectId => objectId.trim())
      .filter(Boolean);
    allowlist = new ConfiguredAdminAllowlist(adminObjectIds.map(objectId => ({ tenantId, objectId })));
  } else {
    allowlist = new ConfiguredAdminAllowlist([]);
  }

  if (!allowAnonymousMcp && tenantId && clientId
    && adminObjectIdsRaw?.split(',').some(objectId => objectId.trim())) {
    authenticator = new EntraMcpAuthenticator({
      tenantId,
      clientId,
      resourceUrl: rawResourceUrl,
      allowlist,
    });
  } else if (!allowAnonymousMcp) {
    throw new Error('CMS_ENTRA_TENANT_ID, CMS_ENTRA_CLIENT_ID, and CMS_ADMIN_OBJECT_IDS are required unless CMS_MCP_ALLOW_ANONYMOUS=true.');
  }

  const clientSecret = process.env.CMS_ENTRA_CLIENT_SECRET?.trim();
  const redirectUri = process.env.CMS_ENTRA_REDIRECT_URI?.trim();
  let oauthClient;
  if (clientId && tenantId && clientSecret && redirectUri) {
    oauthClient = new MsalEntraOAuthClient({
      clientId,
      tenantId,
      clientSecret,
      redirectUri,
      signInScopes: ['openid', 'profile', 'email'],
      cacheSecretReference: 'entra-msal-token-cache',
      secretStore,
    });
  } else {
    oauthClient = {
      async beginSignIn() {
        throw new Error('Entra authentication is not fully configured.');
      },
      async completeSignIn() {
        throw new Error('Entra authentication is not fully configured.');
      },
    };
  }

  return {
    configurationStore,
    secretStore,
    sessionStore: new MemorySessionStore(),
    identityProvider: new EntraIdentityProvider(oauthClient),
    allowlist,
    contentProviders,
    registerOneDrive: false,
    mcp: {
      authenticator,
      allowAnonymous: allowAnonymousMcp,
      resourceUrl: rawResourceUrl,
      async resolveBlogSource() {
        const configuration = await configurationStore.read();
        if (!configuration) {
          throw new CmsError('configuration-invalid', 'Configure Blob content storage before using MCP.', 503);
        }
        const provider = await contentProviders.resolve({
          ...configuration.contentProvider,
          revision: configuration.revision,
        });
        if (!('listBlogs' in provider) || typeof provider.listBlogs !== 'function') {
          throw new CmsError('configuration-invalid', 'The active content provider cannot search blog content.', 503);
        }
        return {
          listBlogs: () => provider.listBlogs(),
          readBlog: id => provider.readBlog(id),
        };
      },
    },
    sessionCookieSecret: requiredSetting('CMS_SESSION_COOKIE_SECRET'),
    secureCookies: true,
  };
}