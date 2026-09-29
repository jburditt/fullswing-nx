# Quickstart: CMS Admin Content Management Validation

## Prerequisites

- Node.js 20.19 or later and npm dependencies installed at the workspace root.
- For automated checks, no Microsoft tenant, OneDrive credentials, GitHub credentials, or network access is required; integrations use test doubles.
- For a manual OneDrive smoke test, a test Entra app/tenant, an allowlisted test administrator, a test OneDrive folder shared with that administrator, and deployment-side secret configuration are required.

## Automated Validation

Run from the workspace root:

```bash
npm exec nx run fullswing-cms:compile
npm exec nx run fullswing-cms:test
```

Expected result: TypeScript compilation succeeds and the native Node test runner reports passing CMS, provider-contract, authentication, mocked-Graph, configuration, GitHub dispatch, and page-placeholder tests.

## Validation Scenarios

1. **Application composition and access control**: `bootstrap.test.ts` verifies routes are mounted; `auth-routes.test.ts`, `dashboard.test.ts`, `blog-editor.test.ts`, `configuration.test.ts`, and `github-dispatch-route.test.ts` verify protected endpoints and CSRF enforcement.
2. **Provider independence and switching**: `content-storage-provider.test.ts` and `provider-selection.test.ts` exercise the storage contract, invalid-candidate preservation, and non-migrating valid switches using fakes.
3. **OneDrive listing**: `onedrive-list.test.ts` verifies nested folders, continuation links, matched pairs, malformed metadata, orphaned sidecars, and duplicate routes.
4. **OneDrive concurrency and partial writes**: `onedrive-save.test.ts` verifies stale versions, Graph 412 eTag races, successful pair updates, first/second-write failures, compensation, and explicit partial-write errors.
5. **Delegated access and errors**: `onedrive-configuration.test.ts` verifies the signed-in session token-cache reference reaches the OneDrive gateway factory; `onedrive-errors.test.ts` checks authorization, throttling, conflict, and sanitized provider errors.
6. **GitHub dispatch**: `github-workflow-dispatch.test.ts` and `github-dispatch-route.test.ts` verify saved-target-only requests, masked credentials, accepted status/run details, authorization, CSRF, and safe API failures without claiming workflow completion.
7. **Page placeholder**: `page-placeholder.test.ts` and `page-listing.test.ts` verify page discovery without retrieving or rendering stored HTML and expose no edit/save controls.
8. **Preview and metadata safety**: `markdown-preview.test.ts`, `blog-editor.test.ts`, and the content-model metadata tests cover sanitizer behavior, valid metadata, invalid dates/routes, duplicate routes, and rejection before writes.

## Optional Live OneDrive Smoke Test

With the deployment composition and test tenant configured outside source control, sign in as an allowlisted administrator, load the configured test folder, edit one test Markdown/metadata pair, save, and reopen it. Confirm the version changes, a second browser session sees the saved data, and a deliberately stale form is rejected. Verify Graph honors `If-Match` on the file-content endpoint in that test drive before relying on remote compare-and-save behavior. Remove test content manually after validation; provider switching never performs that cleanup.

See [the storage contract](contracts/content-storage-provider.md), [the admin UI contract](contracts/admin-ui.md), and [the GitHub dispatch contract](contracts/github-workflow-dispatch.md) for integration and route behavior.