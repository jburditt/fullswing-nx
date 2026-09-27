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

Expected result: TypeScript compilation succeeds and the native Node test runner reports passing CMS, provider-contract, authentication, and mocked-Graph tests.

## Validation Scenarios

1. **Access control**: Request Dashboard, editor, and Configuration anonymously; each returns Login without protected page content. Sign in as an allowlisted fake identity and as an unlisted identity; only the allowlisted identity receives protected content.
2. **Provider independence**: Run the provider conformance suite against the in-memory fake. Dashboard filters, metadata validation, Markdown preview, and save behavior pass without importing OneDrive/Graph modules.
3. **Provider switch**: Configure a second fake provider, validate it, and switch the active provider. Confirm the new source is read, the old fake's contents and write count remain unchanged, and a form opened against the previous configuration revision cannot save into the new source.
4. **OneDrive pagination**: Mock more than one Graph page and verify every `@odata.nextLink` is followed; the final dashboard collection contains every entry exactly once.
5. **Pair and concurrency failures**: Mock a stale eTag/412 and a failure on the second sidecar write. Verify a conflict or explicit partial-write state, no false success response, and no secret/token text in logs.
6. **Delegated folder access**: Mock a signed-in allowlisted administrator who lacks access to the configured folder. Verify dashboard/save reports a non-sensitive access failure and makes no app-only request.
7. **GitHub workflow dispatch**: With a mocked GitHub client, dispatch the saved owner/repository/workflow/ref and configured inputs using the server-side token. Verify an accepted response reports dispatch acceptance/run ID only, and invalid settings, unauthorized users, API errors, and throttling report failure without leaking the token.
8. **Preview safety**: Render Markdown containing a script, event-handler attribute, and unsafe URL. Confirm the preview output contains no active script/handler and normal headings, links, and code fences still render.
9. **Metadata contract**: Test valid metadata, invalid calendar dates, wrong route prefixes, empty categories, invalid JSON, duplicate routes, and orphaned `.md`/`.json` items. Verify invalid content is never written.

## Optional Live OneDrive Smoke Test

With the test tenant configured outside source control, sign in as an allowlisted administrator, load the configured test folder, edit one test Markdown/metadata pair, save, and reopen it. Confirm the version changes, a second browser session sees the saved data, and a deliberately stale form is rejected. Remove test content manually after validation; provider switching never performs that cleanup.

See [the storage contract](contracts/content-storage-provider.md), [the admin UI contract](contracts/admin-ui.md), and [the GitHub dispatch contract](contracts/github-workflow-dispatch.md) for integration and route behavior.