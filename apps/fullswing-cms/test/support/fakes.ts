import type { ContentMetadata } from '@fullswing/content-model';
import type {
  CmsConfiguration,
  ConfigurationStore,
} from '../../src/config/configuration-store.js';
import type { SecretStore } from '../../src/config/secret-store.js';
import {
  CmsError,
  ContentVersionConflictError,
} from '../../src/content/domain/content-errors.js';
import type {
  BlogContent,
  CmsContentEntry,
  ContentEntrySummary,
  PageContent,
} from '../../src/content/domain/content-entry.js';
import type {
  AdminAllowlist,
  AuthenticatedPrincipal,
  AdministratorIdentity,
  IdentityProvider,
  SignInCallback,
  SignInStart,
} from '../../src/auth/identity-provider.js';
import type { CmsSession, SessionStore } from '../../src/auth/session-store.js';
import type {
  ContentStorageProvider,
  ProviderConfiguration,
  SaveBlogRequest,
} from '../../src/content/storage/content-storage-provider.js';

export const testAdministrator: AdministratorIdentity = {
  tenantId: 'tenant-test',
  objectId: 'admin-test',
  displayName: 'Test Administrator',
  email: 'admin@example.test',
};

export class FakeConfigurationStore implements ConfigurationStore {
  private configuration?: CmsConfiguration;
  private revision = 0;

  constructor(initial?: CmsConfiguration) {
    this.configuration = initial ? structuredClone(initial) : undefined;
  }

  async read(): Promise<CmsConfiguration | undefined> {
    return this.configuration ? structuredClone(this.configuration) : undefined;
  }

  async save(
    configuration: CmsConfiguration,
    expectedRevision?: string,
  ): Promise<CmsConfiguration> {
    if (this.configuration && expectedRevision !== this.configuration.revision) {
      throw new CmsError('configuration-conflict', 'Configuration changed. Reload it before saving.', 409);
    }

    this.revision += 1;
    this.configuration = structuredClone({
      ...configuration,
      revision: `test-config-${this.revision}`,
    });
    return structuredClone(this.configuration);
  }
}

export class FakeSecretStore implements SecretStore {
  private readonly values = new Map<string, string>();

  async get(reference: string): Promise<string | undefined> {
    return this.values.get(reference);
  }

  async set(reference: string, value: string): Promise<void> {
    this.values.set(reference, value);
  }

  async delete(reference: string): Promise<void> {
    this.values.delete(reference);
  }
}

export class FakeSessionStore implements SessionStore {
  private readonly sessions = new Map<string, CmsSession>();

  async get(id: string): Promise<CmsSession | undefined> {
    const session = this.sessions.get(id);
    return session ? structuredClone(session) : undefined;
  }

  async set(session: CmsSession): Promise<void> {
    this.sessions.set(session.id, structuredClone(session));
  }

  async delete(id: string): Promise<void> {
    this.sessions.delete(id);
  }
}

export class FakeAdminAllowlist implements AdminAllowlist {
  private readonly identities: Set<string>;

  constructor(identities: AdministratorIdentity[] = [testAdministrator]) {
    this.identities = new Set(identities.map(identityKey));
  }

  async isAllowed(identity: AdministratorIdentity): Promise<boolean> {
    return this.identities.has(identityKey(identity));
  }
}

function identityKey(identity: AdministratorIdentity): string {
  return `${identity.tenantId}:${identity.objectId}`;
}

export class FakeIdentityProvider implements IdentityProvider {
  private challengeCounter = 0;
  private readonly sessions = new Set<string>();

  constructor(readonly identity: AdministratorIdentity = testAdministrator) {}

  async beginSignIn(returnTo: string): Promise<SignInStart> {
    this.challengeCounter += 1;
    const state = `test-state-${this.challengeCounter}`;
    const authorizationUrl = `https://login.example.test/authorize?state=${encodeURIComponent(state)}&returnTo=${encodeURIComponent(returnTo)}`;
    return { authorizationUrl, state, returnTo };
  }

  async completeSignIn(callback: SignInCallback): Promise<AuthenticatedPrincipal> {
    if (!callback.code || callback.state !== callback.expectedState) {
      throw new CmsError('authentication-required', 'Sign-in could not be completed.', 401);
    }
    return structuredClone({
      identity: structuredClone(this.identity),
      tokenCacheReference: `fake-cache-${this.identity.tenantId}-${this.identity.objectId}`,
    });
  }

  async getGraphAccessToken(tokenCacheReference: string): Promise<string> {
    if (!tokenCacheReference) {
      throw new CmsError('authentication-required', 'Sign-in is required.', 401);
    }
    this.sessions.add(tokenCacheReference);
    return `test-graph-token-${tokenCacheReference}`;
  }
}

export class FakeContentStorageProvider implements ContentStorageProvider {
  readonly type: string;
  private readonly entries = new Map<string, CmsContentEntry>();
  private nextId = 0;
  private nextVersion = 0;

  constructor(type = 'memory', private configurationRevision = 'test-config-1') {
    this.type = type;
  }

  seed(entry: CmsContentEntry): void {
    this.entries.set(entry.id, structuredClone(entry));
  }

  async validateConfiguration(configuration: ProviderConfiguration): Promise<void> {
    if (configuration.type !== this.type) {
      throw new CmsError('configuration-invalid', 'The selected content provider is not supported.', 400);
    }
  }

  async listEntries(): Promise<ContentEntrySummary[]> {
    return [...this.entries.values()].map(entry => ({
      id: entry.id,
      kind: entry.kind,
      route: entry.route,
      metadata: structuredClone(entry.metadata),
      version: entry.version,
    }));
  }

  async readBlog(id: string): Promise<BlogContent | undefined> {
    const entry = this.entries.get(id);
    return entry?.kind === 'blog' ? structuredClone(entry) : undefined;
  }

  async readPage(id: string): Promise<PageContent | undefined> {
    const entry = this.entries.get(id);
    return entry?.kind === 'page' ? structuredClone(entry) : undefined;
  }

  async saveBlog(request: SaveBlogRequest): Promise<BlogContent> {
    if (request.configRevision !== this.configurationRevision) {
      throw new ContentVersionConflictError();
    }

    const current = request.id ? this.entries.get(request.id) : undefined;
    if (request.id && (!current || current.kind !== 'blog')) {
      throw new CmsError('not-found', 'The requested blog was not found.', 404);
    }
    if (request.expectedVersion && current?.version !== request.expectedVersion) {
      throw new ContentVersionConflictError(current?.version);
    }

    this.nextId += 1;
    this.nextVersion += 1;
    const id = current?.id ?? `blog-${this.nextId}`;
    const metadata: BlogContent['metadata'] = {
      ...request.metadata,
      dateValue: new Date(`${request.metadata.date}T00:00:00.000Z`),
    };
    const blog: BlogContent = {
      id,
      kind: 'blog',
      route: current?.route ?? `/blog/${request.basename}`,
      metadata,
      markdown: request.markdown,
      version: `test-version-${this.nextVersion}`,
    };
    this.entries.set(id, structuredClone(blog));
    return structuredClone(blog);
  }

  setConfigurationRevision(revision: string): void {
    this.configurationRevision = revision;
  }
}

export function contentMetadata(overrides: Partial<ContentMetadata> = {}): ContentMetadata {
  return {
    title: 'Test Entry',
    author: 'Test Author',
    date: '2026-01-01',
    categories: ['testing'],
    ...overrides,
  };
}