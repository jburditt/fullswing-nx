import type { AdminAllowlist, AdministratorIdentity } from './identity-provider.js';

export interface AllowlistedAdministrator {
  tenantId: string;
  objectId: string;
}

function identityKey(identity: AllowlistedAdministrator): string {
  return `${identity.tenantId}:${identity.objectId}`;
}

export class ConfiguredAdminAllowlist implements AdminAllowlist {
  private readonly allowedIdentities: ReadonlySet<string>;

  constructor(entries: readonly AllowlistedAdministrator[]) {
    this.allowedIdentities = new Set(entries.map(identityKey));
  }

  async isAllowed(identity: AdministratorIdentity): Promise<boolean> {
    return this.allowedIdentities.has(identityKey(identity));
  }
}