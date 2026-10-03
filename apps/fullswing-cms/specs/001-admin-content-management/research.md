# Research: Fullswing CMS Admin Content Management

**Date**: 2026-09-26
**Branch**: `001-admin-content-management`

## Decisions

### Provider boundary and shared content model

**Decision**: Put a semantic `ContentStorageProvider` port and provider registry in `apps/fullswing-cms`. Inject the selected provider into CMS use cases at application startup. The Azure deployment composition registers Blob Storage as its sole content provider. OneDrive remains an optional adapter for compositions that register it; local-file and in-memory demo providers support development. Do not implement Google Drive, a database provider, or cross-provider copying in this feature.

**Rationale**: Provider-specific IDs, paging, API errors, and concurrency tokens must stop at the adapter boundary. A semantic blog-pair save works for both file-based and record-based stores and avoids making CMS workflows depend on path or Graph concepts. The existing `ContentRepository` is not a database adapter: it accepts already loaded entries and its public entry types include static-publisher paths (`markdownPath`, `metadataPath`, `modulePath`). The shared behavior that is appropriate for reuse is metadata validation, not CMS persistence.

**Alternatives considered**: Injecting Azure or OneDrive into route handlers (rejected because every workflow would become provider-specific); adding persistence methods to `ContentRepository` (rejected because its path-bound read model is not an I/O abstraction); treating local files as the Azure deployment authority (rejected because local mode is a development composition).

### Local file layout and page source editing

**Decision**: The local development provider uses a configurable existing writable website `public` directory. Blog pairs use `blog/<year>/<basename>.md` plus `.json`, and HTML page pairs use `pages/<year>/<basename>.html` plus `.json`, where the year is derived from metadata date. HTML source can be edited and saved but is never rendered by the CMS. The current static blog generator does not consume the page pairs.

**Rationale**: Blog files must remain discoverable by the existing publisher. Year-based directories are already part of its source layout. Keeping page source in a separate `pages` tree avoids confusing it with published `.ts` renderers and avoids implying that saving HTML makes it publishable or executable.

**Operational constraint**: `file-composition.mjs` is local-development-only and still uses in-memory configuration, session, and secret stores. The public-directory selection resets on restart; content files remain on disk.

### Azure Blob content and runtime persistence

**Decision**: Add a Blob-backed content provider and Azure deployment composition without coupling application services to Azure. `BlobContentStorageProvider` stores matched content pairs below the configured prefix (default `content/`): blog Markdown/JSON under `blog/<YYYY>/` and page HTML/JSON under `pages/<YYYY>/`. Pair eTags supply opaque versions and conditional writes; compensation is attempted when a two-blob write cannot complete. `BlobConfigurationStore` writes versioned configuration JSON with ETag conditional updates. `EncryptedBlobSecretStore` implements the existing `SecretStore` port and encrypts every secret value with AES-256-GCM, a fresh 96-bit nonce, and the secret reference as authenticated additional data before writing an envelope to Blob Storage. The key is a separately configured base64-encoded 32-byte host setting. The composition uses an in-memory `SessionStore` and registers no OneDrive provider.

**Rationale**: Blob Storage is the single content and runtime-state authority for this Azure deployment. Keeping content, configuration, and secret access behind their existing CMS-owned ports avoids making authoring services Azure-specific. Other compositions can register OneDrive without changing CMS workflows. Keeping `SecretStore` unchanged allows a future vault implementation to replace it. Authenticated encryption prevents Blob contents alone from revealing saved GitHub credentials or the serialized MSAL cache. Volatile sessions are an explicit deployment tradeoff: restart requires a fresh administrator sign-in.

**Operational constraints**: `blob-composition.mjs` reads its Blob connection string, encryption key, Entra client settings, administrator object IDs, and cookie secret from the host environment. It creates the named container if absent; the container must remain private and access must be restricted to the CMS. Content is isolated under its prefix from the `configuration.json` object and `secrets/` prefix in the same container. The composition requests only Entra identity scopes (`openid`, `profile`, `email`), not Microsoft Graph file permissions. The encryption key must be backed up separately. Losing it makes stored secrets unreadable; rotating it requires decrypting and re-encrypting existing secrets. This composition does not provision or select the Node host, storage account, or HTTPS endpoint; the GitHub workflows provision hosting and sync blog content before the static build.

**Alternatives considered**: Storing secrets as plaintext Blobs (rejected because storage access alone would reveal them); putting the encryption key beside ciphertext (rejected because it would defeat the separation); coupling services directly to Azure APIs or Key Vault (rejected to preserve the `SecretStore` swap boundary); persisting sessions in Blob Storage (deferred because in-memory sessions are explicitly acceptable for the current deployment).

**Content consistency**: Azure Blob does not provide an atomic transaction across the Markdown/HTML body and JSON metadata blobs. Creates use conditional nonexistence checks; updates use each blob's ETag and attempt compensation if the second write fails. If compensation or a move cleanup fails, the provider returns an explicit partial-write error rather than claiming success.

### Azure App Service and static publishing

**Decision**: Host Fastify on Linux App Service F1 in `rg-fullswing-cms` and keep the persistent Blob content account in a dedicated `rg-fullswing-content`; leave the static-site resource group `rg-fullswing-blog` unchanged. A manual GitHub Actions workflow provisions/deploys the CMS with federated Azure login. The existing static-blog workflow uses its OIDC principal with container-scoped read access to list/download the Blob blog prefix before `azd deploy` runs the repository-based static build.

**Rationale**: App Service can run the current Node/Fastify server without converting routes to Functions. A dedicated persistent-content resource group protects the Blob account from both CMS and blog app lifecycle changes, while the current blog `azd down` remains scoped to `rg-fullswing-blog`. GitHub OIDC and data-plane RBAC avoid storing a storage key in the static-blog workflow.

**Operational constraints**: F1 is a shared, quota-limited plan without custom domains or SLA; restarts lose in-memory sessions. Blob content is first seeded only when explicitly requested and only if the blog prefix is empty. The static sync downloads to a staging directory, validates complete Markdown/JSON pairs, then swaps the local blog directory so a failed or empty fetch cannot publish stale/partial output. The Blob free offer is limited to its published first-12-month eligibility; budgets must account for later charges.

**Build/deploy implementation**: The manual CMS workflow runs tests and compiles `content-model`, `markdown-renderer`, and CMS before packaging their production runtime files. It disables App Service remote build and starts `apps/fullswing-cms/.build/src/index.js` directly from the package root. The static workflow uses Azure CLI `download` calls after OIDC login rather than relying on an ambiguous local path mapping from `download-batch`; the sync script strips `content/blog/`, stages each validated file, and atomically replaces `public/blog` only after every download succeeds.

**Open deployment gate**: Live provisioning is not verified in this repository session. The GitHub repository must define the listed vars/secrets, the Entra application must have the generated callback URL, and the federated principal must be able to create resource groups and the container-scoped role assignment. The F1/Blob resources and first seed must then be exercised with a manual workflow run before enabling unattended deployments.

### Metadata compatibility

**Decision**: Add a pure JSON-string/object parsing and validation function to `@fullswing/content-model`; make the existing `loadMetadata(filePath)` read the file and delegate to it. CMS providers supply metadata content plus a stable source label to the pure function. Keep the required fields and `YYYY-MM-DD` validation in one shared place.

**Rationale**: The current `loadMetadata()` reads from the local filesystem, so using it directly from a OneDrive response would either duplicate rules or introduce temporary files. A pure parser keeps both apps on the same content contract without moving OneDrive into the shared package.

**Alternatives considered**: Duplicate metadata rules in CMS (rejected by Constitution Principle I); download remote JSON to a temporary path just to call `loadMetadata()` (rejected as unnecessary filesystem coupling).

### Markdown preview

**Decision**: Extract `apps/fullswing-blog/src/lib/markdown.ts` into a dedicated `libs/markdown-renderer` package and make both apps consume it. Preserve the current Marked/Prism behavior and bounded, allow-listed remote code-fence fetching. Sanitize rendered output at the CMS preview boundary before inserting it into the page; do not make provider or authoring workflows depend on renderer internals.

**Rationale**: A second Markdown implementation could make preview differ from published output. The current renderer escapes code and validates remote source hosts, but Marked does not sanitize authored raw HTML by itself. The CMS constitution requires a preview that cannot execute untrusted author content, so the CMS preview needs an explicit sanitizer boundary.

**Alternatives considered**: Import the blog app's renderer directly (rejected because an app must not become a dependency of a sibling app); duplicate a minimal CMS renderer (rejected because preview/published behavior would drift); move presentation code into `content-model` (rejected because that package owns content-domain behavior, not HTML rendering).

### HTTP and page delivery

**Decision**: Use a Fastify Node server with server-rendered HTML forms and progressive browser enhancements. Svelte web components remain optional and are not required for login, dashboard, filtering, editing, validation, preview, or configuration.

**Rationale**: The feature is a protected administrative web application, not a static-site build step or a browser-only app. Server-side route guards keep authorization and secrets out of the client; server-rendered forms work without Svelte.

**Alternatives considered**: A client-only SPA (rejected because it moves more authorization and token handling to the browser); extending the static blog generator (rejected because its filesystem discovery, public layout, and build lifecycle are publisher-specific).

### Microsoft Entra authentication and optional OneDrive access

**Decision**: Use the Microsoft Entra authorization-code web-app flow through the supported MSAL Node library, check the configured allowlist using the immutable `(tenantId, objectId)` identity pair, and keep the MSAL cache and session data server-side. The Azure Blob composition requests `openid`, `profile`, and `email` only; it does not request Microsoft Graph file permissions. Compositions that register OneDrive request delegated `Files.ReadWrite`, configure `driveId` and root `folderId` separately from Entra credentials, and report a non-sensitive integration error if an allowlisted administrator lacks access. No composition requests app-only file permissions.

**Rationale**: The auth-code flow is intended for server-based web apps. When OneDrive is enabled, delegated access uses the signed-in administrator's drive permissions rather than granting an app independent tenant-wide file access. Microsoft recommends supported authentication libraries instead of hand-crafting protocol requests. The app must still validate `state`, use the library's OIDC protections, protect CSRF-sensitive writes, and never expose tokens.

**Alternatives considered**: App-only Graph permissions (not selected because file permissions operate independently of the signed-in administrator and require tenant authorization); browser-held Graph tokens (rejected because the app is server-rendered and tokens must remain server-side); raw OAuth HTTP requests (rejected in favor of MSAL).

**Operational constraint**: The Azure composition persists the MSAL cache through the encrypted Blob `SecretStore` but does not persist sessions. The feature supplies a Blob-backed composition, not a complete Azure Node-host deployment or infrastructure provisioning.

### GitHub workflow dispatch

**Decision**: Add a CMS-local GitHub workflow-dispatch port with an `@octokit/rest` adapter. Configuration identifies one repository owner/name, workflow ID or file name, ref, optional non-secret workflow inputs, and a server-side credential reference. Use a fine-grained personal access token limited to the target repository with Actions write permission. Store the token through the deployment-provided `SecretStore`; the browser can replace a token but can never read it back. Trigger only the saved target, require the workflow to declare `workflow_dispatch`, and show accepted dispatch (including run ID/URL where GitHub returns it) separately from workflow completion.

**Rationale**: GitHub's REST endpoint accepts the repository, workflow, ref, and configured inputs and requires a `workflow_dispatch` trigger. Fine-grained tokens have a repository Actions write permission for this endpoint, avoiding classic `repo` scope. Keeping the API client behind an adapter makes authorization, rate limits, and error handling independently testable.

**Alternatives considered**: External caller only (rejected by clarification); generic administrator-supplied URL/target per request (rejected because a trigger must not become an arbitrary repository/workflow proxy); broad classic `repo` token (rejected in favor of one-repository Actions write permission); monitoring runs until completion (out of scope and unnecessary to confirm dispatch acceptance).

### Graph traversal, versions, and paired writes

**Decision**: Keep Microsoft Graph v1.0 calls in the OneDrive adapter. Enumerate nested folders and follow every `@odata.nextLink`; retain each item's opaque ID and eTag internally. Map HTTP 412 precondition failures to the provider-neutral version-conflict error. Save a blog as a logical Markdown/metadata pair; validate the entire pair before writing, use conditional writes where Graph supports them, and attempt compensation if one side fails. Any remaining partial state is returned as an explicit partial-write error and is never reported as success.

**Rationale**: Graph folder listing is paginated, and item eTags support conditional updates. A blog pair comprises two independent DriveItems, so the adapter cannot claim a remote transaction that Graph does not provide. An explicit partial state is safer than hiding an inconsistent source.

**Alternatives considered**: Assume folder listing is one response (rejected because Graph returns continuation links); treat two file writes as atomic (rejected because they are separate Graph operations); silently overwrite newer content (rejected by FR-012).

**Verification note**: The Graph file-content upload endpoint's conditional-write behavior must be proven by an adapter test against a configured test drive. If the endpoint does not enforce the expected eTag, the OneDrive adapter must use a supported conditional operation or reject stale writes rather than claiming compare-and-save guarantees.

## Repository Findings

- `apps/fullswing-cms` is currently a NodeNext TypeScript package with only a placeholder entry point, native `node:test`, and a dependency on `@fullswing/content-model`.
- `libs/content-model/src/metadata.ts` currently combines filesystem reading with pure metadata validation; its parsing rules are suitable for both apps after separating the input boundary.
- `libs/content-model/src/repository.ts` sorts and indexes already loaded entries; it does not perform persistence and its entry shapes carry static-publisher paths.
- `apps/fullswing-blog/src/lib/discovery.ts` performs recursive filesystem discovery and verifies same-basename pairs. Discovery stays publisher-specific; the OneDrive adapter will enumerate DriveItems and the CMS application service will validate logical pairs.
- `apps/fullswing-blog/src/lib/markdown.ts` contains the existing Marked/Prism renderer, remote-source host allow-list, byte limit, and timeout. It returns generated HTML without sanitizing arbitrary authored HTML, so CMS preview sanitization is required.
- Nx targets are inferred from workspace package scripts. CMS `compile` and `test` remain the validation targets; `test` compiles and runs Node's test runner.

## References

- [Microsoft identity platform authorization code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow): server-based web app support, PKCE/state guidance, and server-only confidential-client credentials.
- [Microsoft Graph list folder children](https://learn.microsoft.com/en-us/graph/api/driveitem-list-children?view=graph-rest-1.0): drive/folder listing, least-privileged permission guidance, and `@odata.nextLink` paging.
- [Microsoft Graph upload small files](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content?view=graph-rest-1.0): file content upload/replace endpoints and permission guidance.
- [Microsoft Graph update a file or folder](https://learn.microsoft.com/en-us/graph/api/driveitem-update?view=graph-rest-1.0): `if-match` eTag precondition and `412 Precondition Failed` behavior.
- [Microsoft Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference): compare delegated and application file permissions; request least privilege.
- [GitHub REST API: Create a workflow dispatch event](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event): repository/workflow/ref/inputs, `workflow_dispatch` prerequisite, and dispatch response.
- [GitHub fine-grained token permission reference](https://docs.github.com/en/rest/authentication/permissions-required-for-fine-grained-personal-access-tokens): repository Actions write permission for workflow dispatch.