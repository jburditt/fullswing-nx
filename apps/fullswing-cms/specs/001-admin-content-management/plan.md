# Implementation Plan: Fullswing CMS Admin Content Management

**Branch**: `001-admin-content-management` | **Date**: 2026-09-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `apps/fullswing-cms/specs/001-admin-content-management/spec.md`

## Summary

Build the CMS as a server-rendered Node.js application whose use cases depend on a CMS-owned content-storage port. Register OneDrive as the only production provider in this feature, using Microsoft Graph behind that port. Provider configuration is validated before becoming active; switching sources does not copy or change content in the previous source. Reuse shared Fullswing metadata validation and a shared Markdown renderer, while keeping provider adapters, authentication, and CMS workflows in the CMS app.

## Technical Context

**Language/Version**: TypeScript 5.9, Node.js >=20.19, NodeNext ESM

**Primary Dependencies**: `@fullswing/content-model`; planned Fastify HTTP host; `@azure/msal-node` for Microsoft Entra authentication; Microsoft Graph JavaScript SDK inside the OneDrive adapter; `marked` and Prism in the shared Markdown renderer; an HTML sanitizer at the CMS preview boundary

**Storage**: OneDrive folder via Microsoft Graph is the initial authoritative content store. CMS-owned provider configuration and auth-session/token caches use a separate server-side configuration/session boundary; deployment backing services are not selected by this feature.

**Testing**: TypeScript compile plus native `node:test` through Nx; CMS service tests, storage-provider contract tests, mocked Graph integration tests, and Entra/session tests with test doubles

**Target Platform**: Node.js server with browser-accessible, server-rendered HTML. Hosting and deployment are outside this feature.

**Project Type**: Server-rendered web application in the existing `apps/fullswing-cms` workspace project

**Performance Goals**: No latency or throughput SLO is specified. OneDrive enumeration must follow all Graph continuation links; dashboard filtering and pagination operate on normalized metadata.

**Constraints**: Protect all routes except Login and OAuth callbacks; keep tokens server-side; preserve the matched Markdown/JSON contract; never report a partial pair write as successful; require provider compare-and-save for edits; no automatic provider migration; HTML editing and Svelte execution are deferred.

**Scale/Scope**: One Fullswing content collection and one selected provider per deployment. OneDrive is the only shipped provider. No content-count or concurrent-user target is specified.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Content Contract Compatibility**: PASS. Keep Markdown and JSON sidecars as a logical blog pair and use shared metadata validation. Introduce a pure JSON parser in `@fullswing/content-model`; retain `loadMetadata()` as the static blog filesystem wrapper.
- **II. Secure Administration by Default**: PASS. Entra authentication, allowlist checks, server-side session/token cache, CSRF protection on writes, and secret redaction are cross-cutting gates.
- **III. OneDrive Is the Content Authority**: PASS FOR THIS RELEASE. OneDrive is the only registered production provider. The abstraction does not make Google Drive, local files, or databases supported in this feature. Enabling a future non-OneDrive provider requires a constitution review because it changes Principle III's authority statement.
- **IV. Isolated, Testable Integrations**: PASS. Authentication and provider operations are behind typed ports; fake providers and mocked Graph responses cover success, validation, auth, conflict, and provider failure.
- **V. Accessible, Progressive Authoring Experience**: PASS. Core forms and status feedback work without Svelte web components; Markdown preview is sanitized before display and remains keyboard accessible.
- **Implementation Constraints**: PASS. Keep CMS-only code in `apps/fullswing-cms`, and place only behavior genuinely shared with the static blog in root libraries.
- **Development Workflow**: PASS. Planning precedes implementation; add focused tests and run CMS compile/test Nx targets.

## Project Structure

### Documentation (this feature)

```text
apps/fullswing-cms/specs/001-admin-content-management/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output (/speckit-plan command)
├── data-model.md        # Phase 1 output (/speckit-plan command)
├── quickstart.md        # Phase 1 output (/speckit-plan command)
├── contracts/           # Phase 1 output (/speckit-plan command)
└── tasks.md             # Phase 2 output (/speckit-tasks command - NOT created by /speckit-plan)
```

### Source Code

```text
apps/fullswing-cms/
├── src/
│   ├── auth/                 # Entra login, callback, allowlist, sessions
│   ├── config/               # Provider selection and app settings
│   ├── content/
│   │   ├── application/      # Dashboard, validation, and authoring use cases
│   │   ├── domain/           # CMS normalized records and errors
│   │   └── storage/          # Port, provider registry, OneDrive adapter
│   ├── server/               # Fastify routes and request guards
│   ├── views/                # Server-rendered pages and forms
│   ├── assets/               # Progressive-enhancement client assets
│   └── index.ts
└── test/
    ├── unit/
    ├── contract/
    └── integration/

libs/content-model/src/
├── metadata.ts               # Pure metadata parsing plus filesystem wrapper
└── ...                       # Existing shared content-domain types/repository

libs/markdown-renderer/src/
└── ...                       # Extracted shared Marked/Prism rendering behavior
```

**Structure Decision**: Keep request handling, auth, configuration, use cases, and every storage adapter inside the CMS application. Add the provider port at `apps/fullswing-cms/src/content/storage`; route and application services receive a provider instance through startup composition and never import OneDrive or Graph types. Extract metadata parsing and Markdown rendering into their existing/new shared library boundaries because both apps consume those behaviors. `@fullswing/content-model`'s current `ContentRepository` remains a normalized in-memory read model, not a persistence adapter: its `BlogEntry` and `PageEntry` shapes contain publisher filesystem/module paths and must not become the CMS storage interface.

## Complexity Tracking

No constitution violations are proposed. The new Markdown renderer library is justified by the need for the CMS preview and static publisher to share one rendering implementation; provider adapters remain CMS-local.
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
