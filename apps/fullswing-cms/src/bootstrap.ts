import type { FastifyInstance } from 'fastify';
import type { AdminAllowlist, IdentityProvider } from './auth/identity-provider.js';
import type { SessionStore } from './auth/session-store.js';
import type { ConfigurationStore } from './config/configuration-store.js';
import type { SecretStore } from './config/secret-store.js';
import { CmsError } from './content/domain/content-errors.js';
import { SessionService } from './auth/session-service.js';
import { ConfigurationService } from './config/configuration-service.js';
import { ContentProviderSelection } from './content/application/select-content-provider.js';
import { createDelegatedGraphClient } from './content/storage/onedrive/onedrive-client.js';
import { ContentProviderRegistry, registerOneDriveProvider, type ProviderResolutionContext } from './content/storage/provider-registry.js';
import { GitHubWorkflowDispatchAdapter } from './integrations/github/github-workflow-dispatch.js';
import { createApp } from './server/create-app.js';
import { registerRequestGuards } from './server/request-guards.js';
import { registerAuthRoutes } from './server/routes/auth.js';
import { registerBlogEditorRoutes } from './server/routes/blog-editor.js';
import { registerConfigurationRoutes } from './server/routes/configuration.js';
import { registerDashboardRoutes } from './server/routes/dashboard.js';
import { registerGitHubWorkflowRoutes } from './server/routes/github-workflow.js';
import { registerPageRoutes } from './server/routes/pages.js';

export interface CmsApplicationDependencies {
  configurationStore: ConfigurationStore;
  secretStore: SecretStore;
  identityProvider: IdentityProvider;
  sessionStore: SessionStore;
  allowlist: AdminAllowlist;
  contentProviders: ContentProviderRegistry;
  sessionCookieSecret: string;
  secureCookies: boolean;
}

declare module 'fastify' {
  interface FastifyInstance {
    cmsDependencies: CmsApplicationDependencies;
  }
}

function assertDependencies(dependencies: CmsApplicationDependencies): void {
  const adapters: Array<[string, unknown]> = [
    ['configuration store', dependencies.configurationStore],
    ['secret store', dependencies.secretStore],
    ['identity provider', dependencies.identityProvider],
    ['session store', dependencies.sessionStore],
    ['administrator allowlist', dependencies.allowlist],
    ['content provider registry', dependencies.contentProviders],
  ];
  const missing = adapters.filter(([, adapter]) => adapter === undefined || adapter === null).map(([name]) => name);

  if (missing.length > 0) {
    throw new CmsError('configuration-invalid', `Required CMS services are unavailable: ${missing.join(', ')}.`, 500);
  }
  if (dependencies.sessionCookieSecret.length < 32) {
    throw new CmsError('configuration-invalid', 'The session cookie signing secret is not configured securely.', 500);
  }
}

export async function createCmsApp(dependencies: CmsApplicationDependencies): Promise<FastifyInstance> {
  assertDependencies(dependencies);

  const app = createApp({
    sessionCookieSecret: dependencies.sessionCookieSecret,
    secureCookies: dependencies.secureCookies,
  });
  app.decorate('cmsDependencies', dependencies);
  registerRequestGuards(app, {
    sessions: dependencies.sessionStore,
    allowlist: dependencies.allowlist,
  });

  if (!dependencies.contentProviders.has('onedrive')) {
    registerOneDriveProvider(dependencies.contentProviders, (_settings, _revision, context) => {
      if (!context?.tokenCacheReference) {
        throw new CmsError('authentication-required', 'Sign in to access OneDrive.', 401);
      }
      return createDelegatedGraphClient(() => dependencies.identityProvider.getGraphAccessToken(context.tokenCacheReference));
    });
  }

  const sessions = new SessionService(dependencies.sessionStore);
  const selection = new ContentProviderSelection(dependencies.contentProviders);
  const configurationService = new ConfigurationService(
    dependencies.configurationStore,
    dependencies.secretStore,
    dependencies.contentProviders,
    selection,
  );
  const resolveContentProvider = async (context?: ProviderResolutionContext) => {
    const configuration = await dependencies.configurationStore.read();
    if (!configuration) {
      throw new CmsError('configuration-invalid', 'Configure a content provider before using the dashboard.', 400);
    }
    if (!context?.tokenCacheReference) {
      throw new CmsError('authentication-required', 'Sign in to access content.', 401);
    }
    return dependencies.contentProviders.resolve({
      ...configuration.contentProvider,
      revision: configuration.revision,
    }, context);
  };

  registerAuthRoutes(app, {
    identityProvider: dependencies.identityProvider,
    allowlist: dependencies.allowlist,
    sessions,
    secureCookies: dependencies.secureCookies,
  });
  registerDashboardRoutes(app, { resolveContentProvider });
  registerBlogEditorRoutes(app, {
    resolveContentProvider,
    getConfigRevision: async () => {
      const configuration = await dependencies.configurationStore.read();
      if (!configuration) throw new CmsError('configuration-invalid', 'Configure a content provider before editing blogs.', 400);
      return configuration.revision;
    },
  });
  registerPageRoutes(app, { resolveContentProvider });
  registerConfigurationRoutes(app, configurationService);
  const github = new GitHubWorkflowDispatchAdapter(dependencies.secretStore);
  registerGitHubWorkflowRoutes(app, {
    configurations: dependencies.configurationStore,
    secrets: dependencies.secretStore,
    dispatch: settings => github.dispatch(settings),
  });

  return app;
}

export async function startCms(
  dependencies: CmsApplicationDependencies,
  options: { host?: string; port?: number } = {},
): Promise<FastifyInstance> {
  const app = await createCmsApp(dependencies);
  await app.listen({
    host: options.host ?? process.env.HOST ?? '0.0.0.0',
    port: options.port ?? Number(process.env.PORT ?? 3000),
  });
  return app;
}