import assert from 'node:assert/strict';
import test from 'node:test';
import { CmsError } from '../../src/content/domain/content-errors.js';
import { validateOneDriveConfiguration } from '../../src/content/storage/onedrive/onedrive-configuration.js';
import type { GraphDriveItem, OneDriveGraphGateway } from '../../src/content/storage/onedrive/onedrive-client.js';
import { ContentProviderRegistry, registerOneDriveProvider } from '../../src/content/storage/provider-registry.js';

class LocationGateway implements OneDriveGraphGateway {
  location?: [string, string];

  async validateLocation(driveId: string, rootFolderId: string): Promise<void> {
    this.location = [driveId, rootFolderId];
  }
  async listChildren() { return []; }
  async readText() { return ''; }
  async writeText(): Promise<GraphDriveItem> { throw new Error('not used'); }
  async deleteItem() {}
}

test('OneDrive settings require non-empty drive and folder identifiers', async () => {
  const graph = new LocationGateway();
  await assert.rejects(validateOneDriveConfiguration({ driveId: ' ', rootFolderId: 'root' }, graph),
    (error: unknown) => error instanceof CmsError && error.code === 'configuration-invalid');
  assert.equal(graph.location, undefined);
});

test('OneDrive settings validate the configured folder through delegated Graph access', async () => {
  const graph = new LocationGateway();
  const validated = await validateOneDriveConfiguration({ driveId: ' drive ', rootFolderId: ' root ' }, graph);
  assert.deepEqual(validated, { driveId: 'drive', rootFolderId: 'root' });
  assert.deepEqual(graph.location, ['drive', 'root']);
});

test('production registry registers OneDrive with its configured revision and delegated gateway', async () => {
  const registry = new ContentProviderRegistry();
  const graph = new LocationGateway();
  let factoryRevision: string | undefined;
  let gatewayTokenCacheReference: string | undefined;
  registerOneDriveProvider(registry, (_settings, revision, context) => {
    factoryRevision = revision;
    gatewayTokenCacheReference = context?.tokenCacheReference;
    return graph;
  });

  const provider = await registry.resolve({
    type: 'onedrive',
    revision: 'config-7',
    settings: { driveId: 'drive', rootFolderId: 'root' },
  }, { tokenCacheReference: 'signed-in-admin-cache' });

  assert.equal(provider.type, 'onedrive');
  assert.equal(factoryRevision, 'config-7');
  assert.equal(gatewayTokenCacheReference, 'signed-in-admin-cache');
  assert.deepEqual(graph.location, ['drive', 'root']);
});