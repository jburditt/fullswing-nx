import assert from 'node:assert/strict';
import test from 'node:test';
import type {
  GraphDriveItem,
  GraphRequestPort,
  GraphSdkClientPort,
  OneDriveGraphGateway,
} from '../../src/content/storage/onedrive/onedrive-client.js';
import { OneDriveGraphClient } from '../../src/content/storage/onedrive/onedrive-client.js';
import { OneDriveContentStorageProvider } from '../../src/content/storage/onedrive/onedrive-provider.js';

class FakeGraphRequest implements GraphRequestPort {
  private selectedResponseType?: string;

  constructor(private readonly path: string, private readonly responses: Map<string, unknown>, private readonly calls: string[]) {}

  header(): GraphRequestPort { return this; }
  responseType(type: string): GraphRequestPort { this.selectedResponseType = type; return this; }

  async get(): Promise<unknown> {
    this.calls.push(`${this.selectedResponseType ?? 'json'}:${this.path}`);
    const response = this.responses.get(this.path);
    if (response === undefined) throw new Error(`No mocked Graph response for ${this.path}`);
    return response;
  }

  async put(): Promise<unknown> { throw new Error('Unexpected Graph write in listing test.'); }
  async delete(): Promise<unknown> { throw new Error('Unexpected Graph delete in listing test.'); }
}

class FakeGraphSdkClient implements GraphSdkClientPort {
  readonly calls: string[] = [];
  readonly responses = new Map<string, unknown>();

  api(path: string): GraphRequestPort {
    return new FakeGraphRequest(path, this.responses, this.calls);
  }
}

class FakeOneDriveGateway implements OneDriveGraphGateway {
  readonly children = new Map<string, GraphDriveItem[]>();
  readonly contents = new Map<string, string>();
  readonly childCalls: string[] = [];

  async validateLocation(): Promise<void> {}

  async listChildren(_driveId: string, parentId: string): Promise<GraphDriveItem[]> {
    this.childCalls.push(parentId);
    return this.children.get(parentId) ?? [];
  }

  async readText(_driveId: string, itemId: string): Promise<string> {
    const content = this.contents.get(itemId);
    if (content === undefined) throw new Error(`Missing mocked file ${itemId}`);
    return content;
  }

  async writeText(): Promise<GraphDriveItem> { throw new Error('Unexpected Graph write in listing test.'); }
  async deleteItem(): Promise<void> { throw new Error('Unexpected Graph delete in listing test.'); }
}

function file(id: string, name: string, eTag = `etag-${id}`): GraphDriveItem {
  return { id, name, eTag, file: {} };
}

test('OneDriveGraphClient follows every Graph continuation link', async () => {
  const client = new FakeGraphSdkClient();
  const initialPath = '/drives/drive/items/folder/children';
  const nextPath = 'https://graph.microsoft.com/v1.0/drives/drive/items/folder/children?skiptoken=next';
  client.responses.set(initialPath, { value: [file('one', 'one.md')], '@odata.nextLink': nextPath });
  client.responses.set(nextPath, { value: [file('two', 'two.md')] });
  const graph = new OneDriveGraphClient(client);

  const results = await graph.listChildren('drive', 'folder');

  assert.deepEqual(results.map(item => item.id), ['one', 'two']);
  assert.deepEqual(client.calls, [`json:${initialPath}`, `json:${nextPath}`]);
});

test('OneDriveContentStorageProvider recursively discovers matched blog and page pairs', async () => {
  const gateway = new FakeOneDriveGateway();
  gateway.children.set('root', [{ id: 'year-folder', name: '2026', folder: {} }]);
  gateway.children.set('year-folder', [
    file('post-md', 'post.md'),
    file('post-json', 'post.json'),
    file('page-html', 'landing.html'),
    file('page-json', 'landing.json'),
  ]);
  gateway.contents.set('post-json', JSON.stringify({ route: '/blog/post', title: 'Post', author: 'Alice', date: '2026-01-01', categories: ['News'] }));
  gateway.contents.set('page-json', JSON.stringify({ route: '/page/landing', title: 'Landing', author: 'Alice', date: '2026-01-02', categories: ['Pages'] }));
  gateway.contents.set('post-md', '# Blog body');
  const provider = new OneDriveContentStorageProvider(gateway, { driveId: 'drive', rootFolderId: 'root' }, 'config-1');

  const entries = await provider.listEntries();
  const blog = entries.find(entry => entry.kind === 'blog');
  const page = entries.find(entry => entry.kind === 'page');

  assert.equal(entries.length, 2);
  assert.equal(blog?.metadata.route, '/blog/post');
  assert.equal(page?.metadata.route, '/page/landing');
  assert.deepEqual(gateway.childCalls, ['root', 'year-folder']);
  assert.equal(await provider.readBlog(blog!.id).then(entry => entry?.markdown), '# Blog body');
});

test('OneDriveContentStorageProvider rejects orphaned sidecars and duplicate routes', async () => {
  const orphaned = new FakeOneDriveGateway();
  orphaned.children.set('root', [file('lonely-md', 'lonely.md')]);
  const orphanProvider = new OneDriveContentStorageProvider(orphaned, { driveId: 'drive', rootFolderId: 'root' }, 'config-1');
  await assert.rejects(orphanProvider.listEntries(), /missing same-basename/);

  const duplicate = new FakeOneDriveGateway();
  duplicate.children.set('root', [{ id: 'folder-a', name: '2025', folder: {} }, { id: 'folder-b', name: '2026', folder: {} }]);
  duplicate.children.set('folder-a', [file('a-md', 'post.md'), file('a-json', 'post.json')]);
  duplicate.children.set('folder-b', [file('b-md', 'post.md'), file('b-json', 'post.json')]);
  const metadata = JSON.stringify({ route: '/blog/post', title: 'Post', author: 'Alice', date: '2026-01-01', categories: ['News'] });
  duplicate.contents.set('a-json', metadata);
  duplicate.contents.set('b-json', metadata);
  const duplicateProvider = new OneDriveContentStorageProvider(duplicate, { driveId: 'drive', rootFolderId: 'root' }, 'config-1');
  await assert.rejects(duplicateProvider.listEntries(), /duplicate content route/);
});

test('OneDriveContentStorageProvider rejects malformed metadata through shared validation', async () => {
  const gateway = new FakeOneDriveGateway();
  gateway.children.set('root', [file('post-md', 'post.md'), file('post-json', 'post.json')]);
  gateway.contents.set('post-json', '{"route":"/blog/post"}');
  const provider = new OneDriveContentStorageProvider(gateway, { driveId: 'drive', rootFolderId: 'root' }, 'config-1');

  await assert.rejects(provider.listEntries(), /title/);
});

test('OneDriveContentStorageProvider rejects pairs without eTags needed for compare-and-save', async () => {
  const gateway = new FakeOneDriveGateway();
  gateway.children.set('root', [
    { id: 'post-md', name: 'post.md', file: {} },
    file('post-json', 'post.json'),
  ]);
  gateway.contents.set('post-json', JSON.stringify({
    route: '/blog/post', title: 'Post', author: 'Alice', date: '2026-01-01', categories: ['News'],
  }));
  const provider = new OneDriveContentStorageProvider(gateway, { driveId: 'drive', rootFolderId: 'root' }, 'config-1');

  await assert.rejects(provider.listEntries(), /version tags/);
});