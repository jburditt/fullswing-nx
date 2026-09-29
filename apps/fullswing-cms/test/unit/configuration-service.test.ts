import assert from 'node:assert/strict';
import test from 'node:test';
import type { CmsConfiguration, ConfigurationStore } from '../../src/config/configuration-store.js';
import { ConfigurationService } from '../../src/config/configuration-service.js';
import { FakeConfigurationStore, FakeContentStorageProvider, FakeSecretStore } from '../support/fakes.js';
import { ContentProviderSelection } from '../../src/content/application/select-content-provider.js';
import { ContentProviderRegistry } from '../../src/content/storage/provider-registry.js';
import { CmsError } from '../../src/content/domain/content-errors.js';

function initialConfiguration(): CmsConfiguration {
  return {
    revision: 'test-config-0',
    contentProvider: { type: 'memory', settings: {} },
    githubWorkflow: {
      owner: 'fullswing',
      repository: 'blog',
      workflow: 'publish.yml',
      ref: 'main',
      inputs: {},
      credentialReference: 'github-token-old',
    },
  };
}

function setup(store: ConfigurationStore = new FakeConfigurationStore(initialConfiguration())) {
  const secrets = new FakeSecretStore();
  const registry = new ContentProviderRegistry();
  registry.register('memory', (_settings, revision) => new FakeContentStorageProvider('memory', revision));
  const selection = new ContentProviderSelection(registry);
  const service = new ConfigurationService(store, secrets, registry, selection);
  return { secrets, registry, selection, service, store };
}

function validDraft() {
  return {
    expectedRevision: 'test-config-0',
    contentProvider: { type: 'memory', settings: {} },
    githubWorkflow: { owner: 'fullswing', repository: 'blog', workflow: 'publish.yml', ref: 'main', inputs: {} },
    githubToken: 'github-token-new-value',
  };
}

test('configuration service rejects missing provider and workflow fields', async () => {
  const { service } = setup();
  await assert.rejects(service.save({
    ...validDraft(),
    githubWorkflow: { ...validDraft().githubWorkflow, owner: '' },
  }), (error: unknown) => error instanceof CmsError && error.code === 'configuration-invalid');
});

test('configuration persistence failure preserves active provider and removes replacement secret', async () => {
  const backingStore = new FakeConfigurationStore(initialConfiguration());
  const failingStore = {
    read: () => backingStore.read(),
    async save(): Promise<CmsConfiguration> {
      throw new CmsError('provider-unavailable', 'Configuration persistence failed.', 500);
    },
  };
  const { secrets, selection, service } = setup(failingStore);
  const active = await selection.activate({ type: 'memory', revision: 'test-config-0', settings: {} });
  await secrets.set('github-token-old', 'old-token');

  await assert.rejects(service.save(validDraft()));

  assert.equal(selection.active, active);
  assert.deepEqual(await secrets.get('github-token-old'), 'old-token');
  assert.equal(await secrets.get('github-token-new-value'), undefined);
});

test('configuration service replaces secrets and never includes the token in public readback', async () => {
  const { secrets, selection, service } = setup();
  await secrets.set('github-token-old', 'old-token');

  const saved = await service.save(validDraft());
  const publicConfiguration = await service.readPublic();
  const serialized = JSON.stringify(publicConfiguration);

  assert.equal(saved.revision, 'test-config-1');
  assert.equal(publicConfiguration?.githubWorkflow.credentialConfigured, true);
  assert.equal('credentialReference' in (publicConfiguration?.githubWorkflow ?? {}), false);
  assert.equal(serialized.includes('github-token-new-value'), false);
  assert.equal(await secrets.get('github-token-old'), undefined);
  assert.equal(await secrets.get(saved.githubWorkflow.credentialReference), 'github-token-new-value');
  assert.equal(selection.active.type, 'memory');
});