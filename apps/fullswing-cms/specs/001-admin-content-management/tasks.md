---
description: "Implementation tasks for Fullswing CMS Admin Content Management"
---

# Tasks: Fullswing CMS Admin Content Management

**Input**: Design documents from `apps/fullswing-cms/specs/001-admin-content-management/`

**Prerequisites**: `plan.md`, `spec.md`, `research.md`, `data-model.md`, `contracts/`, and `quickstart.md`

**Tests**: Automated tests are included because the CMS constitution requires tests for material changes and isolated integrations. Add the story-specific tests before their implementation tasks.

**Organization**: Tasks are grouped by the six user stories in `spec.md`, preserving their priorities. The in-memory storage fake supports independent CMS workflow testing before OneDrive is connected.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel because it touches different files and has no dependency on an incomplete task.
- **[Story]**: User story label; setup, foundational, and polish tasks do not use a story label.
- Every task names the source, test, configuration, or documentation file to change.

## Path Conventions

- CMS code and tests: `apps/fullswing-cms/src/` and `apps/fullswing-cms/test/`
- Shared content metadata: `libs/content-model/src/` and `libs/content-model/test/`
- Shared Markdown renderer: `libs/markdown-renderer/src/` and `libs/markdown-renderer/test/`
- Feature design documents: `apps/fullswing-cms/specs/001-admin-content-management/`

## Phase 1: Setup

**Purpose**: Add the runtime dependencies and workspace boundaries required by the planned server-rendered CMS and shared renderer.

- [x] T001 Add Fastify, `@fastify/cookie`, `@fastify/formbody`, `@fastify/static`, `@azure/msal-node`, Microsoft Graph SDK, `@octokit/rest`, and `sanitize-html` dependencies plus the CMS start script in `apps/fullswing-cms/package.json` and update the root `package-lock.json`.
- [x] T002 [P] Create the `@fullswing/markdown-renderer` package manifest and NodeNext TypeScript configuration in `libs/markdown-renderer/package.json` and `libs/markdown-renderer/tsconfig.json`.
- [x] T003 Link `@fullswing/markdown-renderer` into the blog and CMS workspace manifests in `apps/fullswing-blog/package.json` and `apps/fullswing-cms/package.json`, then refresh `package-lock.json` from the workspace root.

---

## Phase 2: Foundational

**Purpose**: Establish application contracts and request infrastructure that every story needs. No user-story work begins until the server can compose configuration, identity, and a storage provider without importing vendor-specific types into use cases.

- [x] T004 [P] Define normalized CMS content types, provider versions, and typed application errors in `apps/fullswing-cms/src/content/domain/content-entry.ts` and `apps/fullswing-cms/src/content/domain/content-errors.ts`.
- [x] T005 [P] Define persistent server-side configuration and secret-store interfaces, including masked-secret replacement semantics, in `apps/fullswing-cms/src/config/configuration-store.ts` and `apps/fullswing-cms/src/config/secret-store.ts`.
- [x] T006 [P] Define the provider-neutral content-storage interface for configuration validation, complete listing, entry reads, page reads, and compare-and-save blog pairs in `apps/fullswing-cms/src/content/storage/content-storage-provider.ts`.
- [x] T007 [P] Define identity-provider, session-store, administrator identity, and allowlist interfaces in `apps/fullswing-cms/src/auth/identity-provider.ts`, `apps/fullswing-cms/src/auth/session-store.ts`, and `apps/fullswing-cms/src/auth/admin-allowlist.ts`.
- [x] T008 Create deterministic fake configuration, secret, identity, session, and content providers for service tests in `apps/fullswing-cms/test/support/fakes.ts`.
- [x] T009 Implement the Fastify application factory, base request context, server-rendered response setup, and CMS public-asset serving in `apps/fullswing-cms/src/server/create-app.ts`.
- [x] T010 Implement shared authentication and CSRF guards for protected pages and state-changing forms in `apps/fullswing-cms/src/server/request-guards.ts`.
- [x] T011 Add structured error translation and secret/token redaction for server logs and administrator-facing errors in `apps/fullswing-cms/src/server/error-handler.ts` and `apps/fullswing-cms/src/server/logger.ts`.
- [x] T012 Compose the selected storage provider, configuration store, secret store, identity service, and HTTP app at startup in `apps/fullswing-cms/src/bootstrap.ts` and `apps/fullswing-cms/src/index.ts`; fail closed when required production adapters are missing.
- [x] T013 Add foundational tests for provider registry selection, configuration-store failure, secret masking, and non-sensitive error translation in `apps/fullswing-cms/test/unit/foundation.test.ts`.

**Checkpoint**: Server composition and test fakes are ready; all feature work can depend on typed ports rather than concrete providers.

---

## Phase 3: User Story 1 - Secure Administrator Access (Priority: P1)

**Goal**: Allow only allowlisted Microsoft Entra administrators to access protected CMS pages, with logout and expired-session handling.

**Independent Test**: Anonymous protected-route requests show Login without protected content; an allowlisted identity can sign in; an unlisted identity is denied; logout and expiry revoke access.

### Tests for User Story 1

- [x] T014 [P] [US1] Add allowlist tests using immutable `(tenantId, objectId)` identities and deny-by-default behavior in `apps/fullswing-cms/test/unit/admin-allowlist.test.ts`.
- [x] T015 [P] [US1] Add Entra identity-provider tests for unique state, mismatched-state rejection, code exchange, and server-side token retrieval in `apps/fullswing-cms/test/unit/entra-authentication.test.ts`.
- [x] T016 [P] [US1] Add route-guard tests proving Login and the validated callback are public while dashboard, editor, and configuration routes require an administrator session in `apps/fullswing-cms/test/integration/auth-routes.test.ts`.
- [x] T017 [P] [US1] Add session tests for expiry, logout, CSRF rejection, and absence of tokens in browser-visible responses in `apps/fullswing-cms/test/unit/session-service.test.ts`.

### Implementation for User Story 1

- [x] T018 [US1] Implement Entra authorization-code sign-in and callback handling through MSAL Node in `apps/fullswing-cms/src/auth/entra-authentication.ts`.
- [x] T019 [US1] Implement allowlist authorization using tenant ID and immutable object ID rather than mutable email addresses in `apps/fullswing-cms/src/auth/admin-allowlist.ts`.
- [x] T020 [US1] Implement server-side session creation, expiry, logout, and protected MSAL cache association in `apps/fullswing-cms/src/auth/session-service.ts`.
- [x] T021 [US1] Add public Login and Entra callback routes plus CSRF-protected Logout in `apps/fullswing-cms/src/server/routes/auth.ts`.
- [x] T022 [US1] Apply the shared route guard to every non-Login, non-callback route before loading protected data in `apps/fullswing-cms/src/server/request-guards.ts`.
- [x] T023 [US1] Create the accessible Login page, shared Fullswing shell/navigation/Logout form, CMS styles, and logo asset in `apps/fullswing-cms/src/views/login.ts`, `apps/fullswing-cms/src/views/layout.ts`, `apps/fullswing-cms/public/assets/cms.css`, and `apps/fullswing-cms/public/assets/logo.jpg`.

**Checkpoint**: Authentication, authorization, session lifecycle, and shared shell work independently of content-provider implementation.

---

## Phase 4: User Story 2 - Find and Review Content (Priority: P1)

**Goal**: Let an administrator browse normalized blog/page summaries and filter the dashboard, including clear and empty-result states.

**Independent Test**: With the in-memory provider, each filter and its combinations return exactly matching entries; empty and cleared filters have explicit states.

### Tests for User Story 2

- [x] T024 [P] [US2] Add list-query tests for type, title, date range, author, category, combined AND filters, and empty results in `apps/fullswing-cms/test/unit/list-content.test.ts`.
- [x] T025 [P] [US2] Add dashboard route/view tests for anonymous access, filter preservation, clear-filters behavior, and accessible empty state in `apps/fullswing-cms/test/integration/dashboard.test.ts`.
- [x] T026 [P] [US2] Add dashboard pagination tests using a fake collection larger than one page in `apps/fullswing-cms/test/unit/dashboard-pagination.test.ts`.

### Implementation for User Story 2

- [x] T027 [US2] Implement normalized list and filter application with AND semantics in `apps/fullswing-cms/src/content/application/list-content.ts`.
- [x] T028 [US2] Parse and validate dashboard filter query values, including date-range boundaries, in `apps/fullswing-cms/src/content/application/content-filters.ts`.
- [x] T029 [US2] Add authenticated dashboard GET route that obtains entries through `ContentStorageProvider` in `apps/fullswing-cms/src/server/routes/dashboard.ts`.
- [x] T030 [US2] Render dashboard rows with identifying metadata, filter controls, pagination, and accessible no-results state in `apps/fullswing-cms/src/views/dashboard.ts`.

**Checkpoint**: Dashboard works against any conforming fake provider and does not depend on OneDrive or Graph types.

---

## Phase 5: User Story 3 - Create and Edit Blog Markdown (Priority: P1)

**Goal**: Author a blog and compatible metadata, receive validation feedback, preview safe rendered Markdown, and save only valid drafts.

**Independent Test**: With a fake provider, valid drafts round-trip as a pair; invalid metadata/Markdown is rejected without writes; unsafe active markup is removed from preview.

### Tests for User Story 3

- [x] T031 [P] [US3] Add pure metadata parsing tests for non-empty route/title/author, non-empty categories, real `YYYY-MM-DD` dates, and expected route matching in `libs/content-model/test/metadata.test.ts`.
- [x] T032 [P] [US3] Add shared Markdown renderer tests for existing fences, code highlighting, bounded remote-source loading, and rendering compatibility in `libs/markdown-renderer/test/markdown.test.ts`.
- [x] T033 [P] [US3] Add CMS preview security tests for scripts, event-handler attributes, and unsafe URL schemes in `apps/fullswing-cms/test/unit/markdown-preview.test.ts`.
- [x] T034 [P] [US3] Add editor-route tests proving invalid metadata or Markdown causes no provider write and stale versions return a conflict in `apps/fullswing-cms/test/integration/blog-editor.test.ts`.

### Implementation for User Story 3

- [x] T035 [US3] Add a pure metadata JSON parser that requires non-empty `route`, `title`, and `author`, at least one non-empty category, and a real `YYYY-MM-DD` calendar date in `libs/content-model/src/metadata.ts`; refactor `loadMetadata()` to delegate to it without changing the filesystem API.
- [x] T036 [US3] Move the existing Marked/Prism renderer and its safe remote-source limits into `libs/markdown-renderer/src/markdown.ts` and export the shared API from `libs/markdown-renderer/src/index.ts`.
- [x] T037 [US3] Update the static blog renderer imports to consume `@fullswing/markdown-renderer` without changing published code-fence behavior in `apps/fullswing-blog/src/lib/markdown.ts` and `apps/fullswing-blog/package.json`.
- [x] T038 [US3] Implement CMS preview rendering and sanitize generated HTML with an explicit allowlist before it reaches a response in `apps/fullswing-cms/src/content/application/preview-markdown.ts`.
- [x] T039 [US3] Implement draft validation that checks shared metadata rules, route uniqueness, and Markdown preview eligibility before saving in `apps/fullswing-cms/src/content/application/validate-blog-draft.ts`.
- [x] T040 [US3] Render create/edit forms with metadata fields, Markdown editing, validation status that does not rely on color alone, and edit/preview tabs in `apps/fullswing-cms/src/views/blog-editor.ts`.
- [x] T041 [US3] Add authenticated create/edit/save routes that pass only validated drafts and expected versions to the storage port in `apps/fullswing-cms/src/server/routes/blog-editor.ts`.

**Checkpoint**: Blog authoring is safe and independently testable with the fake provider; it uses the same metadata rules and Markdown renderer as the static blog.

---

## Phase 6: User Story 4 - Use Configurable Content Storage (Priority: P1)

**Goal**: Implement OneDrive as an optional provider behind the provider-neutral storage port, preserving complete listings, pair integrity, delegated access, and compare-and-save behavior. The Azure deployment's Blob-only authority is added in Phase 12.

**Independent Test**: Run the provider conformance suite against the fake and OneDrive adapter; test pagination, delegated permission failure, stale versions, and partial pair-write reporting.

### Tests for User Story 4

- [x] T042 [P] [US4] Add shared content-storage conformance tests for complete listing, invalid/orphaned pairs, valid round-trips, provider failure, and source-switch non-migration in `apps/fullswing-cms/test/contract/content-storage-provider.test.ts`.
- [x] T043 [P] [US4] Add mocked Graph listing tests for nested folders, multiple `@odata.nextLink` pages, missing sidecars, malformed metadata, and duplicate routes in `apps/fullswing-cms/test/integration/onedrive-list.test.ts`.
- [x] T044 [P] [US4] Add mocked Graph write tests for stale eTags, successful pair updates, first/second sidecar failures, compensation, and explicit `PartialWrite` results in `apps/fullswing-cms/test/integration/onedrive-save.test.ts`.
- [x] T045 [P] [US4] Add provider-switch tests proving invalid settings keep the current source active and a valid switch leaves the previous provider unchanged in `apps/fullswing-cms/test/unit/provider-selection.test.ts`.

### Implementation for User Story 4

- [x] T046 [US4] Implement OneDrive configuration validation for drive and root-folder identifiers without changing active configuration on failure in `apps/fullswing-cms/src/content/storage/onedrive/onedrive-configuration.ts`.
- [x] T047 [US4] Implement OneDrive recursive listing that follows all continuation links and maps Graph IDs/eTags to opaque CMS IDs/versions in `apps/fullswing-cms/src/content/storage/onedrive/onedrive-client.ts`.
- [x] T048 [US4] Normalize matched Markdown and JSON sidecars into CMS entries, validate metadata through `@fullswing/content-model`, and reject or report orphaned items in `apps/fullswing-cms/src/content/storage/onedrive/onedrive-provider.ts`.
- [x] T049 [US4] Implement entry reads and compare-and-save for complete Markdown/metadata pairs using delegated administrator access and supported conditional writes in `apps/fullswing-cms/src/content/storage/onedrive/onedrive-provider.ts`.
- [x] T050 [US4] Map Graph authorization, throttling, precondition, and provider failures to provider-neutral errors without returning Graph models or secrets in `apps/fullswing-cms/src/content/storage/onedrive/onedrive-errors.ts`.
- [x] T051 [US4] Register OneDrive as an opt-in composition provider and activate candidates only after validation in `apps/fullswing-cms/src/content/storage/provider-registry.ts` and `apps/fullswing-cms/src/content/application/select-content-provider.ts`.

**Checkpoint**: Dashboard and editor use the OneDrive adapter through the same storage port they used with test fakes; no workflow imports Microsoft Graph types.

---

## Phase 7: User Story 5 - Configure Integrations and Dispatch Workflow (Priority: P2)

**Goal**: Let administrators manage provider/workflow settings and securely dispatch the configured GitHub workflow, distinguishing accepted submission from completion.

**Independent Test**: Persist valid/invalid non-secret settings and replaceable masked secrets; dispatch only the saved target; verify accepted, authorization, configuration, API rejection, and throttling states.

### Tests for User Story 5

- [x] T052 [P] [US5] Add configuration-service tests for required provider/workflow fields, persistence failures, secret replacement, and masked readback in `apps/fullswing-cms/test/unit/configuration-service.test.ts`.
- [x] T053 [P] [US5] Add mocked GitHub adapter tests for accepted dispatch with run ID/URL and invalid credential, missing workflow, invalid ref, rejection, and throttling errors in `apps/fullswing-cms/test/integration/github-workflow-dispatch.test.ts`.
- [x] T054 [P] [US5] Add dispatch-route tests for administrator authorization, CSRF, saved-target-only behavior, no request override, and no false completion state in `apps/fullswing-cms/test/integration/github-dispatch-route.test.ts`.
- [x] T055 [P] [US5] Add configuration-page tests for masked secrets, accessible validation errors, and denial to non-administrators in `apps/fullswing-cms/test/integration/configuration.test.ts`.

### Implementation for User Story 5

- [x] T056 [US5] Implement configuration validation and persistence through injected `ConfigurationStore` and `SecretStore` ports in `apps/fullswing-cms/src/config/configuration-service.ts`.
- [x] T057 [US5] Validate GitHub owner/repository, workflow identifier, ref, and declared non-secret inputs; associate the token with one repository and keep it in the server-side secret store in `apps/fullswing-cms/src/integrations/github/github-configuration.ts`.
- [x] T058 [US5] Implement the workflow dispatch port using `@octokit/rest`, saved target settings, and the server-side token; map only accepted responses to `Accepted` and return run ID/URL when provided in `apps/fullswing-cms/src/integrations/github/github-workflow-dispatch.ts`.
- [x] T059 [US5] Add configuration GET/POST routes that validate changes, persist provider/workflow settings, allow secret replacement without readback, and preserve active provider configuration on failure in `apps/fullswing-cms/src/server/routes/configuration.ts`.
- [x] T060 [US5] Add the CSRF-protected GitHub dispatch route that loads its target from saved configuration and never accepts request-level owner/repository/workflow overrides in `apps/fullswing-cms/src/server/routes/github-workflow.ts`.
- [x] T061 [US5] Render provider/workflow settings, secret replacement fields, and accessible accepted/failed dispatch feedback without implying workflow completion in `apps/fullswing-cms/src/views/configuration.ts`.

**Checkpoint**: Administrators can update integrations and dispatch the configured workflow; GitHub credentials remain server-side and workflow completion is not misreported.

---

## Phase 8: User Story 6 - Edit HTML Page Source (Priority: P3)

**Goal**: Allow source editing through providers that support page writes, while keeping HTML preview, rendering, publication, and script execution unavailable.

**Independent Test**: An administrator can edit a page through file storage and round-trip its HTML/metadata pair; read-only providers retain a placeholder, and no route executes or renders page HTML.

### Tests for User Story 6

- [x] T062 [P] [US6] Add page-route tests for admin-only access, placeholder output, and absence of HTML edit/save controls in `apps/fullswing-cms/test/integration/page-placeholder.test.ts`.
- [x] T063 [P] [US6] Add a provider/page-list test proving stored HTML is identified as a page but never executed or inserted into the response in `apps/fullswing-cms/test/unit/page-listing.test.ts`.

### Implementation for User Story 6

- [x] T064 [US6] Add authenticated read-only page routes and a clear HTML authoring placeholder in `apps/fullswing-cms/src/server/routes/pages.ts` and `apps/fullswing-cms/src/views/page-placeholder.ts`.
- [x] T065 [US6] Add page navigation and page-entry summaries without rendering stored HTML in `apps/fullswing-cms/src/views/layout.ts` and `apps/fullswing-cms/src/views/dashboard.ts`.

**Checkpoint**: Page source can be edited with capable providers; HTML rendering, execution, and publication remain out of scope.

---

## Phase 10: Local File Development Storage and Page Source Editing

**Purpose**: Record the implemented local development provider, configurable public directory, year-based pair layout, and provider-dependent page editor.

- [x] T071 Add local-file provider tests for year-based blog/page pairs, date-year moves, duplicate blog basenames, stale versions, and basename validation in `apps/fullswing-cms/test/unit/file-content-provider.test.ts`.
- [x] T072 Implement filesystem discovery, metadata parsing, opaque IDs/versions, pair writes, and rollback reporting in `apps/fullswing-cms/src/content/storage/file-content-provider.ts`.
- [x] T073 Extend the storage contract with optional page source reads/writes and HTML content in `apps/fullswing-cms/src/content/storage/content-storage-provider.ts` and `apps/fullswing-cms/src/content/domain/content-entry.ts`.
- [x] T074 Add `file-composition.mjs` and preserve the memory composition in `memory-composition.mjs`, defaulting file storage to `apps/fullswing-blog/public`.
- [x] T075 Add provider-specific settings selection, public-directory configuration, and provider options to the Configuration view and route; cover saved path settings in `apps/fullswing-cms/src/views/configuration.ts`, `apps/fullswing-cms/src/server/routes/configuration.ts`, and `apps/fullswing-cms/test/integration/configuration.test.ts`.
- [x] T076 Add provider-dependent page editor routes and HTML source fields while keeping read-only providers on the placeholder in `apps/fullswing-cms/src/server/routes/pages.ts` and `apps/fullswing-cms/src/views/page-placeholder.ts`.
- [x] T077 Update the file-provider page route dependency fixture and verify the CMS compile in `apps/fullswing-cms/test/integration/page-placeholder.test.ts`.
- [x] T078 Update the quickstart and operator documentation for file mode, path layout, in-memory local configuration, and non-publication of HTML pages in `apps/fullswing-cms/README.md` and `apps/fullswing-cms/specs/001-admin-content-management/quickstart.md`.
- [x] T079 Run `npm exec nx run fullswing-cms:test`; all 88 CMS tests pass, including the new provider and page-editing coverage.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Complete documentation, shared-package compatibility, and end-to-end quality gates across all delivered stories.

- [x] T066 [P] Document required Entra, delegated OneDrive, configuration-store, secret-store, and GitHub workflow settings in `apps/fullswing-cms/README.md` without including credentials.
- [x] T067 [P] Verify the quickstart scenarios and references match the implemented CMS test names and contracts in `apps/fullswing-cms/specs/001-admin-content-management/quickstart.md`.
- [x] T068 Review server-rendered forms, status messages, filters, and dispatch feedback for keyboard and assistive-technology requirements; record any requirement gaps in `apps/fullswing-cms/specs/001-admin-content-management/spec.md` before closing the feature.
- [x] T069 Run the CMS compile and test targets from `apps/fullswing-cms/specs/001-admin-content-management/quickstart.md` and resolve failures in the affected CMS source/test files.
- [x] T070 Run the static blog test target to confirm the shared metadata parser and Markdown renderer preserve existing publisher behavior in `apps/fullswing-blog/package.json`, `libs/content-model/test/metadata.test.ts`, and `libs/markdown-renderer/test/markdown.test.ts`.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies; creates runtime/workspace dependencies and the shared renderer package boundary.
- **Foundational (Phase 2)**: Depends on Setup and blocks all stories through the common server, storage, configuration, authentication, and error contracts.
- **User stories (Phases 3–8)**: Depend on Foundational. US1 enables protected-route work. US2 and US3 can develop against the in-memory content provider; OneDrive in US4 remains optional, while Phase 12 supplies the Blob provider for the Azure deployment. US4 also depends on US1's identity service. US5 depends on US1, foundational configuration/secret stores, and its GitHub test adapter. US6 depends on US1 route guards and US2 page summaries.
- **Polish (Phase 9)**: Depends on the stories selected for delivery; cross-project Markdown compatibility depends on US3.

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational; independent of other stories.
- **US2 (P1)**: Starts after Foundational and US1 route guards; uses the fake provider until US4 is integrated.
- **US3 (P1)**: Starts after Setup/Foundational; can be developed against the fake provider and is independent of US2.
- **US4 (P1)**: Starts after Foundational and uses US1 delegated identity; integrates the provider port consumed by US2/US3.
- **US5 (P2)**: Starts after US1 and Foundational; its provider-selection form integrates with US4, while GitHub dispatch is separately testable through its adapter.
- **US6 (P3)**: Starts after US1 and the page-summary portion of US2.

### Parallel Opportunities

- T002 can run while T001 updates the CMS package because they touch separate package manifests.
- T004–T007 define separate domain, configuration, storage, and identity contracts after setup.
- The US1 allowlist, callback, route-guard, and session tests (T014–T017) can be written in parallel before their implementation tasks.
- The US2 filter, route/view, and pagination tests (T024–T026) can be written in parallel against the fake provider.
- The US3 metadata, renderer, sanitizer, and editor tests (T031–T034) can be prepared in parallel; parser and renderer implementations touch separate packages.
- The US4 provider conformance, Graph listing, Graph save, and source-switch tests (T042–T045) can be prepared in parallel.
- The US5 configuration, dispatch adapter, dispatch route, and configuration-page tests (T052–T055) can be prepared in parallel with mocked dependencies.
- The US6 placeholder and page-listing tests (T062–T063) can be prepared in parallel.
- US2/US3 fake-provider workflow work may proceed alongside the US4 OneDrive adapter after Foundational; final production integration waits for US4.

### Parallel Execution Examples per Story

- **US1**: Start T014, T015, T016, and T017 together; they cover separate allowlist, callback, route-guard, and session test files.
- **US2**: Start T024, T025, and T026 together; they cover filter, dashboard-route, and pagination test files.
- **US3**: Start T031, T032, T033, and T034 together; they cover shared metadata, renderer, preview, and editor-route tests.
- **US4**: Start T042, T043, T044, and T045 together; they cover the provider contract, Graph listing, Graph save, and provider-switch tests.
- **US5**: Start T052, T053, T054, and T055 together; they cover configuration, GitHub adapter, dispatch route, and configuration-page tests.
- **US6**: Start T062 and T063 together; they cover the read-only placeholder and safe page-listing tests.

## Implementation Strategy

### Useful MVP

Deliver US1–US4 plus a deployment-selected content provider. The Azure composition uses Blob for content and runtime state without OneDrive; other compositions may register OneDrive. This yields a protected CMS that can list, filter, edit, validate, preview, and save content against the selected source. US5's GitHub workflow dispatch and US6's HTML page source support remain independently testable increments.

### Incremental Delivery

1. Complete Setup and Foundational; verify CMS composition with test fakes.
2. Complete US1 and the selected content provider integration (OneDrive or Blob composition).
3. Complete US2 and US3 against the provider contract; integrate with the Azure Blob composition for the Azure deployment.
4. Complete US5 for provider/workflow configuration and GitHub dispatch.
5. Complete US6 read-only HTML page visibility and the final cross-cutting gates.

Each story has a separate independent test criterion above. Automated tests are required by the CMS constitution and use fake providers or mocked integrations; no live credentials are needed for the normal test suite.

## Phase 11: Azure Blob Runtime Persistence Composition

**Purpose**: Provide durable CMS configuration and encrypted secrets for an Azure-hosted Node deployment while keeping persistence ports replaceable and sessions in memory.

- [x] T080 Add `@azure/storage-blob` to `apps/fullswing-cms/package.json` and update the root `package-lock.json`.
- [x] T081 Add tests for configuration persistence/conflicts and secret encryption, round-trip, deletion, tamper rejection, and incorrect keys in `apps/fullswing-cms/test/unit/blob-stores.test.ts`.
- [x] T082 Implement `BlobConfigurationStore` with ETag-based conditional writes and `EncryptedBlobSecretStore` with AES-256-GCM, a host-supplied key, and authenticated secret references in `apps/fullswing-cms/src/config/blob-stores.ts`.
- [x] T083 Add `blob-composition.mjs` to wire Blob configuration/secrets, Entra settings from environment variables, and an in-memory session store in `apps/fullswing-cms/blob-composition.mjs`.
- [x] T084 Update runtime persistence requirements, architecture decisions, data model, and operator steps in `spec.md`, `plan.md`, `research.md`, `data-model.md`, `quickstart.md`, and `apps/fullswing-cms/README.md`.
- [x] T085 Run `npm exec nx run fullswing-cms:test` and validate `blob-composition.mjs` syntax.

**Operational boundary**: This phase adds a deployment composition, not Azure infrastructure or a Node hosting resource. Session records are intentionally lost on process restart; the MSAL token cache is persisted in the encrypted Blob-backed secret store.

## Phase 12: Azure Blob Content Authority

**Purpose**: Make Blob Storage the sole content provider for the Azure composition while retaining OneDrive only for compositions that explicitly enable it.

- [x] T086 Add Blob content-provider tests for blog/page pairs, year routing, stale ETag conflicts, malformed metadata, and orphan rejection in `apps/fullswing-cms/test/integration/blob-content-provider.test.ts`.
- [x] T087 Implement Blob listing, reads, conditional pair writes, compensation, page saves, and year-prefixed content names in `apps/fullswing-cms/src/content/storage/blob-content-provider.ts`.
- [x] T088 Register Blob in `blob-composition.mjs`, opt out of automatic OneDrive registration, use OIDC-only sign-in scopes, and default Configuration to the first registered provider in `apps/fullswing-cms/blob-composition.mjs`, `apps/fullswing-cms/src/bootstrap.ts`, `apps/fullswing-cms/src/auth/entra-authentication.ts`, and `apps/fullswing-cms/src/views/configuration.ts`.
- [x] T089 Align the feature requirements, architecture, research, data model, quickstart, provider contract, and operator README with Blob content authority in the corresponding CMS documentation files.
- [x] T090 Run `npm exec nx run fullswing-cms:test`; all 96 CMS tests pass.

**Operational boundary**: This phase stores content under `content/` in the same private container as configuration and encrypted secrets. It does not provision Azure hosting, perform an automatic migration from OneDrive or local files, or synchronize Blob content into the static blog publisher's repository.

## Phase 13: Azure F1 Deployment and Blob Publishing Sync

**Purpose**: Provision the CMS on Azure App Service Linux F1 without coupling its lifecycle to the static site or persistent content, and stage authoritative Blob blogs before each static-site build.

- [x] T091 Add sync tests for prefix mapping, stale-file removal, malformed/empty pairs, and preservation of the previous directory on download failure in `scripts/sync-blog-content.test.mjs`.
- [x] T092 Implement the Azure CLI-based Blob sync utility with path validation and staged directory replacement in `scripts/sync-blog-content.mjs`.
- [x] T093 Add an App Service production start command that does not require the gitignored `.env` file in `apps/fullswing-cms/package.json`.
- [x] T094 Add content-storage and CMS-host Bicep templates targeting the shared `rg-fullswing-cms` resource group, including scoped Blob Data Reader access for the static build identity in `apps/fullswing-cms/infra/content-storage.bicep` and `apps/fullswing-cms/infra/cms-host.bicep`.
- [x] T095 Add a manually triggered CMS workflow to test/build the workspace, provision persistent Blob and Linux F1 resources, optionally seed an empty blog prefix, and deploy the compiled package without a destroy path in `.github/workflows/deploy-cms.yml`.
- [x] T096 Update the static deployment workflow to compile workspace libraries and sync Blob blogs into `apps/fullswing-blog/public/blog/` before the existing static build in `.github/workflows/deploy.yml`.
- [x] T097 Document GitHub settings, Entra callback, RBAC prerequisites, seed procedure, CMS/blog resource-group boundary, and tier limitations in `apps/fullswing-cms/README.md`, `specs/001-admin-content-management/quickstart.md`, and the feature design artifacts.
- [x] T098 Run the sync utility tests, CMS tests, static-blog verification, and Bicep diagnostics; identify GitHub repository settings as prerequisites for T099.
- [ ] T099 After merging the follow-up CI/runtime and resource-group changes, rerun the CMS workflow with `seed_initial_content=true`; verify CMS login, Blob saves, and the subsequent static Blob-to-site build.

**Operational boundary**: Local tests validate package behavior but do not provision Azure or exercise live Entra/Blob access. Task T099 remains a manual cloud deployment and smoke-test gate. Blob is free only within the applicable first-12-month offer; App Service F1 has strict CPU, bandwidth, and availability limits.

## Phase 14: CMS Resource Group Consolidation

**Purpose**: Keep the App Service host, Blob content account, and container under `rg-fullswing-cms` while preserving the existing static blog in its separate `rg-fullswing-blog` lifecycle.

- [x] T102 Update CMS and static deployment workflows to provision and discover the content account in `rg-fullswing-cms` in `.github/workflows/deploy-cms.yml` and `.github/workflows/deploy.yml`.
- [x] T103 Align deployment documentation and resource-group requirements with the consolidated CMS group in `apps/fullswing-cms/README.md` and the feature design artifacts.

**Operational boundary**: Neither deployment workflow deletes `rg-fullswing-cms`. Static-blog `azd down` remains scoped to `rg-fullswing-blog`.

## Phase 15: First Deployment CI Compatibility

**Purpose**: Make the clean GitHub runner compile workspace-linked packages before CMS compilation and use the Node runtime required by current Azure dependencies.

- [x] T104 Raise the CMS engine requirement to Node 22.12+, use Node 24 LTS in App Service and deployment workflows, and synchronize `package-lock.json`.
- [x] T105 Compile `content-model` and `markdown-renderer` before `fullswing-cms:test`; forward Nx `run-many` flags using npm's `--` separator in CMS and static workflows.
- [x] T106 Update the CMS README, quickstart, and implementation plan to specify Node 24 LTS for Azure deployment.
- [x] T107 Reproduce the clean shared-library build order and verify CMS tests, static-blog tests/build, sync tests, Bicep diagnostics, and diff formatting.

**Operational boundary**: The first dispatched CMS run failed in CI before Azure provisioning because linked library outputs were not built first. No Azure resources were created by that run. T099 remains the post-merge deployment and live smoke-test gate.