import { CmsError } from '../../domain/content-errors.js';
import type { OneDriveGraphGateway } from './onedrive-client.js';
import { mapGraphError } from './onedrive-errors.js';

export interface OneDriveSettings {
  driveId: string;
  rootFolderId: string;
}

export function parseOneDriveSettings(settings: Readonly<Record<string, unknown>>): OneDriveSettings {
  const driveId = settings.driveId;
  const rootFolderId = settings.rootFolderId;
  if (typeof driveId !== 'string' || !driveId.trim() || typeof rootFolderId !== 'string' || !rootFolderId.trim()) {
    throw new CmsError('configuration-invalid', 'OneDrive requires a drive ID and root folder ID.', 400);
  }
  return { driveId: driveId.trim(), rootFolderId: rootFolderId.trim() };
}

export async function validateOneDriveConfiguration(
  settings: Readonly<Record<string, unknown>>,
  graph: OneDriveGraphGateway,
): Promise<OneDriveSettings> {
  const location = parseOneDriveSettings(settings);
  try {
    await graph.validateLocation(location.driveId, location.rootFolderId);
  } catch (error) {
    throw mapGraphError(error);
  }
  return location;
}