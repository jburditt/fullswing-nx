# Data Model: Fullswing CMS Admin Content Management

## Content Entry

A provider-neutral item visible to CMS workflows. Provider-native paths and IDs are hidden behind the selected storage adapter.

| Field | Type | Rules |
|---|---|---|
| `id` | string | Opaque stable identifier within the selected provider; never interpreted as a filesystem path by UI or use cases. |
| `kind` | `blog` \| `page` | Determines metadata route prefix and available authoring actions. |
| `route` | string | Unique among visible entries; blogs use `/blog/<basename>` unless an older duplicate basename requires a year-prefixed route, and pages use `/page/<basename>`. |
| `title` | string | Required, non-empty metadata. |
| `author` | string | Required, non-empty metadata. |
| `date` | ISO date string | Required real calendar date in `YYYY-MM-DD` format. |
| `categories` | string array | Required, non-empty array; each category is a non-empty string. |
| `body` | string | Markdown source for blogs; HTML source for pages when the active provider supports page writes. HTML is never rendered or executed by the CMS. |
| `version` | opaque token | Provider-issued snapshot used for compare-and-save; for a file pair it represents both members. |

`ContentEntry` is a CMS normalized model. The existing shared `BlogEntry`/`PageEntry` types remain static-publisher types because they include local file and compiled-module paths.

## Blog Document Pair

Represents one blog as Markdown body plus JSON metadata. A local-file provider stores the pair at `<public-directory>/blog/<year>/<basename>.md` and `.json`, with year derived from metadata date. The pair is one logical save even when the provider stores two physical files. Validation runs over the complete candidate before writes begin. A provider returns one of:

- `Saved`: all required content is stored; includes the new opaque version.
- `VersionConflict`: the stored version no longer matches the edit's expected version; includes a safe indication that the administrator must reload/review.
- `PartialWrite`: at least one member changed but the complete pair did not; includes repair state for operator-facing diagnostics and never counts as success.
- `ProviderFailure`: no success is claimed; secret values and raw access tokens are excluded from messages/logs.

No delete operation is part of this feature. HTML source writes are available only through providers that explicitly support page saves.

## Page Source Pair

Represents an HTML source body plus JSON metadata. A local-file provider stores the pair at `<public-directory>/pages/<year>/<basename>.html` and `.json`, with year derived from metadata date. The CMS edits and stores source text only; it does not render or execute the body. Other providers may expose pages as read-only. The current static blog generator does not discover or publish these HTML page pairs.

## Content Storage Configuration

The application has exactly one active provider configuration per deployment.

| Field | Type | Rules |
|---|---|---|
| `providerType` | string discriminator | `blob` is the Azure deployment provider; `onedrive` is optional when registered; `file` and `demo` support development. |
| `providerSettings` | provider-specific object | Blob uses a content prefix (default `content`); OneDrive uses non-secret drive/folder identifiers; local-file storage uses a writable website public-directory path; values are validated before activation. |
| `githubTarget` | owner, repository, workflow ID/file, ref, optional inputs | Persisted non-secret dispatch target; individual trigger requests cannot override it. |
| `revision` | monotonically changed opaque value | Included in editor submissions so a provider switch invalidates forms opened against the previous source. |
| `secretReferences` | secret-store references | Entra credentials, token-cache material, and repository-scoped GitHub token remain server-side and are never returned to the browser. |

Provider selection transition: `active A` -> validate candidate B -> if valid, activate B and leave A untouched; if invalid, keep A active and report configuration failure. No import, merge, copy, or migration occurs.

## Runtime Persistence

Runtime configuration, secrets, and sessions use separate CMS-owned store ports. The Azure Blob composition supplies these implementations:

| Store | Azure composition behavior | Durability and security |
|---|---|---|
| `ConfigurationStore` | Stores the current `CmsConfiguration` as JSON in `configuration.json`; uses the Blob ETag and conditional writes to prevent stale or racing updates. | Persists across process restarts; contains non-secret settings and secret references only. |
| `SecretStore` | Stores one versioned envelope per secret reference under the `secrets/` prefix. The envelope contains a random 96-bit nonce, AES-GCM authentication tag, and ciphertext, encoded as base64. The reference is authenticated as additional data. | Plaintext is returned only to server-side callers. The 32-byte encryption key comes from `CMS_SECRET_ENCRYPTION_KEY`, outside Blob Storage. Losing the key makes existing secrets unreadable; key rotation requires re-encryption. |
| `SessionStore` | Stores sessions in process memory. | Sessions do not survive a process restart; affected administrators must sign in again. |
| `BlobContentStorageProvider` | Stores Markdown/JSON pairs at `content/blog/<YYYY>/<basename>.md` and `.json`; stores HTML/JSON pairs at `content/pages/<YYYY>/<basename>.html` and `.json`. | Uses Blob ETags for opaque versions and conditional writes. Pair writes are not transactional; failed compensation is reported as a partial write. |

The Blob container must be private and access restricted to the CMS. Content is isolated under its prefix from `configuration.json` and the `secrets/` prefix. The composition creates the configured container when absent. Replacing Blob or changing secret-management technology must be done behind the `ContentStorageProvider`, `ConfigurationStore`, and `SecretStore` interfaces; application services do not depend on Azure SDK types.

## Administrator and Session

- **Administrator identity**: Entra tenant ID and immutable object ID, checked against the externally provisioned allowlist after authentication. Email address is display/contact data only, not the authorization key.
- **Authenticated session**: server-side session ID, administrator identity, issued/expiry times, CSRF token, provider configuration revision, and MSAL cache reference. Cookies contain only an opaque session identifier or protected minimal session data; Graph access/refresh tokens are not sent to browser scripts.
- **Session lifecycle**: anonymous -> authenticated after successful state-checked Entra callback and allowlist approval -> expired or logged out; expired/logged-out requests to protected routes return to Login.
- **Azure session durability**: the current Blob composition keeps session records in memory, even though its MSAL token cache is persisted through the encrypted secret store. A restart clears sessions and requires sign-in again.

## Workflow Dispatch

- **Dispatch request**: an allowlisted administrator's CSRF-protected request to invoke the workflow target stored in integration configuration. Inputs are limited to configured non-secret values.
- **Dispatch result**: `Accepted` with GitHub run ID/URL when returned, or `Rejected` with a non-sensitive reason. `Accepted` means GitHub accepted the dispatch request, not that workflow jobs or deployment completed.
- **Credential**: repository-scoped fine-grained GitHub token with Actions write permission, referenced through the server-side `SecretStore`; only replacement is allowed in the UI, never reveal/readback.

## Authoring State

- **Draft**: edited blog Markdown or page HTML source and metadata have not been saved.
- **Invalid draft**: metadata or blog validation returns errors; save is rejected and stored content is unchanged.
- **Ready blog draft**: Markdown and metadata pass validation; preview is sanitized and save is available.
- **Ready page draft**: page metadata is valid and the provider supports page saves; HTML remains source text and is not previewed or executed.
- **Saved**: provider confirms complete pair save and returns a new version.
- **Conflict**: provider version differs from the draft's expected version; require reload/review before another save.
- **Partial failure**: provider reports an incomplete pair write; show an explicit error and recovery state, never a success state.

## Metadata Validation

Use `@fullswing/content-model` validation for required non-empty `title`, `author`, and `categories`; require at least one non-empty category; validate a real calendar date in `YYYY-MM-DD`; and derive routes from content kind/basename. CMS adds collection-level duplicate route detection because a route must uniquely identify one visible entry. File provider IDs include content kind, year, and basename so same-name blog entries in different years remain addressable.