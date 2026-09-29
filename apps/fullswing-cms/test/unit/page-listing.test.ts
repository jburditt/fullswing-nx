import assert from 'node:assert/strict';
import test from 'node:test';
import type { GraphDriveItem, OneDriveGraphGateway } from '../../src/content/storage/onedrive/onedrive-client.js';
import { OneDriveContentStorageProvider } from '../../src/content/storage/onedrive/onedrive-provider.js';

class HtmlPageGateway implements OneDriveGraphGateway {
  readonly readCalls: string[] = [];

  async validateLocation(): Promise<void> {}
  async listChildren(_driveId: string, parentId: string): Promise<GraphDriveItem[]> {
    if (parentId !== 'root') return [];
    return [
      { id: 'page-html', name: 'landing.html', file: {}, eTag: 'html-v1' },
      { id: 'page-json', name: 'landing.json', file: {}, eTag: 'json-v1' },
    ];
  }
  async readText(_driveId: string, itemId: string): Promise<string> {
    this.readCalls.push(itemId);
    if (itemId === 'page-json') return JSON.stringify({
      route: '/page/landing', title: 'Landing', author: 'Alice', date: '2026-01-02', categories: ['Pages'],
    });
    return '<script>window.executed = true</script>';
  }
  async writeText(): Promise<GraphDriveItem> { throw new Error('writes are not part of the page listing'); }
  async deleteItem(): Promise<void> { throw new Error('deletes are not part of the page listing'); }
}

test('OneDrive identifies HTML pages without reading or executing their body', async () => {
  const gateway = new HtmlPageGateway();
  const provider = new OneDriveContentStorageProvider(gateway, { driveId: 'drive', rootFolderId: 'root' }, 'revision');

  const [entry] = await provider.listEntries();
  const page = await provider.readPage(entry.id);

  assert.equal(entry.kind, 'page');
  assert.equal(page?.metadata.title, 'Landing');
  assert.deepEqual(gateway.readCalls, ['page-json', 'page-json']);
  assert.equal('html' in (page ?? {}), false);
});