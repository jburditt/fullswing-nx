import type { AdministratorIdentity } from './identity-provider.js';

export interface CmsSession {
  id: string;
  identity: AdministratorIdentity;
  tokenCacheReference: string;
  csrfToken: string;
  createdAt: number;
  expiresAt: number;
}

export interface SessionStore {
  get(id: string): Promise<CmsSession | undefined>;
  set(session: CmsSession): Promise<void>;
  delete(id: string): Promise<void>;
}