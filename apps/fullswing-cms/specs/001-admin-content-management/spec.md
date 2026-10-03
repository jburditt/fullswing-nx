# Feature Specification: Fullswing CMS Admin Content Management

**Feature Branch**: `001-admin-content-management`

**Created**: 2026-09-26

**Status**: Draft

**Input**: Update the CMS to support a composition-selected content provider, local-file development storage under the Fullswing blog public directory, and an Azure deployment backed entirely by Blob Storage. OneDrive remains an optional provider for compositions that register it. Admins sign in, browse and filter content, edit Markdown and metadata with validation and preview, configure provider and GitHub Action settings, and edit HTML page source only when the selected provider supports page writes. HTML source is never rendered or executed by the CMS.

### Session 2026-09-29

- Q: What local-file layout should the CMS use for blogs and pages? → A: Configure the website `public` directory; store blog Markdown/JSON pairs under `blog/<year>/` and page HTML/JSON pairs under `pages/<year>/`, using the metadata date's year. File-backed HTML source is editable in the CMS but is not rendered or published by the static blog generator.

### Session 2026-10-02

- Q: How should a hosted CMS persist configuration, secrets, and sessions? → A: Persist configuration in Azure Blob Storage; keep the `SecretStore` provider replaceable and encrypt secret values with AES-256-GCM using a key supplied separately through host environment settings; keep sessions in memory for now, so process restarts require administrators to sign in again.
- Q: What is the content authority for the Azure deployment? → A: Azure Blob Storage is the sole content and runtime-state store for that composition. It does not register or use OneDrive. The OneDrive adapter remains available to other compositions, but is not a fallback or synchronization target.

## Clarifications

### Session 2026-09-26

- Q: When an administrator changes the selected storage provider, what should happen to content in the previous provider? → A: The new provider becomes authoritative; the previous provider is left unchanged, and migration is separate.
- Q: Which identity provider should administrators use to sign in to the CMS for its first release? → A: Microsoft Entra ID.
- Q: Should the CMS access OneDrive as the signed-in administrator using their file permissions, or as a separate app identity with tenant-granted file permissions? → A: Use the signed-in administrator's delegated access; each allowlisted administrator must have access to the configured folder.
- Q: Should the CMS itself trigger the configured GitHub Action, or only store settings for an external caller? → A: An authenticated administrator can trigger the configured workflow through the CMS.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Secure Administrator Access (Priority: P1)

An administrator signs in with Microsoft Entra ID to manage content. A visitor who is not signed in cannot access the dashboard, editor, or configuration pages. Only accounts approved for administration can enter the CMS.

**Why this priority**: Content and integration settings must not be exposed to unauthenticated or unauthorized visitors.

**Independent Test**: Request every protected page without a session, then sign in with an approved and an unapproved account and verify the resulting access.

**Acceptance Scenarios**:

1. **Given** a visitor has no active session, **When** they open any page other than Login, **Then** the Login page is shown and the requested page is not exposed.
2. **Given** an approved administrator completes sign-in, **When** authentication succeeds, **Then** the administrator can access the requested CMS page.
3. **Given** an account is not approved for administration, **When** it completes sign-in, **Then** access is denied and no protected content or settings are shown.
4. **Given** an administrator is signed in, **When** they choose Logout, **Then** the session ends and a later protected-page request requires sign-in again.

### User Story 2 - Find and Review Content (Priority: P1)

An administrator opens the dashboard to see available blog and page entries, then narrows the list by content type, title, date range, author, or category.

**Why this priority**: Administrators need to find existing content before reviewing or editing it.

**Independent Test**: Load a known set of blog and page entries, apply each filter and combinations of filters, clear the filters, and verify the displayed entries.

**Acceptance Scenarios**:

1. **Given** content is available, **When** an administrator opens the dashboard, **Then** blog and page entries are listed with their available identifying metadata.
2. **Given** the dashboard list is visible, **When** the administrator applies content-type, title, date-range, author, or category filters, **Then** only entries matching all active filters remain visible.
3. **Given** filters match no entries, **When** the results are displayed, **Then** the dashboard shows a clear empty-results state and allows the administrator to clear filters.
4. **Given** the administrator clears the filters, **When** the dashboard refreshes, **Then** the full available list is shown again.

### User Story 3 - Create and Edit Blog Markdown (Priority: P1)

An administrator creates or edits a blog post by entering Markdown and its metadata, sees whether the content is valid, and can preview the formatted result before saving.

**Why this priority**: Markdown blog management is the CMS's primary authoring workflow.

**Independent Test**: Create and edit a blog using valid and invalid Markdown and metadata; verify validation feedback, preview safety, and saved content.

**Acceptance Scenarios**:

1. **Given** the administrator starts a blog entry, **When** they enter Markdown and metadata, **Then** the editor presents editable content and metadata fields.
2. **Given** the Markdown or metadata changes, **When** validation completes, **Then** the editor shows a perceivable valid or invalid status, with an explanation for invalid content.
3. **Given** the administrator switches from editing to preview, **When** the preview is shown, **Then** the Markdown is formatted and embedded scripts or event handlers do not execute.
4. **Given** the content and metadata are valid, **When** the administrator saves, **Then** the blog content and its metadata are stored as a compatible matched pair.
5. **Given** content or required metadata is invalid, **When** the administrator attempts to save, **Then** the save is rejected, the relevant errors are identified, and the stored content is unchanged.

### User Story 4 - Use Configurable Content Storage (Priority: P1)

An administrator reads and saves content through the provider registered by the deployment composition. Azure uses Blob Storage as its content authority; OneDrive is available only to compositions that register it, and local-file storage supports development against the Fullswing blog workspace. The dashboard and authoring workflows use the common provider contract.

**Why this priority**: The CMS must manage the same source of content that the publishing workflow consumes, report incomplete writes accurately, and allow storage services to evolve independently from content-management workflows.

**Independent Test**: Exercise successful reads and writes, provider failures, stale edits, and incomplete sidecar pairs. Verify that local blog and page files use the configured public directory and the year from metadata, and that switching providers does not migrate content.

**Acceptance Scenarios**:

1. **Given** the selected provider is accessible, **When** the administrator loads the dashboard, **Then** the listed content reflects the available stored content.
2. **Given** an administrator saves a valid blog change, **When** both content and metadata are stored successfully by the selected service, **Then** the CMS confirms the save and a subsequent read returns the saved values.
3. **Given** a read or write fails in the selected service, **When** the operation ends, **Then** the CMS reports failure without presenting stale or partial data as successfully saved.
4. **Given** saving either member of a blog and metadata pair fails, **When** the operation ends, **Then** the CMS does not report success and identifies any inconsistency that needs resolution.
5. **Given** stored content changes after an administrator loaded it, **When** that administrator tries to overwrite it, **Then** the CMS detects the conflict and requires review of the newer content before replacement.
6. **Given** another service has been added by implementing the content-storage contract, **When** an administrator selects that supported service in configuration, **Then** the dashboard, filtering, editing, validation, and preview workflows operate without provider-specific changes.
7. **Given** an administrator changes the selected provider, **When** the configuration is saved, **Then** the new provider becomes the active content source, the previous provider's content remains unchanged, and no automatic migration occurs.
8. **Given** an allowlisted administrator does not have access to the configured OneDrive folder, **When** they load or save content, **Then** the CMS reports an access error and does not present the operation as successful.
9. **Given** the local-file provider is selected with a valid public directory, **When** an administrator saves a blog, **Then** its Markdown and JSON sidecar are written under `blog/<metadata-year>/` and can be read back.
10. **Given** the local-file provider is selected, **When** an administrator saves a page, **Then** its HTML source and JSON sidecar are written under `pages/<metadata-year>/` and can be read back without executing the HTML.
11. **Given** an administrator changes a content date to a different year, **When** they save the item, **Then** the pair is stored in that year's directory and the prior pair is removed only after the new pair is written successfully.

### User Story 5 - Configure Provider and Dispatch Workflow (Priority: P2)

An administrator reviews and updates the selected content provider and GitHub Action settings, then can request the configured workflow to run from the CMS.

**Why this priority**: Integration settings enable content access and the publishing workflow while keeping credentials under administrative control.

**Independent Test**: As an administrator, save valid and incomplete configuration, revisit the page, and verify values, validation, and secret masking; trigger a test workflow and verify queued and failure states; confirm a non-administrator cannot access settings or dispatch.

**Acceptance Scenarios**:

1. **Given** an administrator opens Configuration, **When** the page loads, **Then** it shows the selected supported content-storage service and its settings, the GitHub Action settings, and any missing required values.
2. **Given** the administrator enters valid configuration for a supported service, **When** they save it, **Then** the CMS confirms the configuration was stored and available non-secret values can be reviewed later.
3. **Given** a saved value is secret, **When** the configuration page is revisited, **Then** the secret is masked and is not disclosed in page content or application logs.
4. **Given** required configuration is incomplete or invalid, **When** the administrator saves it, **Then** the CMS identifies the affected values and does not claim the integration is ready.
5. **Given** valid GitHub workflow settings are configured, **When** an administrator triggers the workflow, **Then** the CMS sends an authorized dispatch request and reports whether GitHub accepted or rejected it without claiming that an accepted workflow has completed.
6. **Given** GitHub settings are incomplete, the administrator is unauthorized, or GitHub rejects or throttles the request, **When** the administrator attempts to trigger the workflow, **Then** the CMS reports a non-sensitive failure and does not display a queued or successful state.

### User Story 6 - Edit HTML Page Source (Priority: P3)

An administrator can edit HTML source and metadata when local-file storage is active. Other providers may expose pages as read-only. The CMS never renders or executes stored HTML, and the static blog generator does not publish these page files.

**Why this priority**: Local page source can be managed alongside blog source while preserving a strict boundary against executing HTML in the CMS.

**Independent Test**: Create and edit an HTML page using the local-file provider, verify the matching HTML/JSON pair and year directory, and verify the CMS response never inserts the stored HTML as executable markup. With a read-only provider, verify the placeholder remains available.

**Acceptance Scenarios**:

1. **Given** local-file storage is active, **When** an administrator opens a page or creates one, **Then** the CMS offers editable HTML source and metadata fields.
2. **Given** an administrator saves valid page metadata and HTML source, **When** the save completes, **Then** the matching page pair is stored and can be reopened with the saved values.
3. **Given** the stored HTML contains scripts or event handlers, **When** an administrator opens the CMS page editor, **Then** the source is displayed as escaped text and is not executed.
4. **Given** a provider does not support page writes, **When** an administrator opens a page, **Then** the CMS displays the read-only placeholder and offers no save controls.

### Edge Cases

- An authentication session expires while an administrator is editing; unsaved work is not silently discarded, and access requires renewed authentication.
- The identity provider is unavailable or returns an authentication failure; the CMS denies protected access and displays a non-sensitive error.
- The configured administrator allowlist is empty or an account's identity cannot be matched; access is denied by default.
- The selected content-storage service is unavailable, access is revoked, or content changes during an edit; the CMS reports the condition and does not claim an unsuccessful read or write succeeded.
- An allowlisted administrator lacks permission to the configured OneDrive folder; OneDrive access fails explicitly and the CMS does not fall back to app-only access.
- Azure Blob content is unavailable, a content pair is missing a sidecar, or an ETag changes during save; the CMS reports a provider, validation, or version-conflict error and does not report success.
- A storage service is not supported or its configuration is incomplete; the CMS does not silently fall back to another service or present content from the wrong source.
- A local public directory is missing, not a directory, or not writable; configuration validation fails without switching the active provider.
- A local content file in a four-digit year directory is missing its matching sidecar or has malformed metadata; the CMS reports invalid content instead of silently omitting it. Content is discovered only in four-digit year directories.
- A local pair is being moved to a different year and writing the new pair fails; the prior pair remains available and no successful save is reported.
- The selected provider changes while the previous provider contains content; the previous provider remains unchanged, and the CMS does not automatically copy, merge, or migrate its content.
- A Markdown file has no metadata pair, its metadata is malformed, its route conflicts with another entry, or required metadata is missing; the item is not silently accepted as valid.
- A date is malformed or not a real calendar date, or categories are missing or empty; validation identifies the invalid metadata.
- Markdown contains raw HTML, scripts, or event handlers; the preview does not execute active content.
- A dashboard filter produces no matches or the underlying folder contains no entries; the page shows an empty state rather than an error.
- A secret has not been configured, is rejected by an integration, or is replaced; the UI and logs do not disclose its value.
- The GitHub credential is invalid or revoked, the configured workflow cannot be dispatched, or GitHub throttles or rejects a request; the CMS reports dispatch failure and does not claim deployment completion.
- Azure Blob Storage is unavailable, the configured encryption key is missing or invalid, or an encrypted secret cannot be authenticated; startup or the affected operation fails without exposing plaintext secret data.
- The CMS process restarts while using the Azure Blob composition; persisted configuration and secrets remain available, while in-memory administrator sessions are lost and require a new sign-in.
- The static-blog workflow cannot access the Blob container, receives an empty/incomplete blog prefix, or fails during download; the build is not allowed to publish a stale or partial content set.
- An HTML page is selected while the active provider is read-only; the CMS leaves it read-only and shows the placeholder.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every page other than Login MUST require an authenticated administrator session.
- **FR-002**: The CMS MUST use Microsoft Entra ID's currently supported OAuth sign-in flow and MUST authorize only accounts on the configured administrator allowlist.
- **FR-003**: The CMS MUST provide Logout, end the active session, and require authentication on the next protected-page request.
- **FR-004**: The shared page layout MUST provide Fullswing branding, navigation to Dashboard, blog/page authoring, and Configuration, and a Logout control. Main page content MUST be horizontally centered.
- **FR-005**: The Dashboard MUST list available blog and page entries and support filtering by content type, title, date range, author, and category, including combined filters and a clear-filters action.
- **FR-006**: The Markdown authoring page MUST allow an administrator to create or edit blog Markdown and the associated metadata, switch between editing and formatted preview, and see a status change when validation results change.
- **FR-007**: The Markdown and metadata validation status MUST be understandable without relying on color alone and MUST identify the fields or content that need correction.
- **FR-008**: Blog and page metadata MUST remain compatible with the Fullswing content contract, including title, author, date, and categories; invalid or incomplete metadata MUST be rejected before storage. Routes MUST be derived consistently with the content kind and basename.
- **FR-009**: The Markdown preview MUST NOT execute scripts, event handlers, or other active content supplied in stored or edited content.
- **FR-010**: The CMS MUST access blog and HTML page content through a provider-neutral content-storage capability. The provider explicitly selected by the deployment composition MUST be authoritative. The Azure Blob composition MUST use Blob Storage as its sole content authority; the configured OneDrive folder MUST be authoritative only in compositions that register and select OneDrive; the local-file provider MUST use the configured website public directory.
- **FR-011**: The CMS MUST report successful saves only after all required content for that save has been stored; failed or partial writes MUST be reported and MUST identify any unresolved content mismatch.
- **FR-012**: The CMS MUST detect when an item has changed since it was loaded and MUST prevent an unreviewed overwrite of the newer content.
- **FR-013**: The Configuration page MUST allow administrators to select a registered content-storage provider and manage its required settings, including the local-file public directory, as well as the values needed for GitHub Action invocation; it MUST identify missing or invalid required values. Saving a provider change MUST make the newly selected provider authoritative without modifying or migrating content in the previous provider.
- **FR-014**: OAuth credentials, access tokens, refresh tokens, OneDrive secrets, and other secret configuration values MUST NOT be committed, exposed in client-visible page content, or logged. Saved secrets MUST be masked when configuration is revisited.
- **FR-015**: When the selected provider supports page writes, the CMS MUST allow administrators to create and edit HTML source and metadata. HTML MUST be treated as source text in the CMS and MUST NOT be rendered or executed. Providers without page-write support MUST present a read-only placeholder. HTML files stored under `public/pages/` are not consumed by the current static blog generator.
- **FR-016**: The core administration and authoring workflows MUST remain usable without optional Svelte web components, and validation, status, navigation, and error feedback MUST be accessible by keyboard and assistive technology.
- **FR-017**: A content-storage provider or identity-provider failure MUST produce an explicit, non-sensitive error and MUST NOT be represented as a successful operation.
- **FR-018**: Provider-specific storage behavior MUST be isolated from dashboard, filtering, authoring, validation, and preview workflows behind a common content-storage contract. Adding a provider that satisfies this contract MUST NOT require rewriting those workflows.
- **FR-019**: OneDrive operations MUST use delegated access for the currently signed-in administrator. Each allowlisted administrator MUST have access to the configured folder; missing folder access MUST be reported without falling back to an independent app identity.
- **FR-020**: The CMS MUST provide an authenticated, CSRF-protected action for an administrator to dispatch the configured GitHub workflow. It MUST report dispatch acceptance separately from workflow completion, and MUST report invalid configuration, authorization failures, and GitHub API failures without exposing credentials or claiming a successful dispatch.
- **FR-021**: GitHub workflow configuration MUST identify the repository owner and name, workflow identifier, reference to run, and any configured non-secret workflow inputs. Dispatch MUST use only these saved settings and MUST NOT accept a repository or workflow target override from an individual trigger request.
- **FR-022**: The local-file provider MUST store blog Markdown/JSON pairs at `<public-directory>/blog/<YYYY>/<basename>.md` and `.json`, and page HTML/JSON pairs at `<public-directory>/pages/<YYYY>/<basename>.html` and `.json`, where `<YYYY>` is derived from the metadata date. It MUST validate the target directory and basename and MUST prevent path traversal.
- **FR-023**: A local-file save that changes the metadata year MUST write the complete new pair before removing the old pair; if the new write fails, the CMS MUST NOT claim success or delete the old pair.
- **FR-024**: The Azure Blob deployment composition MUST persist CMS configuration through the `ConfigurationStore` port and MUST detect conflicting updates using Blob conditional writes.
- **FR-025**: The Azure Blob `SecretStore` MUST encrypt each secret using AES-256-GCM with a unique nonce and authenticated secret reference before writing it to Blob Storage. The encryption key MUST be supplied separately by the host, MUST NOT be written to the Blob container, and MUST remain replaceable behind the `SecretStore` port.
- **FR-026**: The Azure Blob composition MUST keep administrator sessions in memory. A process restart MUST invalidate those sessions; durable session persistence is not required by this release.
- **FR-027**: The Azure Blob composition MUST register Blob Storage as its content provider and MUST store blogs under `content/blog/<YYYY>/<basename>.md` plus `.json`, and pages under `content/pages/<YYYY>/<basename>.html` plus `.json`, where `<YYYY>` is derived from the metadata date. The configured content prefix MAY override `content`.
- **FR-028**: The Azure Blob composition MUST NOT register or fall back to OneDrive and MUST NOT request Microsoft Graph file permissions for its content workflows. Administrator sign-in MUST use identity scopes only.
- **FR-029**: The CMS deployment MUST provision its Linux App Service host in `rg-fullswing-cms` and persistent Blob content storage in `rg-fullswing-content`, separate from the static blog's `rg-fullswing-blog`. The CMS and static-blog deployment workflows MUST NOT delete `rg-fullswing-content`.
- **FR-030**: Before each static-blog build, the GitHub Actions workflow MUST authenticate to Azure using federated identity, read the `content/blog/` Blob prefix, and stage its year-based Markdown/JSON pairs under `apps/fullswing-blog/public/blog/`.
- **FR-031**: The Blob-to-static sync MUST replace the staged blog directory only after every listed blob has downloaded and every body/metadata pair is complete. An empty prefix, malformed path, missing sidecar, or failed download MUST fail the deployment instead of publishing stale or partial content. Initial repository-to-Blob seeding MUST be explicit and MUST refuse to overwrite a non-empty prefix.
- **FR-032**: The Azure CMS deployment package MUST compile the CMS and its workspace libraries before deployment and MUST start the compiled entry point using App Service environment settings without requiring a `.env` file.

### Key Entities *(include if feature involves data)*

- **Blog Entry**: A Markdown blog item and its associated metadata, including route, title, author, date, and one or more categories.
- **Page Entry**: An HTML source item and metadata surfaced in the dashboard; some providers allow source editing, but the CMS does not render or execute the HTML.
- **Content Storage Provider**: A composition-registered service that reads and writes content using the CMS content-storage contract. Azure uses Blob Storage; other compositions may register OneDrive; local files support development.
- **Administrator**: An authenticated identity that is authorized by the configured administrator allowlist.
- **Workflow Dispatch Request**: An administrator's request to invoke the configured GitHub workflow, with a result that distinguishes dispatch acceptance or failure from later workflow completion.
- **Integration Configuration**: The selected content-storage provider and its settings, together with the values needed to configure GitHub Action invocation; secrets are protected and masked.
- **Edit Version**: The version of an item an administrator loaded, used to detect whether the stored item changed before a save.
- **Runtime Persistence Composition**: Deployment-selected implementations of configuration, secret, and session stores. The Azure composition stores configuration in Blob Storage, stores authenticated ciphertext for secrets in Blob Storage, and stores sessions in process memory.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of unauthenticated requests to protected pages show Login without exposing protected page content.
- **SC-002**: 100% of sign-in attempts by identities outside the configured administrator allowlist are denied access to protected pages.
- **SC-003**: For a test collection with known metadata, every individual and combined dashboard filter returns exactly the entries matching the selected criteria.
- **SC-004**: 100% of valid blog create/edit test cases round-trip the Markdown and required metadata through the configured content store; 100% of invalid test cases leave stored content unchanged.
- **SC-005**: No active script or event-handler test payload executes in the Markdown preview.
- **SC-006**: Every simulated read, write, partial-write, and stale-edit failure is reported as a failure, with no false success confirmation.
- **SC-007**: Saved secret values remain undisclosed in the revisited configuration page, browser-visible page content, and application logs.
- **SC-008**: With a page-write provider, administrators can create and edit HTML source; with a read-only provider, the page destination remains read-only. In all cases, no stored HTML is rendered or executed by the CMS.
- **SC-009**: A test content-storage provider that satisfies the common contract can be selected and used for dashboard reads and content saves without changing CMS dashboard or authoring workflows.
- **SC-010**: 100% of OneDrive reads and writes use the signed-in administrator's delegated access; if that administrator lacks configured-folder access, the operation fails explicitly without app-only fallback or a success state.
- **SC-011**: 100% of GitHub workflow trigger attempts with valid settings return an explicit accepted or failed dispatch state; no accepted dispatch is reported as a completed deployment, and invalid settings or unauthorized requests never produce a queued state.
- **SC-012**: 100% of accepted workflow dispatches target the saved repository, workflow, reference, and inputs; no trigger request can override the configured target.
- **SC-013**: 100% of local-file blog and page save tests create a matched body/metadata pair under the year derived from the metadata date, and a subsequent read returns the saved content.
- **SC-014**: 100% of failed local pair writes leave the prior content intact or report an explicit partial-write failure; no failed save is reported as successful.
- **SC-015**: Azure Blob configuration reads return the saved configuration; stale revisions or conditional-write races are reported as conflicts rather than overwriting a newer configuration.
- **SC-016**: Secret-store Blob payloads contain no plaintext secret; valid secrets round-trip with the configured key, and tampered ciphertext or a different key fails without returning secret data.
- **SC-017**: In the Azure Blob composition, configuration and secrets remain readable after process recreation, while prior in-memory sessions are rejected and require sign-in again.
- **SC-018**: Azure Blob content-provider tests round-trip blog and page pairs, reject malformed or orphaned pairs, and detect stale ETag versions without overwriting newer content.
- **SC-019**: The Azure composition exposes Blob as its only content provider and uses identity-only Entra sign-in scopes; it makes no OneDrive or Microsoft Graph file-permission requests.
- **SC-020**: Sync tests prove that Blob blog files land under `public/blog/<year>/`, stale local posts are removed after a successful sync, and failed/empty/incomplete downloads leave the previously staged content untouched or fail the build.
- **SC-021**: The CMS host, persistent Blob content, and static site use separate resource groups; the CMS and static-blog teardown workflows cannot delete persistent CMS content.
- **SC-022**: The CMS deployment workflow runs the CMS tests before deployment, and the static publishing workflow's Blob sync tests pass before content is staged for a build.

## Assumptions

- Administrators are provisioned in an allowlist managed outside the CMS; the Configuration page does not manage administrator membership.
- Microsoft Entra ID is the identity provider for the first release; the Entra ID tenant registration and credentials are supplied by the deployment environment.
- OneDrive access, when enabled by another composition, uses the signed-in administrator's permissions; every allowlisted administrator is expected to have permission to the configured folder. The Azure Blob composition does not use OneDrive or Microsoft Graph for content.
- Existing blog content uses matched Markdown and JSON metadata files, with the required fields defined by the Fullswing content contract.
- Azure Blob Storage is the content authority for the Azure composition. OneDrive remains an optional adapter for compositions that explicitly register it. A local-file provider is included for development and uses the selected Fullswing blog `public` directory.
- Changing the selected provider changes the authoritative content source only; content migration, copying, and synchronization between providers are separate features.
- The CMS sends GitHub workflow dispatch requests; GitHub runs the workflow asynchronously, and observing workflow completion is outside this feature. The static-blog deployment workflow separately syncs Blob blog pairs into the publisher's `public/blog/` directory before building; observing the dispatched publish workflow's completion remains outside this feature.
- Local-file configuration, sessions, and secrets are held in memory by the development composition and reset when the CMS process restarts; the content files themselves persist on disk.
- The Azure Blob composition persists configuration and encrypted secrets in a private container. Its AES-256-GCM key is configured separately through the hosting environment; losing the key makes existing ciphertext unreadable, and rotation requires re-encrypting stored secrets. Sessions remain in memory and are intentionally invalidated by process restarts.
- The Azure deployment workflow provisions App Service Linux F1 in `rg-fullswing-cms` and persistent Blob Storage in `rg-fullswing-content`, separate from the static blog. F1 is a quota-limited hobby tier without a custom domain or SLA; operators accept cold starts and in-memory session loss.
- GitHub Actions uses a federated deployment identity; its object ID is explicitly granted Blob Data Reader at the content container for static publishing. Deployment permissions must include resource-group provisioning and the scoped role assignment.
- The first CMS deployment may seed an empty Blob blog prefix from the repository only through an explicit workflow input. Thereafter, Blob is authoritative and the static build syncs from Blob.
- Blob's advertised 5 GB allowance is free only for the first 12 months for eligible new accounts; usage after that period may be billed.
- Local-file blogs are compatible with the static blog generator's `public/blog/<year>/` discovery. HTML page source is stored under `public/pages/<year>/` but is not discovered or published by the current generator.
- HTML page source may be edited through the local-file provider, but HTML preview, rendering, Svelte execution, and publication remain out of scope.
- The existing shared content-domain contract and validation are the reuse boundary for both applications. Publisher-specific filesystem discovery, Markdown rendering, static layout, routes, and asset copying remain outside the CMS scope unless a separate shared need is established.
- Optional Svelte enhancements may be added later but are not required for the core administration workflows in this release.