<!--
Sync Impact Report
- Version change: 1.0.0 -> 2.0.0
- Modified principles: III. OneDrive Is the Content Authority -> III. Selected Provider Is the Content Authority; IV. Isolated, Testable Integrations expanded to include Blob Storage
- Added sections: none
- Removed sections: none
- Follow-up TODOs: TODO(RATIFICATION_DATE): The original adoption date was not recorded.
-->

# Fullswing CMS Constitution

## Core Principles

### I. Content Contract Compatibility
The CMS MUST preserve compatibility with the Fullswing blog content contract. Blog content MUST
remain a matched Markdown and JSON-sidecar pair, and metadata validation MUST use
`@fullswing/content-model` rather than duplicating its types or rules. Changes that alter published
content, metadata, or route behavior MUST include an explicit compatibility and migration plan.

### II. Secure Administration by Default
Every route other than Login MUST require authenticated administrative access. OAuth credentials,
access tokens, refresh tokens, storage credentials, and other integration secrets MUST NOT be
committed, rendered to clients, or logged. Authorization failures and integration errors MUST be
explicit to the administrator without revealing sensitive values.

### III. Selected Provider Is the Content Authority
The content provider explicitly registered and selected by a deployment composition is authoritative
for blog and HTML content. The Azure Blob composition MUST use Azure Blob Storage as its sole content
authority; OneDrive MAY be registered by other compositions. Reads and writes MUST validate file
names, paired content files, and metadata before changing remote state. A failed or incomplete write
MUST NOT be presented as successful or leave an unreported content mismatch. Changing the content
authority MUST require an explicit compatibility and migration plan; deployments MUST NOT silently
fall back to or synchronize another provider.

### IV. Isolated, Testable Integrations
Blob Storage, OneDrive, OAuth, and database-access abstractions MUST be isolated behind typed
interfaces so their behavior can be tested without live third-party services. New or changed
integration contracts MUST have automated tests for success, authentication failure, validation
failure, concurrency conflicts, and provider-error paths. This keeps administrative content changes
reliable and repeatable.

### V. Accessible, Progressive Authoring Experience
The CMS MUST function for core administration without requiring optional Svelte web components.
Interactive enhancements MUST preserve accessible keyboard operation, labels, status changes, and
error messages. Markdown editing MUST visibly distinguish valid from invalid content and provide a
formatted preview that cannot execute untrusted author content.

## Implementation Constraints

The CMS MUST use TypeScript and Node.js 20.19 or later. It MUST retain NodeNext ESM conventions,
including `.js` extensions for relative TypeScript imports. Shared content-domain behavior MUST
reside in root workspace libraries when it is consumed by both the CMS and static blog; CMS-only
behavior MUST remain within the CMS application. Dependencies introduced for OAuth, Azure Blob
Storage, OneDrive, or Svelte components MUST have a documented purpose and a maintained version.

## Development Workflow

Each material change MUST start with an approved specification that states affected content
contracts, authorization behavior, and synchronization outcomes. Implementation MUST add or update
automated tests before merge, and the relevant CMS compile and test tasks MUST pass. Reviewers MUST
verify compliance with this constitution, especially authentication boundaries, secret handling,
metadata validation, selected-provider authority, and provider failure behavior.

## Governance

This constitution supersedes conflicting local practices for Fullswing CMS. Amendments MUST document
the rationale, affected principles, compatibility impact, and a migration plan when applicable.
Constitution versions follow semantic versioning: MAJOR for incompatible principle redefinitions or
removals, MINOR for added principles or materially expanded governance, and PATCH for clarifications
that preserve meaning. Every pull request affecting CMS architecture, content contracts, security,
or integrations MUST include a compliance review against these principles.

**Version**: 2.0.0 | **Ratified**: TODO(RATIFICATION_DATE): The original adoption date was not recorded. | **Last Amended**: 2026-10-02
