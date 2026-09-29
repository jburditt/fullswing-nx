export type CmsErrorCode =
  | 'authentication-required'
  | 'access-denied'
  | 'validation-failed'
  | 'not-found'
  | 'version-conflict'
  | 'partial-write'
  | 'provider-unavailable'
  | 'configuration-invalid'
  | 'configuration-conflict'
  | 'rate-limited'
  | 'workflow-dispatch-failed';

export interface ValidationIssue {
  field: string;
  message: string;
}

export class CmsError extends Error {
  constructor(
    readonly code: CmsErrorCode,
    message: string,
    readonly statusCode: number,
  ) {
    super(message);
    this.name = 'CmsError';
  }
}

export class ValidationError extends CmsError {
  constructor(readonly issues: readonly ValidationIssue[]) {
    super('validation-failed', 'Some submitted values are invalid.', 400);
    this.name = 'ValidationError';
  }
}

export class ContentVersionConflictError extends CmsError {
  constructor(readonly currentVersion?: string) {
    super('version-conflict', 'This content changed after it was opened. Reload it before saving.', 409);
    this.name = 'ContentVersionConflictError';
  }
}

export class PartialContentWriteError extends CmsError {
  constructor(readonly diagnosticId: string) {
    super('partial-write', 'The content pair could not be saved completely. Contact an administrator with the diagnostic reference.', 502);
    this.name = 'PartialContentWriteError';
  }
}