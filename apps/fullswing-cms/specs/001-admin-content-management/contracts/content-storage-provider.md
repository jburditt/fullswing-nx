# Content Storage Provider Contract

## Purpose

This CMS-owned port separates content-management behavior from storage-specific APIs and layouts. The contract describes logical Fullswing content, not files, SQL rows, Microsoft Graph resources, or provider credentials.

## Required Operations

An implementation must provide equivalents of:

- `validateConfiguration(settings)`: verify required settings and access without changing content.
- `listEntries()`: return all normalized entry summaries; the implementation must follow provider pagination and detect malformed/orphaned pairs rather than silently omitting them.
- `readEntry(id)`: return the normalized content, metadata, and opaque version token.
- `saveBlog({ id?, expectedVersion?, markdown, metadata, configRevision })`: create or compare-and-save the complete Markdown/JSON logical pair and return a new version.
- `readPage(id)`: read/list a page for dashboard identification and return HTML source only when supported by the provider.
- `savePage({ id?, expectedVersion?, html, metadata, configRevision })`: providers that support page authoring create or compare-and-save the complete HTML/JSON logical pair. Providers without page-write support leave pages read-only.

Exact TypeScript signatures belong in the implementation. Provider APIs and errors must not leak past this port.

## Invariants

1. All adapters use the same logical metadata contract and collection-level route uniqueness rules.
2. The CMS validates the complete candidate before invoking a write.
3. `saveBlog` must reject stale `expectedVersion` or `configRevision` with a typed conflict; it must not silently overwrite.
4. `savePage`, when supported, has the same stale-version and stale-configuration guarantees as `saveBlog`.
5. A save is successful only when all required pair members are stored. A provider that cannot make a multi-object update atomic must report `PartialWrite` and leave enough safe diagnostic state to repair it.
6. Provider errors are mapped to typed, non-sensitive errors. Tokens, client secrets, raw authorization headers, and secret settings are never placed in the result.
7. Implementations may paginate internally but must return a complete collection or an explicit failure; a truncated listing must not appear complete.
8. Provider selection is explicit. Unknown/unconfigured providers fail closed; there is no silent fallback.
9. A validated provider switch changes the active source only. It must not read to migrate, write, merge, or delete anything in the previous source.
10. HTML page source is data, not executable CMS markup. The CMS must escape it in editor forms and must never render it as trusted HTML.

## Local File Adapter Mapping

- Local-file storage is a development provider, not a replacement for the selected deployment authority.
- The configured public directory is validated as an existing writable directory before activation.
- Blogs are stored as matched Markdown/JSON pairs under `blog/<YYYY>/`; pages are stored as matched HTML/JSON pairs under `pages/<YYYY>/`. `<YYYY>` comes from the metadata date.
- Basenames are restricted to lowercase letters, digits, and hyphens. Provider IDs are opaque and distinguish entries by kind, year, and basename.
- Same-basename blogs in different years follow the static publisher's year-prefixed route behavior. Page basenames must remain route-unique.
- A save that moves a pair between year directories writes the new pair before removing the old pair; failed compensation is reported as a partial write.
- The static blog generator discovers the blog pairs under `public/blog/`; it does not currently discover or publish HTML pairs under `public/pages/`.

## OneDrive Adapter Mapping

- Enumerate the configured drive/folder recursively via Microsoft Graph v1.0 and follow continuation links.
- Make Graph requests using delegated access for the currently signed-in administrator. The administrator must already have access to the configured folder; permission failure is explicit, and app-only access is not a fallback.
- Resolve provider item IDs and eTags inside the adapter. Return opaque CMS IDs/version tokens.
- Preserve the Fullswing Markdown/JSON sidecar convention in the OneDrive folder while treating the pair as one logical blog.
- Use conditional writes where supported and map Graph precondition failures to `VersionConflict`.
- On a two-item write failure, compensate where possible and return `PartialWrite` if consistency cannot be restored.
- Do not expose Graph SDK models, paths, HTTP statuses, or access tokens to CMS use cases.

## Azure Blob Adapter Mapping

- The Azure composition registers Blob as its sole content provider and does not register OneDrive or fall back to another provider.
- Store blogs under `<content-prefix>/blog/<YYYY>/<basename>.md` and `.json`; store pages under `<content-prefix>/pages/<YYYY>/<basename>.html` and `.json`. The default content prefix is `content`.
- Use Blob ETags as opaque pair versions and conditional writes to reject stale body or metadata updates. Blob does not transact both pair members atomically; compensate a failed second write and report `PartialWrite` if consistency cannot be restored.
- Keep content under its prefix separate from runtime configuration and encrypted secrets in the same private container.
- The Azure composition signs administrators in using OIDC identity scopes and does not request Microsoft Graph file permissions.

## Conformance Tests

Run contract tests against an in-memory fake and provider-focused tests against each adapter. Cover configuration rejection, empty and paginated collections, valid/malformed/orphaned pairs, create/update round-trips, stale versions, invalid metadata with no writes, provider outage, first/second member write failure, compensation, and source-switch non-migration. Blob tests additionally cover year-based names, ETag preconditions, Blob-only registration, and blog/page round-trips. Local-file tests cover year-based paths, duplicate blog basenames, page source round-trips, and escaped form handling. A fake provider proves CMS workflow independence; it does not count as a shipped alternate production provider.