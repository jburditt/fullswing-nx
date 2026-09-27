export interface AdministratorIdentity {
  tenantId: string;
  objectId: string;
  displayName: string;
  email?: string;
}

export interface SignInStart {
  authorizationUrl: string;
  state: string;
  returnTo: string;
}

export interface AuthenticatedPrincipal {
  identity: AdministratorIdentity;
  tokenCacheReference: string;
}

export interface SignInCallback {
  code: string;
  state: string;
  expectedState: string;
}

export interface IdentityProvider {
  beginSignIn(returnTo: string): Promise<SignInStart>;
  completeSignIn(callback: SignInCallback): Promise<AuthenticatedPrincipal>;
  getGraphAccessToken(tokenCacheReference: string): Promise<string>;
}

export interface AdminAllowlist {
  isAllowed(identity: AdministratorIdentity): Promise<boolean>;
}