import assert from 'node:assert/strict';
import test from 'node:test';
import {
  GitHubWorkflowDispatchAdapter,
  type CreateWorkflowDispatchRequest,
  type GitHubDispatchResponse,
} from '../../src/integrations/github/github-workflow-dispatch.js';
import { CmsError } from '../../src/content/domain/content-errors.js';
import { FakeSecretStore } from '../support/fakes.js';

class FakeGitHubClient {
  readonly requests: CreateWorkflowDispatchRequest[] = [];
  response: unknown = { status: 204, data: {} };

  readonly actions = {
    createWorkflowDispatch: async (request: CreateWorkflowDispatchRequest): Promise<GitHubDispatchResponse> => {
      this.requests.push(request);
      if (this.response instanceof Error) throw this.response;
      return this.response as GitHubDispatchResponse;
    },
  };
}

function configuration(overrides: Record<string, unknown> = {}) {
  return {
    owner: 'fullswing',
    repository: 'blog',
    workflow: 'publish.yml',
    ref: 'main',
    inputs: { environment: 'production' },
    credentialReference: 'github-secret',
    ...overrides,
  };
}

test('GitHub dispatch reports accepted only after a 204 response and uses saved configuration', async () => {
  const secrets = new FakeSecretStore();
  await secrets.set('github-secret', 'server-side-token');
  const client = new FakeGitHubClient();
  client.response = { status: 204, data: { workflow_run_id: 42, workflow_run_url: 'https://github.test/run/42' } };
  const adapter = new GitHubWorkflowDispatchAdapter(secrets, () => client);

  const result = await adapter.dispatch(configuration());

  assert.deepEqual(result, { status: 'accepted', runId: 42, runUrl: 'https://github.test/run/42' });
  assert.deepEqual(client.requests[0], {
    owner: 'fullswing', repo: 'blog', workflow_id: 'publish.yml', ref: 'main',
    inputs: { environment: 'production' },
  });
});

test('GitHub dispatch rejects missing credentials and invalid refs before the API call', async () => {
  const secrets = new FakeSecretStore();
  const client = new FakeGitHubClient();
  const adapter = new GitHubWorkflowDispatchAdapter(secrets, () => client);

  await assert.rejects(adapter.dispatch(configuration()),
    (error: unknown) => error instanceof CmsError && error.code === 'configuration-invalid');
  await secrets.set('github-secret', 'server-side-token');
  await assert.rejects(adapter.dispatch(configuration({ ref: 'bad ref' })),
    (error: unknown) => error instanceof CmsError && error.code === 'configuration-invalid');
  assert.equal(client.requests.length, 0);
});

test('GitHub dispatch maps credentials, missing workflows, API rejection, and throttling safely', async () => {
  const secrets = new FakeSecretStore();
  await secrets.set('github-secret', 'server-side-token');
  const client = new FakeGitHubClient();
  const adapter = new GitHubWorkflowDispatchAdapter(secrets, () => client);

  client.response = Object.assign(new Error('private GitHub response'), { status: 401 });
  await assert.rejects(adapter.dispatch(configuration()),
    (error: unknown) => error instanceof CmsError && error.code === 'access-denied');
  client.response = Object.assign(new Error('private GitHub response'), { status: 404 });
  await assert.rejects(adapter.dispatch(configuration()),
    (error: unknown) => error instanceof CmsError && error.code === 'not-found');
  client.response = Object.assign(new Error('private GitHub response'), { status: 422 });
  await assert.rejects(adapter.dispatch(configuration()),
    (error: unknown) => error instanceof CmsError && error.code === 'configuration-invalid');
  client.response = Object.assign(new Error('private GitHub response'), { status: 429 });
  await assert.rejects(adapter.dispatch(configuration()),
    (error: unknown) => error instanceof CmsError && error.code === 'rate-limited');
  assert.equal(JSON.stringify(await Promise.allSettled([adapter.dispatch(configuration())])).includes('private GitHub response'), false);
});