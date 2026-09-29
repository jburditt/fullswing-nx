import { Octokit } from '@octokit/rest';
import type { GitHubWorkflowSettings } from '../../config/configuration-store.js';
import type { SecretStore } from '../../config/secret-store.js';
import { CmsError } from '../../content/domain/content-errors.js';
import { validateGitHubWorkflowSettings } from './github-configuration.js';

export interface GitHubDispatchResponse {
  status: number;
  data?: unknown;
}

export interface CreateWorkflowDispatchRequest {
  owner: string;
  repo: string;
  workflow_id: string;
  ref: string;
  inputs?: Record<string, string>;
}

export interface GitHubWorkflowClient {
  actions: {
    createWorkflowDispatch(request: CreateWorkflowDispatchRequest): Promise<GitHubDispatchResponse>;
  };
}

export interface AcceptedWorkflowDispatch {
  status: 'accepted';
  runId?: number;
  runUrl?: string;
}

export type GitHubClientFactory = (token: string) => GitHubWorkflowClient;

export class GitHubWorkflowDispatchAdapter {
  constructor(
    private readonly secrets: SecretStore,
    private readonly createClient: GitHubClientFactory = createOctokitClient,
  ) {}

  async dispatch(settings: GitHubWorkflowSettings): Promise<AcceptedWorkflowDispatch> {
    const validated = validateGitHubWorkflowSettings(settings, settings.credentialReference);
    const token = await this.secrets.get(validated.credentialReference);
    if (!token) throw new CmsError('configuration-invalid', 'The GitHub credential is not configured.', 400);

    try {
      const response = await this.createClient(token).actions.createWorkflowDispatch({
        owner: validated.owner,
        repo: validated.repository,
        workflow_id: validated.workflow,
        ref: validated.ref,
        ...(Object.keys(validated.inputs).length > 0 ? { inputs: { ...validated.inputs } } : {}),
      });
      if (response.status !== 204) {
        throw new CmsError('workflow-dispatch-failed', 'GitHub did not accept the workflow dispatch.', 502);
      }
      const data = response.data as { workflow_run_id?: unknown; workflow_run_url?: unknown } | undefined;
      return {
        status: 'accepted',
        ...(typeof data?.workflow_run_id === 'number' ? { runId: data.workflow_run_id } : {}),
        ...(typeof data?.workflow_run_url === 'string' ? { runUrl: data.workflow_run_url } : {}),
      };
    } catch (error) {
      throw mapGitHubError(error);
    }
  }
}

function createOctokitClient(token: string): GitHubWorkflowClient {
  const octokit = new Octokit({ auth: token });
  return {
    actions: {
      createWorkflowDispatch: async request => octokit.rest.actions.createWorkflowDispatch({ ...request }),
    },
  };
}

function mapGitHubError(error: unknown): CmsError {
  if (error instanceof CmsError) return error;
  const candidate = error as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
  } | undefined;
  const status = typeof candidate?.status === 'number'
    ? candidate.status
    : typeof candidate?.statusCode === 'number'
      ? candidate.statusCode
      : typeof candidate?.response?.status === 'number'
        ? candidate.response.status
        : undefined;
  if (status === 401 || status === 403) return new CmsError('access-denied', 'GitHub rejected the configured credential.', 403);
  if (status === 404) return new CmsError('not-found', 'The configured GitHub workflow was not found.', 404);
  if (status === 422) return new CmsError('configuration-invalid', 'The configured workflow or reference cannot be dispatched.', 400);
  if (status === 429) return new CmsError('rate-limited', 'GitHub is temporarily rate limiting requests. Try again shortly.', 429);
  return new CmsError('workflow-dispatch-failed', 'GitHub could not accept the workflow dispatch.', 502);
}