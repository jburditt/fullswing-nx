# Quickstart: CMS Admin Content Management Validation

## Prerequisites

- Node.js 20.19 or later and npm dependencies installed at the workspace root.
- For automated checks, no Microsoft tenant, OneDrive credentials, GitHub credentials, or network access is required; integrations use test doubles.
- For a OneDrive adapter smoke test in a composition that registers OneDrive, a test Entra app/tenant, an allowlisted administrator, and a test OneDrive folder shared with that administrator are required.
- For the Azure composition smoke test, an Azure Storage account and private Blob container (or permission for the composition to create it), plus the required host settings below, are required. No Microsoft Graph file permission or OneDrive folder is needed.

## Automated Validation

Run from the workspace root:

```bash
npm exec nx run fullswing-cms:compile
npm exec nx run fullswing-cms:test
```

Expected result: TypeScript compilation succeeds and the native Node test runner reports passing CMS, provider-contract, authentication, mocked-Graph, Blob content/runtime persistence, configuration, GitHub dispatch, local-file provider, and page-route tests.

## Validation Scenarios

1. **Application composition and access control**: `bootstrap.test.ts` verifies routes are mounted; `auth-routes.test.ts`, `dashboard.test.ts`, `blog-editor.test.ts`, `configuration.test.ts`, and `github-dispatch-route.test.ts` verify protected endpoints and CSRF enforcement.
2. **Provider independence and switching**: `content-storage-provider.test.ts` and `provider-selection.test.ts` exercise the storage contract, invalid-candidate preservation, and non-migrating valid switches using fakes.
3. **OneDrive listing**: `onedrive-list.test.ts` verifies nested folders, continuation links, matched pairs, malformed metadata, orphaned sidecars, and duplicate routes.
4. **OneDrive concurrency and partial writes**: `onedrive-save.test.ts` verifies stale versions, Graph 412 eTag races, successful pair updates, first/second-write failures, compensation, and explicit partial-write errors.
5. **Delegated access and errors**: `onedrive-configuration.test.ts` verifies the signed-in session token-cache reference reaches the OneDrive gateway factory; `onedrive-errors.test.ts` checks authorization, throttling, conflict, and sanitized provider errors.
6. **GitHub dispatch**: `github-workflow-dispatch.test.ts` and `github-dispatch-route.test.ts` verify saved-target-only requests, masked credentials, accepted status/run details, authorization, CSRF, and safe API failures without claiming workflow completion.
7. **Page source handling**: `page-placeholder.test.ts` and `page-listing.test.ts` verify read-only providers expose no edit/save controls and never render stored HTML; `file-content-provider.test.ts` verifies local HTML/metadata save and readback.
8. **Local file storage**: `file-content-provider.test.ts` verifies blog and page sidecar pairs are stored under the configured public directory and metadata year, duplicate blog basenames remain addressable, stale versions are rejected, and changing years moves the pair.
9. **Preview and metadata safety**: `markdown-preview.test.ts`, `blog-editor.test.ts`, and the content-model metadata tests cover sanitizer behavior, valid metadata, invalid dates, duplicate routes, and rejection before writes.
10. **Blob runtime persistence**: `blob-stores.test.ts` verifies configuration round-trips, stale-revision conflicts, encrypted secret round-trips, deletion, tamper rejection, and wrong-key rejection using an in-memory Blob fake.
11. **Blob content provider**: `blob-content-provider.test.ts` verifies blog and page pair round-trips, year-prefixed routing, ETag conflict detection, and rejection of orphaned or malformed pairs. Bootstrap and Entra tests verify the Azure composition can exclude OneDrive and use identity-only scopes.

## Optional Local File Smoke Test

From the repository root, select the local file composition and start the CMS:

```powershell
$env:CMS_BOOTSTRAP_MODULE = './file-composition.mjs'
npm --workspace=fullswing-cms run start
```

The local composition defaults to `apps/fullswing-blog/public`; the Configuration page can select another existing writable public directory. Blogs are written to `blog/<year>/<basename>.md` and `.json`. Pages are written to `pages/<year>/<basename>.html` and `.json`. The composition's configuration, session, and secret stores are in memory, so provider settings reset when the process restarts. The CMS does not render stored HTML, and the static blog generator does not publish local page pairs.

## Optional Azure Blob Composition Smoke Test

Build the CMS, then run it with `CMS_BOOTSTRAP_MODULE=./blob-composition.mjs`. Configure `CMS_BLOB_CONNECTION_STRING`, optional `CMS_BLOB_CONTAINER_NAME`, `CMS_SECRET_ENCRYPTION_KEY`, `CMS_ENTRA_TENANT_ID`, `CMS_ENTRA_CLIENT_ID`, `CMS_ENTRA_CLIENT_SECRET`, `CMS_ENTRA_REDIRECT_URI`, `CMS_ADMIN_OBJECT_IDS`, and `CMS_SESSION_COOKIE_SECRET` in the host environment. Generate a fresh encryption key with:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Keep the key outside the Blob container and back it up securely. Verify the container is private, sign in as an allowlisted administrator, select Azure Blob Storage, and configure the GitHub workflow. Create and edit a blog and an HTML page; confirm the pairs appear under `content/blog/<year>/` and `content/pages/<year>/`, then force a stale edit and confirm it is rejected. Restart the CMS: content, configuration, and credentials remain stored, while the administrator must sign in again because sessions are in memory. Confirm OneDrive is not offered or called. This smoke test covers CMS persistence only: the current static blog deployment builds from repository content and does not yet publish Blob-stored CMS content. The composition also does not provision an Azure Node host, storage account, or HTTPS endpoint.

## Optional OneDrive Adapter Smoke Test

Only for a non-Azure composition that registers OneDrive: configure a test tenant and folder outside source control, sign in as an allowlisted administrator, edit one test Markdown/metadata pair, and verify save/readback and stale-edit rejection. Remove test content manually after validation; provider switching never performs migration or cleanup.

See [the storage contract](contracts/content-storage-provider.md), [the admin UI contract](contracts/admin-ui.md), and [the GitHub dispatch contract](contracts/github-workflow-dispatch.md) for integration and route behavior.