# Feature Specification: Fullswing CMS Admin Content Management

**Feature Branch**: `001-admin-content-management`

**Created**: 2026-09-26

**Status**: Draft

**Input**: User description: Create a CMS for managing Fullswing blog Markdown and HTML page content stored in a configured OneDrive folder. Admins sign in, browse and filter content, edit Markdown and metadata with validation and preview, and configure OneDrive and GitHub Action settings. HTML editing is a placeholder for now.

## Clarifications

### Session 2026-09-26

- Q: When an administrator changes the selected storage provider, what should happen to content in the previous provider? → A: The new provider becomes authoritative; the previous provider is left unchanged, and migration is separate.
- Q: Which identity provider should administrators use to sign in to the CMS for its first release? → A: Microsoft Entra ID.
- Q: Should the CMS access OneDrive as the signed-in administrator using their file permissions, or as a separate app identity with tenant-granted file permissions? → A: Use the signed-in administrator's delegated access; each allowlisted administrator must have access to the configured folder.

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

An administrator reads and saves blog and page content through the configured content storage service. OneDrive is the initial supported service. The CMS's dashboard and authoring workflows do not depend on OneDrive-specific behavior, so another supported service can be selected without rewriting those workflows.

**Why this priority**: The CMS must manage the same source of content that the publishing workflow consumes, report incomplete writes accurately, and allow storage services to evolve independently from content-management workflows.

**Independent Test**: Exercise successful reads and writes, provider failures, and failures while saving a matched blog and metadata pair; then substitute a test provider that meets the same content-storage contract and verify that the dashboard and authoring workflows behave unchanged.

**Acceptance Scenarios**:

1. **Given** the configured OneDrive service is accessible, **When** the administrator loads the dashboard, **Then** the listed content reflects the available stored content.
2. **Given** an administrator saves a valid blog change, **When** both content and metadata are stored successfully by the selected service, **Then** the CMS confirms the save and a subsequent read returns the saved values.
3. **Given** a read or write fails in the selected service, **When** the operation ends, **Then** the CMS reports failure without presenting stale or partial data as successfully saved.
4. **Given** saving either member of a blog and metadata pair fails, **When** the operation ends, **Then** the CMS does not report success and identifies any inconsistency that needs resolution.
5. **Given** stored content changes after an administrator loaded it, **When** that administrator tries to overwrite it, **Then** the CMS detects the conflict and requires review of the newer content before replacement.
6. **Given** another service has been added by implementing the content-storage contract, **When** an administrator selects that supported service in configuration, **Then** the dashboard, filtering, editing, validation, and preview workflows operate without provider-specific changes.
7. **Given** an administrator changes the selected provider, **When** the configuration is saved, **Then** the new provider becomes the active content source, the previous provider's content remains unchanged, and no automatic migration occurs.
8. **Given** an allowlisted administrator does not have access to the configured OneDrive folder, **When** they load or save content, **Then** the CMS reports an access error and does not present the operation as successful.

### User Story 5 - Configure Integrations (Priority: P2)

An administrator reviews and updates the configuration values required for the OneDrive connection and GitHub Action invocation.

**Why this priority**: Integration settings enable content access and the existing deployment workflow while keeping credentials under administrative control.

**Independent Test**: As an administrator, save valid and incomplete configuration, revisit the page, and verify values, validation, and secret masking; confirm a non-administrator cannot access the page.

**Acceptance Scenarios**:

1. **Given** an administrator opens Configuration, **When** the page loads, **Then** it shows the selected supported content-storage service and its settings, the GitHub Action settings, and any missing required values.
2. **Given** the administrator enters valid configuration for a supported service, **When** they save it, **Then** the CMS confirms the configuration was stored and available non-secret values can be reviewed later.
3. **Given** a saved value is secret, **When** the configuration page is revisited, **Then** the secret is masked and is not disclosed in page content or application logs.
4. **Given** required configuration is incomplete or invalid, **When** the administrator saves it, **Then** the CMS identifies the affected values and does not claim the integration is ready.

### User Story 6 - Reach the HTML Page Placeholder (Priority: P3)

An administrator can navigate to the HTML page area, while HTML authoring remains deliberately unavailable in this release.

**Why this priority**: The navigation and destination can be established without implying that HTML editing or embedded component execution is ready.

**Independent Test**: Open the HTML page destination as an administrator and verify it displays a clear placeholder without changing stored content.

**Acceptance Scenarios**:

1. **Given** an administrator chooses the HTML page destination, **When** the destination opens, **Then** it displays a blank-state placeholder and does not offer controls that modify HTML content.
2. **Given** HTML page entries exist in the content store, **When** the administrator views the dashboard, **Then** those entries can be identified as pages without executing their content.

### Edge Cases

- An authentication session expires while an administrator is editing; unsaved work is not silently discarded, and access requires renewed authentication.
- The identity provider is unavailable or returns an authentication failure; the CMS denies protected access and displays a non-sensitive error.
- The configured administrator allowlist is empty or an account's identity cannot be matched; access is denied by default.
- The selected content-storage service is unavailable, access is revoked, or content changes during an edit; the CMS reports the condition and does not claim an unsuccessful read or write succeeded.
- An allowlisted administrator lacks permission to the configured OneDrive folder; OneDrive access fails explicitly and the CMS does not fall back to app-only access.
- A storage service is not supported or its configuration is incomplete; the CMS does not silently fall back to another service or present content from the wrong source.
- The selected provider changes while the previous provider contains content; the previous provider remains unchanged, and the CMS does not automatically copy, merge, or migrate its content.
- A Markdown file has no metadata pair, its metadata is malformed, its route conflicts with another entry, or required metadata is missing; the item is not silently accepted as valid.
- A date is malformed or not a real calendar date, or categories are missing or empty; validation identifies the invalid metadata.
- Markdown contains raw HTML, scripts, or event handlers; the preview does not execute active content.
- A dashboard filter produces no matches or the underlying folder contains no entries; the page shows an empty state rather than an error.
- A secret has not been configured, is rejected by an integration, or is replaced; the UI and logs do not disclose its value.
- An HTML page is selected for editing before that capability is implemented; the CMS leaves it read-only and shows the placeholder.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every page other than Login MUST require an authenticated administrator session.
- **FR-002**: The CMS MUST use Microsoft Entra ID's currently supported OAuth sign-in flow and MUST authorize only accounts on the configured administrator allowlist.
- **FR-003**: The CMS MUST provide Logout, end the active session, and require authentication on the next protected-page request.
- **FR-004**: The shared page layout MUST provide Fullswing branding, navigation to Dashboard, blog/page authoring, and Configuration, and a Logout control. Main page content MUST be horizontally centered.
- **FR-005**: The Dashboard MUST list available blog and page entries and support filtering by content type, title, date range, author, and category, including combined filters and a clear-filters action.
- **FR-006**: The Markdown authoring page MUST allow an administrator to create or edit blog Markdown and the associated metadata, switch between editing and formatted preview, and see a status change when validation results change.
- **FR-007**: The Markdown and metadata validation status MUST be understandable without relying on color alone and MUST identify the fields or content that need correction.
- **FR-008**: A blog's metadata MUST remain compatible with the existing Fullswing content contract, including its route, title, author, date, and categories; invalid or incomplete metadata MUST be rejected before storage.
- **FR-009**: The Markdown preview MUST NOT execute scripts, event handlers, or other active content supplied in stored or edited content.
- **FR-010**: The CMS MUST access blog and HTML page content through a provider-neutral content-storage capability; the configured OneDrive folder MUST be the authoritative store when OneDrive is selected.
- **FR-011**: The CMS MUST report successful saves only after all required content for that save has been stored; failed or partial writes MUST be reported and MUST identify any unresolved content mismatch.
- **FR-012**: The CMS MUST detect when an item has changed since it was loaded and MUST prevent an unreviewed overwrite of the newer content.
- **FR-013**: The Configuration page MUST allow administrators to select a supported content-storage provider and manage its required settings, as well as the values needed for GitHub Action invocation; it MUST identify missing or invalid required values. Saving a provider change MUST make the newly selected provider authoritative without modifying or migrating content in the previous provider.
- **FR-014**: OAuth credentials, access tokens, refresh tokens, OneDrive secrets, and other secret configuration values MUST NOT be committed, exposed in client-visible page content, or logged. Saved secrets MUST be masked when configuration is revisited.
- **FR-015**: The CMS MUST provide an HTML page destination that displays a placeholder; HTML editing, saving, and embedded Svelte execution are out of scope for this release.
- **FR-016**: The core administration and authoring workflows MUST remain usable without optional Svelte web components, and validation, status, navigation, and error feedback MUST be accessible by keyboard and assistive technology.
- **FR-017**: A content-storage provider or identity-provider failure MUST produce an explicit, non-sensitive error and MUST NOT be represented as a successful operation.
- **FR-018**: Provider-specific storage behavior MUST be isolated from dashboard, filtering, authoring, validation, and preview workflows behind a common content-storage contract. Adding a provider that satisfies this contract MUST NOT require rewriting those workflows.
- **FR-019**: OneDrive operations MUST use delegated access for the currently signed-in administrator. Each allowlisted administrator MUST have access to the configured folder; missing folder access MUST be reported without falling back to an independent app identity.

### Key Entities *(include if feature involves data)*

- **Blog Entry**: A Markdown blog item and its associated metadata, including route, title, author, date, and one or more categories.
- **Page Entry**: An HTML page item surfaced in the dashboard; HTML authoring and execution are deferred in this release.
- **Content Storage Provider**: A configured service that reads and writes content using the CMS content-storage contract; OneDrive is the initial supported provider.
- **Administrator**: An authenticated identity that is authorized by the configured administrator allowlist.
- **Integration Configuration**: The selected content-storage provider and its settings, together with the values needed to configure GitHub Action invocation; secrets are protected and masked.
- **Edit Version**: The version of an item an administrator loaded, used to detect whether the stored item changed before a save.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of unauthenticated requests to protected pages show Login without exposing protected page content.
- **SC-002**: 100% of sign-in attempts by identities outside the configured administrator allowlist are denied access to protected pages.
- **SC-003**: For a test collection with known metadata, every individual and combined dashboard filter returns exactly the entries matching the selected criteria.
- **SC-004**: 100% of valid blog create/edit test cases round-trip the Markdown and required metadata through the configured content store; 100% of invalid test cases leave stored content unchanged.
- **SC-005**: No active script or event-handler test payload executes in the Markdown preview.
- **SC-006**: Every simulated read, write, partial-write, and stale-edit failure is reported as a failure, with no false success confirmation.
- **SC-007**: Saved secret values remain undisclosed in the revisited configuration page, browser-visible page content, and application logs.
- **SC-008**: Administrators can reach the HTML page placeholder, and the placeholder provides no means to modify or execute HTML content.
- **SC-009**: A test content-storage provider that satisfies the common contract can be selected and used for dashboard reads and content saves without changing CMS dashboard or authoring workflows.

## Assumptions

- Administrators are provisioned in an allowlist managed outside the CMS; the Configuration page does not manage administrator membership.
- Microsoft Entra ID is the identity provider for the first release; the Entra ID tenant registration and credentials are supplied by the deployment environment.
- OneDrive Graph access is delegated to the signed-in administrator; every allowlisted administrator is expected to have permission to the configured folder.
- Existing blog content uses matched Markdown and JSON metadata files, with the required fields defined by the Fullswing content contract.
- OneDrive is the initial supported content-storage provider and is authoritative when selected. Future providers such as Google Drive, local files, or a database are not delivered by this feature; each can be added by implementing the common content-storage contract and providing its configuration, without rewriting CMS workflows.
- Changing the selected provider changes the authoritative content source only; content migration, copying, and synchronization between providers are separate features.
- The Configuration page manages integration settings but does not itself trigger a GitHub Action run; action execution remains with the existing external workflow/API caller.
- HTML page records can be identified in the dashboard, but HTML authoring, preview, saving, and Svelte execution are intentionally deferred.
- The existing shared content-domain contract and validation are the reuse boundary for both applications. Publisher-specific filesystem discovery, Markdown rendering, static layout, routes, and asset copying remain outside the CMS scope unless a separate shared need is established.
- Optional Svelte enhancements may be added later but are not required for the core administration workflows in this release.