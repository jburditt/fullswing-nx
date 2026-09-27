import type { FastifyInstance } from 'fastify';
import { toPublicCmsConfiguration, type ConfigurationStore, type GitHubWorkflowSettings } from '../../config/configuration-store.js';
import type { SecretStore } from '../../config/secret-store.js';
import type { AcceptedWorkflowDispatch } from '../../integrations/github/github-workflow-dispatch.js';
import { CmsError } from '../../content/domain/content-errors.js';
import { renderConfigurationPage } from '../../views/configuration.js';

export interface GitHubWorkflowRouteDependencies {
  configurations: ConfigurationStore;
  secrets: SecretStore;
  dispatch(settings: GitHubWorkflowSettings): Promise<AcceptedWorkflowDispatch>;
}

export function registerGitHubWorkflowRoutes(
  app: FastifyInstance,
  dependencies: GitHubWorkflowRouteDependencies,
): void {
  app.post('/github/dispatch', async (request, reply) => {
    const configuration = await dependencies.configurations.read();
    if (!configuration) throw new CmsError('configuration-invalid', 'Save the GitHub workflow configuration first.', 400);
    const credentialConfigured = (await dependencies.secrets.get(configuration.githubWorkflow.credentialReference)) !== undefined;
    try {
      const result = await dependencies.dispatch(configuration.githubWorkflow);
      return reply.type('text/html; charset=utf-8').send(renderConfigurationPage({
        configuration: toPublicCmsConfiguration(configuration, credentialConfigured),
        csrfToken: request.cmsSession?.csrfToken ?? '',
        statusMessage: 'Dispatch accepted. The workflow may still be running.',
        statusKind: 'success',
        dispatchRunId: result.runId,
        dispatchRunUrl: result.runUrl,
      }));
    } catch (error) {
      if (!(error instanceof CmsError)) throw error;
      return reply.code(error.statusCode).type('text/html; charset=utf-8').send(renderConfigurationPage({
        configuration: toPublicCmsConfiguration(configuration, true),
        csrfToken: request.cmsSession?.csrfToken ?? '',
        statusMessage: error.message,
        statusKind: 'error',
      }));
    }
  });
}