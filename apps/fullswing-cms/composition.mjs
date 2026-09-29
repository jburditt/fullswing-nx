import { randomUUID } from 'node:crypto';
import { ConfiguredAdminAllowlist } from './.build/src/auth/admin-allowlist.js';
import { CmsError } from './.build/src/content/domain/content-errors.js';
import { createDemoContentState, DemoContentStorageProvider } from './.build/src/content/storage/demo-content-provider.js';
import { ContentProviderRegistry } from './.build/src/content/storage/provider-registry.js';

class MemoryConfigurationStore {
  constructor(configuration) {
    this.configuration = structuredClone(configuration);
  }

  async read() {
    return this.configuration ? structuredClone(this.configuration) : undefined;
  }

  async save(configuration, expectedRevision) {
    if (this.configuration && expectedRevision !== this.configuration.revision) {
      throw new CmsError('configuration-conflict', 'Configuration changed. Reload it before saving.', 409);
    }

    this.configuration = structuredClone({ ...configuration, revision: randomUUID() });
    return structuredClone(this.configuration);
  }
}

class MemorySecretStore {
  values = new Map();

  async get(reference) {
    return this.values.get(reference);
  }

  async set(reference, value) {
    this.values.set(reference, value);
  }

  async delete(reference) {
    this.values.delete(reference);
  }
}

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

export function createCmsDependencies() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The local CMS composition cannot be used in production.');
  }

  const sessionCookieSecret = process.env.CMS_SESSION_COOKIE_SECRET?.trim()
    || 'local-development-cookie-secret-not-for-production';

  const localIdentity = {
    tenantId: 'local-development',
    objectId: 'local-user',
    displayName: 'Local Developer',
    email: 'local@localhost',
  };

  const secretStore = new MemorySecretStore();
  const configurationStore = new MemoryConfigurationStore({
    revision: 'local-demo-config',
    contentProvider: { type: 'demo', settings: {} },
    githubWorkflow: {
      owner: '', repository: '', workflow: '', ref: '', inputs: {},
      credentialReference: 'local-demo-unconfigured-github-credential',
    },
  });
  const contentProviders = new ContentProviderRegistry();
  const demoContentState = createDemoContentState();
  contentProviders.register('demo', (_settings, revision) => new DemoContentStorageProvider(revision, demoContentState));
  const secureCookies = process.env.CMS_SECURE_COOKIES?.trim().toLowerCase() === 'true';

  return {
    configurationStore,
    secretStore,
    identityProvider: {
      async beginSignIn() {
        return { authorizationUrl: '/dashboard', state: 'local-development', returnTo: '/dashboard' };
      },
      async completeSignIn() {
        return { identity: localIdentity, tokenCacheReference: '' };
      },
      async getGraphAccessToken() {
        throw new CmsError('provider-unavailable', 'OneDrive requires Entra authentication.', 502);
      },
    },
    sessionStore: new MemorySessionStore(),
    allowlist: new ConfiguredAdminAllowlist([localIdentity]),
    contentProviders,
    sessionCookieSecret,
    secureCookies,
    developmentSession: {
      id: 'local-development-session',
      identity: localIdentity,
      tokenCacheReference: '',
      csrfToken: 'local-development-csrf-token',
      createdAt: Date.now(),
      expiresAt: Number.MAX_SAFE_INTEGER,
    },
  };
}