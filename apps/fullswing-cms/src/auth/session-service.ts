import { randomBytes } from 'node:crypto';
import type { AuthenticatedPrincipal } from './identity-provider.js';
import type { CmsSession, SessionStore } from './session-store.js';

export interface SessionServiceOptions {
  ttlMilliseconds?: number;
  now?: () => number;
  createId?: () => string;
  createCsrfToken?: () => string;
}

export class SessionService {
  private readonly ttlMilliseconds: number;
  private readonly now: () => number;
  private readonly createId: () => string;
  private readonly createCsrfToken: () => string;

  constructor(
    private readonly store: SessionStore,
    options: SessionServiceOptions = {},
  ) {
    this.ttlMilliseconds = options.ttlMilliseconds ?? 8 * 60 * 60 * 1000;
    this.now = options.now ?? Date.now;
    this.createId = options.createId ?? (() => randomBytes(32).toString('base64url'));
    this.createCsrfToken = options.createCsrfToken ?? (() => randomBytes(32).toString('base64url'));
  }

  async create(principal: AuthenticatedPrincipal): Promise<CmsSession> {
    const createdAt = this.now();
    const session: CmsSession = {
      id: this.createId(),
      identity: structuredClone(principal.identity),
      tokenCacheReference: principal.tokenCacheReference,
      csrfToken: this.createCsrfToken(),
      createdAt,
      expiresAt: createdAt + this.ttlMilliseconds,
    };
    await this.store.set(session);
    return structuredClone(session);
  }

  async get(id: string): Promise<CmsSession | undefined> {
    const session = await this.store.get(id);
    if (!session) {
      return undefined;
    }
    if (session.expiresAt <= this.now()) {
      await this.store.delete(id);
      return undefined;
    }
    return session;
  }

  async destroy(id: string): Promise<void> {
    await this.store.delete(id);
  }
}