# Data Model: Fullswing CMS Admin Content Management

## Content Entry

A provider-neutral item visible to CMS workflows. Provider-native paths and IDs are hidden behind the selected storage adapter.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Opaque stable identifier within the selected provider; never interpreted as a filesystem path by UI or use cases. |
| `kind` | `blog` \| `page` | Determines metadata route prefix and available authoring actions. |
| `route` | string | Unique among visible entries; blogs use `/blog/<basename>` and pages use `/page/<basename>` per the Fullswing contract. |
| `title` | string | Required, non-empty metadata. |
| `author` | string | Required, non-empty metadata. |
| `date` | ISO date string | Required real calendar date in `YYYY-MM-DD` format. |
| `categories` | string array | Required, non-empty array; each category is a non-empty string. |
| `body` | string | Markdown for blogs; HTML bytes may be identified/listed for pages but are not editable or rendered in this release. |
| `version` | opaque token | Provider-issued snapshot used for compare-and-save; for a file pair it represents both members. |

`ContentEntry` is a CMS normalized model. The existing shared `BlogEntry`/`PageEntry` types remain static-publisher types because they include local file and compiled-module paths.

## Blog Document Pair

Represents one blog as Markdown body plus JSON metadata. The pair is one logical save even when the provider stores two physical files. Validation runs over the complete candidate before writes begin. A provider returns one of:

- `Saved`: all required content is stored; includes the new opaque version.
- `VersionConflict`: the stored version no longer matches the edit's expected version; includes a safe indication that the administrator must reload/review.
- `PartialWrite`: at least one member changed but the complete pair did not; includes repair state for operator-facing diagnostics and never counts as success.
- `ProviderFailure`: no success is claimed; secret values and raw access tokens are excluded from messages/logs.

No delete operation is part of this feature. HTML editing and saving are deferred.

## Content Storage Configuration

The application has exactly one active provider configuration per deployment.

| Field | Type | Rules |
|---|---|---|
| `providerType` | string discriminator | `onedrive` is the only production value registered by this feature. |
| `providerSettings` | provider-specific object | OneDrive uses non-secret drive/folder identifiers; values are validated before activation. |
| `githubTarget` | owner, repository, workflow ID/file, ref, optional inputs | Persisted non-secret dispatch target; individual trigger requests cannot override it. |
| `revision` | monotonically changed opaque value | Included in editor submissions so a provider switch invalidates forms opened against the previous source. |
| `secretReferences` | secret-store references | Entra credentials, token-cache material, and repository-scoped GitHub token remain server-side and are never returned to the browser. |

Provider selection transition: `active A` -> validate candidate B -> if valid, activate B and leave A untouched; if invalid, keep A active and report configuration failure. No import, merge, copy, or migration occurs.

## Administrator and Session

- **Administrator identity**: Entra tenant ID and immutable object ID, checked against the externally provisioned allowlist after authentication. Email address is display/contact data only, not the authorization key.
- **Authenticated session**: server-side session ID, administrator identity, issued/expiry times, CSRF token, provider configuration revision, and MSAL cache reference. Cookies contain only an opaque session identifier or protected minimal session data; Graph access/refresh tokens are not sent to browser scripts.
- **Session lifecycle**: anonymous -> authenticated after successful state-checked Entra callback and allowlist approval -> expired or logged out; expired/logged-out requests to protected routes return to Login.

## Workflow Dispatch

- **Dispatch request**: an allowlisted administrator's CSRF-protected request to invoke the workflow target stored in integration configuration. Inputs are limited to configured non-secret values.
- **Dispatch result**: `Accepted` with GitHub run ID/URL when returned, or `Rejected` with a non-sensitive reason. `Accepted` means GitHub accepted the dispatch request, not that workflow jobs or deployment completed.
- **Credential**: repository-scoped fine-grained GitHub token with Actions write permission, referenced through the server-side `SecretStore`; only replacement is allowed in the UI, never reveal/readback.

## Authoring State

- **Draft**: edited Markdown and metadata have not been saved.
- **Invalid draft**: validator returns errors; save is disabled/rejected and stored content is unchanged.
- **Ready draft**: Markdown and metadata pass validation; preview is sanitized and save is available.
- **Saved**: provider confirms complete pair save and returns a new version.
- **Conflict**: provider version differs from the draft's expected version; require reload/review before another save.
- **Partial failure**: provider reports an incomplete pair write; show an explicit error and recovery state, never a success state.

## Metadata Validation

Use `@fullswing/content-model` validation for required non-empty `route`, `title`, `author`, `categories`; require at least one non-empty category; validate a real calendar date in `YYYY-MM-DD`; and check route prefix/basename compatibility. CMS adds collection-level duplicate route detection because a route must uniquely identify one visible entry.