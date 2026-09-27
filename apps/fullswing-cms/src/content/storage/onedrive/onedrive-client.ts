import { Client, ResponseType } from '@microsoft/microsoft-graph-client';
import { CmsError } from '../../domain/content-errors.js';
import { mapGraphError } from './onedrive-errors.js';

export interface GraphDriveItem {
  id: string;
  name: string;
  eTag?: string;
  cTag?: string;
  file?: unknown;
  folder?: unknown;
  parentReference?: { id?: string };
}

export interface GraphRequestPort {
  header(name: string, value: string): GraphRequestPort;
  responseType(type: string): GraphRequestPort;
  get(): Promise<unknown>;
  put(content: string): Promise<unknown>;
  delete(): Promise<unknown>;
}

export interface GraphSdkClientPort {
  api(path: string): GraphRequestPort;
}

export interface OneDriveGraphGateway {
  validateLocation(driveId: string, rootFolderId: string): Promise<void>;
  listChildren(driveId: string, parentId: string): Promise<GraphDriveItem[]>;
  readText(driveId: string, itemId: string): Promise<string>;
  writeText(
    driveId: string,
    parentId: string,
    name: string,
    content: string,
    options?: { itemId?: string; expectedETag?: string },
  ): Promise<GraphDriveItem>;
  deleteItem(driveId: string, itemId: string, expectedETag?: string): Promise<void>;
}

export class OneDriveGraphClient implements OneDriveGraphGateway {
  constructor(private readonly client: GraphSdkClientPort) {}

  async validateLocation(driveId: string, rootFolderId: string): Promise<void> {
    const item = await this.client.api(`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(rootFolderId)}`).get();
    if (!isDriveItem(item) || !item.folder) {
      throw new CmsError('configuration-invalid', 'The configured OneDrive root must identify an accessible folder.', 400);
    }
  }

  async listChildren(driveId: string, parentId: string): Promise<GraphDriveItem[]> {
    let nextPath: string | undefined = `/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentId)}/children`;
    const items: GraphDriveItem[] = [];
    const visited = new Set<string>();
    while (nextPath) {
      if (visited.has(nextPath)) {
        throw new CmsError('provider-unavailable', 'OneDrive returned a repeated continuation link.', 502);
      }
      visited.add(nextPath);
      const response: unknown = await this.client.api(nextPath).get();
      if (!response || typeof response !== 'object' || !Array.isArray((response as { value?: unknown }).value)) {
        throw new CmsError('provider-unavailable', 'OneDrive returned an invalid folder listing.', 502);
      }
      for (const item of (response as { value: unknown[] }).value) {
        if (!isDriveItem(item)) {
          throw new CmsError('provider-unavailable', 'OneDrive returned an invalid content item.', 502);
        }
        items.push(item);
      }
      const continuation: unknown = (response as { '@odata.nextLink'?: unknown })['@odata.nextLink'];
      if (continuation !== undefined && typeof continuation !== 'string') {
        throw new CmsError('provider-unavailable', 'OneDrive returned an invalid continuation link.', 502);
      }
      nextPath = continuation;
    }
    return items;
  }

  async readText(driveId: string, itemId: string): Promise<string> {
    const result = await this.client.api(`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/content`)
      .responseType(ResponseType.TEXT)
      .get();
    if (typeof result !== 'string') {
      throw new CmsError('provider-unavailable', 'OneDrive returned content in an unsupported format.', 502);
    }
    return result;
  }

  async writeText(
    driveId: string,
    parentId: string,
    name: string,
    content: string,
    options: { itemId?: string; expectedETag?: string } = {},
  ): Promise<GraphDriveItem> {
    let request = options.itemId
      ? this.client.api(`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(options.itemId)}/content`)
      : this.client.api(`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(parentId)}:/${encodeURIComponent(name)}:/content`);
    if (options.expectedETag) request = request.header('If-Match', options.expectedETag);
    else if (!options.itemId) request = request.header('If-None-Match', '*');
    try {
      const result = await request.put(content);
      if (!isDriveItem(result)) {
        throw new CmsError('provider-unavailable', 'OneDrive did not confirm the content write.', 502);
      }
      return result;
    } catch (error) {
      throw mapGraphError(error);
    }
  }

  async deleteItem(driveId: string, itemId: string, expectedETag?: string): Promise<void> {
    let request = this.client.api(`/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`);
    if (expectedETag) request = request.header('If-Match', expectedETag);
    try {
      await request.delete();
    } catch (error) {
      throw mapGraphError(error);
    }
  }
}

export function createDelegatedGraphClient(getAccessToken: () => Promise<string>): OneDriveGraphClient {
  const client = Client.init({
    authProvider: (done) => {
      getAccessToken().then(token => done(null, token), error => done(error as Error, null));
    },
  });
  return new OneDriveGraphClient(client);
}

function isDriveItem(value: unknown): value is GraphDriveItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<GraphDriveItem>;
  return typeof item.id === 'string' && typeof item.name === 'string';
}