import { CmsError, ContentVersionConflictError } from '../../domain/content-errors.js';

export function mapGraphError(error: unknown): CmsError {
  if (error instanceof CmsError) return error;
  const candidate = error as { statusCode?: unknown; code?: unknown } | undefined;
  const status = typeof candidate?.statusCode === 'number' ? candidate.statusCode : undefined;
  if (status === 412) return new ContentVersionConflictError();
  if (status === 401 || status === 403) return new CmsError('access-denied', 'The signed-in administrator cannot access the configured OneDrive content.', 403);
  if (status === 429) return new CmsError('rate-limited', 'OneDrive is temporarily rate limiting requests. Try again shortly.', 429);
  return new CmsError('provider-unavailable', 'OneDrive could not complete the content operation.', 502);
}