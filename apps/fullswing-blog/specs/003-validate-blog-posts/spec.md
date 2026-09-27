# Feature Specification: Validate Blog Posts

**Feature Branch**: `003-validate-blog-posts`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "Markdown blog posts are placed in a year folder beneath the blog
content area with same-basename metadata sidecars. Metadata includes a route, title, categories,
author, and ISO date. The build recursively discovers year folders and fails fast for an unmatched
post or metadata sidecar."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Publish a Complete Blog Post (Priority: P1)

A content author places a Markdown post and its matching metadata in a year folder and can publish
the post without registering it separately.

**Why this priority**: Automatically discovering complete posts is the core authoring workflow.

**Independent Test**: Add one complete post-and-metadata pair to a nested year folder, publish the
site, and confirm that the post is available at its friendly route.

**Acceptance Scenarios**:

1. **Given** a Markdown post and same-basename metadata in a year folder, **When** the author
   publishes the site, **Then** the post is discovered and published at the route derived from its
   basename.
2. **Given** a post in a nested year folder, **When** the author publishes the site, **Then** the
   post is discovered without requiring the year in its published route.
3. **Given** multiple complete posts in separate year folders, **When** the author publishes the
   site, **Then** every post is discovered exactly once.

---

### User Story 2 - Receive Actionable Authoring Errors (Priority: P2)

A content author receives a clear failure before publication when a post is incomplete or its
metadata is invalid.

**Why this priority**: Authors need to correct source problems before an incomplete site is
published.

**Independent Test**: Publish content containing each invalid source case and verify that the
failure identifies the offending file and violated rule.

**Acceptance Scenarios**:

1. **Given** a Markdown post without matching metadata, **When** the author publishes the site,
   **Then** publishing stops and identifies the unmatched post.
2. **Given** metadata without matching Markdown, **When** the author publishes the site, **Then**
   publishing stops and identifies the unmatched metadata.
3. **Given** a complete pair with invalid or incomplete metadata, **When** the author publishes
   the site, **Then** publishing stops and identifies the invalid field or route mismatch.

---

### User Story 3 - Organize Posts by Year (Priority: P3)

A content author can organize posts into year-based folders without changing the public identity of
an existing post.

**Why this priority**: Chronological source organization keeps authoring manageable while stable
public routes avoid broken shared links.

**Independent Test**: Move a complete post pair from one year folder to another, publish the site,
and confirm that its public route is unchanged.

**Acceptance Scenarios**:

1. **Given** a complete post pair moved between year folders with the same basename, **When** the
   author publishes the site, **Then** the published route remains unchanged.
2. **Given** two posts that would derive the same public route, **When** the author publishes the
   site, **Then** publishing stops and identifies the conflict.

### Edge Cases

- An empty year folder does not prevent publication of valid content in other folders.
- A date that matches the required format but is not a real calendar date is rejected.
- Empty strings, an empty category list, or a category containing only whitespace are rejected.
- Files with unrelated extensions do not become blog posts or metadata records.
- Moving only one half of a post pair produces an unmatched-file failure.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST discover Markdown blog posts recursively under the blog content
  area, including posts stored in year-based subfolders.
- **FR-002**: The system MUST require each discovered Markdown post to have a metadata sidecar
  with the same basename in the same folder.
- **FR-003**: The system MUST require each discovered metadata sidecar to have a Markdown post
  with the same basename in the same folder.
- **FR-004**: The system MUST stop publication before producing a successful site when either side
  of a required post pair is missing, and MUST identify the unmatched source.
- **FR-005**: The system MUST require metadata to include non-empty route, title, author, and
  categories values, plus a valid calendar date in `YYYY-MM-DD` format.
- **FR-006**: The system MUST require at least one non-empty category for every blog post.
- **FR-007**: The system MUST derive each blog post's public route from its basename and MUST
  require metadata to declare that exact route, regardless of the post's source-year folder.
- **FR-008**: The system MUST reject post pairs that derive duplicate public routes before
  publication succeeds.
- **FR-009**: The system MUST retain a post's public route when its complete source pair moves
  between year-based folders without a basename change.

### Key Entities *(include if feature involves data)*

- **Blog post source**: An authored Markdown document representing one publishable post.
- **Blog metadata sidecar**: The matching authored record that supplies a post's public identity
  and display information.
- **Blog post pair**: A Markdown source and metadata sidecar sharing a basename and source folder.
- **Public route**: The stable, visitor-facing address derived from a post basename.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Publishing valid content discovers and publishes 100% of complete post pairs in all
  nested year folders.
- **SC-002**: Publishing stops before successful output for 100% of unmatched post or metadata
  sidecars.
- **SC-003**: Publishing stops before successful output for 100% of metadata records missing a
  required field, containing an invalid date, or declaring an inconsistent route.
- **SC-004**: Moving a complete post pair between year folders preserves its public route in 100%
  of cases where its basename is unchanged.
- **SC-005**: Content authors can identify the source file and failed validation rule from every
  rejection message without inspecting generated output.

## Assumptions

- Authors organize content by year for source management, but the year is not part of a post's
  visitor-facing route.
- A basename identifies a blog post across all year folders and therefore must be unique.
- Existing stable post routes must be preserved when content is reorganized.
- This feature concerns blog post discovery and validation only; rendering, navigation, and page
  authoring remain outside its scope.
