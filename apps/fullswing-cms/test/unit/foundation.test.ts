import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import { FakeConfigurationStore, FakeContentStorageProvider, FakeSecretStore } from '../support/fakes.js';
import { CmsError } from '../../src/content/domain/content-errors.js';
import { ContentProviderRegistry } from '../../src/content/storage/provider-registry.js';
import { toPublicCmsConfiguration, type CmsConfiguration } from '../../src/config/configuration-store.js';
import { registerErrorHandler } from '../../src/server/error-handler.js';

function sampleConfiguration(): CmsConfiguration {
  return {
    revision: 'revision-1',
    contentProvider: {
      type: 'memory',
      settings: { collection: 'test' },
    },
    githubWorkflow: {
      owner: 'fullswing',
      repository: 'blog',
      workflow: 'publish.yml',
      ref: 'main',
      inputs: {},
      credentialReference: 'github-token-reference',
    },
  };
}

test('ContentProviderRegistry resolves only registered providers and validates configuration', async () => {
  const provider = new FakeContentStorageProvider('memory');
  const registry = new ContentProviderRegistry();
  registry.register('memory', () => provider);

  assert.equal(await registry.resolve({ type: 'memory', revision: 'revision-1', settings: {} }), provider);
  await assert.rejects(
    registry.resolve({ type: 'unknown', revision: 'revision-1', settings: {} }),
    (error: unknown) => error instanceof CmsError && error.code === 'configuration-invalid',
  );
});

test('FakeConfigurationStore rejects writes against a stale revision', async () => {
  const store = new FakeConfigurationStore();
  const saved = await store.save(sampleConfiguration());
  assert.equal(saved.revision, 'test-config-1');

  await assert.rejects(
    store.save(sampleConfiguration(), 'stale-revision'),
    (error: unknown) => error instanceof CmsError && error.code === 'configuration-conflict',
  );
});

test('public configuration omits secret references and reports only whether a credential is configured', () => {
  const publicConfiguration = toPublicCmsConfiguration(sampleConfiguration(), true);
  const serialized = JSON.stringify(publicConfiguration);

  assert.equal(serialized.includes('github-token-reference'), false);
  assert.equal(publicConfiguration.githubWorkflow.credentialConfigured, true);
});

test('error handler does not return an unexpected error message to the caller', async () => {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  app.get('/failure', () => {
    throw new Error('Sensitive token value must not escape');
  });

  const response = await app.inject({ method: 'GET', url: '/failure' });
  await app.close();

  assert.equal(response.statusCode, 500);
  assert.equal(response.body.includes('Sensitive token value'), false);
  assert.equal(response.json().error.code, 'internal-error');
});

test('FakeSecretStore stores values behind references without listing them', async () => {
  const store = new FakeSecretStore();
  await store.set('test-secret', 'secret-value');
  assert.equal(await store.get('test-secret'), 'secret-value');
  await store.delete('test-secret');
  assert.equal(await store.get('test-secret'), undefined);
});