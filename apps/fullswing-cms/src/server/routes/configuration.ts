import type { FastifyInstance, FastifyRequest } from 'fastify';
import type { ConfigurationService } from '../../config/configuration-service.js';
import { CmsError, type ValidationIssue } from '../../content/domain/content-errors.js';
import type { ConfigurationDraft } from '../../config/configuration-service.js';
import { renderConfigurationPage } from '../../views/configuration.js';

export function registerConfigurationRoutes(app: FastifyInstance, service: ConfigurationService): void {
  app.get('/configuration', async (request, reply) => {
    return reply.type('text/html; charset=utf-8').send(renderConfigurationPage({
      configuration: await service.readPublic(),
      availableProviderTypes: service.availableProviderTypes(),
      csrfToken: request.cmsSession?.csrfToken ?? '',
    }));
  });

  app.post('/configuration', async (request, reply) => {
    let draft: ConfigurationDraft;
    try {
      draft = parseConfigurationDraft(request);
      await service.save(draft, {
        tokenCacheReference: request.cmsSession?.tokenCacheReference ?? '',
      });
    } catch (error) {
      if (!(error instanceof CmsError)) throw error;
      const issues: ValidationIssue[] = [{ field: 'configuration', message: error.message }];
      return reply.code(error.statusCode).type('text/html; charset=utf-8').send(renderConfigurationPage({
        configuration: await service.readPublic(),
        availableProviderTypes: service.availableProviderTypes(),
        csrfToken: request.cmsSession?.csrfToken ?? '',
        issues,
      }));
    }
    return reply.type('text/html; charset=utf-8').send(renderConfigurationPage({
      configuration: await service.readPublic(),
      availableProviderTypes: service.availableProviderTypes(),
      csrfToken: request.cmsSession?.csrfToken ?? '',
      statusMessage: 'Configuration saved.',
    }));
  });
}

function parseConfigurationDraft(request: FastifyRequest): ConfigurationDraft {
  const body = request.body && typeof request.body === 'object'
    ? request.body as Record<string, unknown>
    : {};
  const inputsSource = textValue(body.inputs) ?? '{}';
  let inputs: unknown;
  try {
    inputs = JSON.parse(inputsSource);
  } catch {
    throw new CmsError('configuration-invalid', 'Workflow inputs must be a JSON object.', 400);
  }
  if (!inputs || typeof inputs !== 'object' || Array.isArray(inputs)) {
    throw new CmsError('configuration-invalid', 'Workflow inputs must be a JSON object.', 400);
  }
  return {
    expectedRevision: textValue(body.expectedRevision),
    contentProvider: {
      type: textValue(body.providerType) ?? '',
      settings: {
        driveId: textValue(body.driveId) ?? '',
        rootFolderId: textValue(body.rootFolderId) ?? '',
        publicDirectory: textValue(body.publicDirectory) ?? '',
      },
    },
    githubWorkflow: {
      owner: textValue(body.owner) ?? '',
      repository: textValue(body.repository) ?? '',
      workflow: textValue(body.workflow) ?? '',
      ref: textValue(body.ref) ?? '',
      inputs: inputs as Record<string, string>,
    },
    githubToken: textValue(body.githubToken),
  };
}

function textValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}