# Content Storage Provider Contract

## Purpose

This CMS-owned port separates content-management behavior from storage-specific APIs and layouts. The contract describes logical Fullswing content, not files, SQL rows, Microsoft Graph resources, or provider credentials.

## Required Operations

An implementation must provide equivalents of:

- `validateConfiguration(settings)`: verify required settings and access without changing content.
- `listEntries()`: return all normalized entry summaries; the implementation must follow provider pagination and detect malformed/orphaned pairs rather than silently omitting them.
- `readEntry(id)`: return the normalized content, metadata, and opaque version token.
- `saveBlog({ id?, expectedVersion?, markdown, metadata, configRevision })`: create or compare-and-save the complete Markdown/JSON logical pair and return a new version.
- `readPage(id)`: read/list a page for dashboard identification; HTML editing and page writes are not part of this release.

Exact TypeScript signatures belong in the implementation. Provider APIs and errors must not leak past this port.

## Invariants

1. All adapters use the same logical metadata contract and collection-level route uniqueness rules.
2. The CMS validates the complete candidate before invoking a write.
3. `saveBlog` must reject stale `expectedVersion` or `configRevision` with a typed conflict; it must not silently overwrite.
4. A save is successful only when all required pair members are stored. A provider that cannot make a multi-object update atomic must report `PartialWrite` and leave enough safe diagnostic state to repair it.
5. Provider errors are mapped to typed, non-sensitive errors. Tokens, client secrets, raw authorization headers, and secret settings are never placed in the result.
6. Implementations may paginate internally but must return a complete collection or an explicit failure; a truncated listing must not appear complete.
7. Provider selection is explicit. Unknown/unconfigured providers fail closed; there is no silent fallback.
8. A validated provider switch changes the active source only. It must not read to migrate, write, merge, or delete anything in the previous source.

## OneDrive Adapter Mapping

- Enumerate the configured drive/folder recursively via Microsoft Graph v1.0 and follow continuation links.
- Resolve provider item IDs and eTags inside the adapter. Return opaque CMS IDs/version tokens.
- Preserve the Fullswing Markdown/JSON sidecar convention in the OneDrive folder while treating the pair as one logical blog.
- Use conditional writes where supported and map Graph precondition failures to `VersionConflict`.
- On a two-item write failure, compensate where possible and return `PartialWrite` if consistency cannot be restored.
- Do not expose Graph SDK models, paths, HTTP statuses, or access tokens to CMS use cases.

## Conformance Tests

Run the same suite against an in-memory fake and every production provider. Cover configuration rejection, empty and paginated collections, valid/malformed/orphaned pairs, create/update round-trips, stale versions, invalid metadata with no writes, provider outage, first/second member write failure, and source-switch non-migration. A fake provider proves CMS workflow independence; it does not count as a shipped alternate provider.