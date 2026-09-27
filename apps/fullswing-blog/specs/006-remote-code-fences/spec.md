# Feature Specification: Remote Code Fences

**Feature Branch**: `Not specified (retrospective specification)`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "add raw markdown file URL to code block fence directives"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Publish Referenced Source Code (Priority: P1)

A blog author can reference a source file by URL in a fenced code block and publish an article that
shows the retrieved source code with the same readable presentation as an authored code sample.

**Why this priority**: Referencing maintained source files avoids copying code into articles and
keeps technical documentation closer to its source.

**Independent Test**: Add a fenced code block with a valid approved source URL, publish the site,
and verify that the resulting article contains the source file contents with the requested language
presentation and line annotations.

**Acceptance Scenarios**:

1. **Given** a fenced code block with a valid remote source URL, **When** the article is published,
   **Then** the published article displays the retrieved source text in that code block.
2. **Given** a remote source code block with a language and existing line directives, **When** the
   article is published, **Then** language styling, line numbers, offsets, highlights, and copy
   behavior apply to the retrieved source in the same way as an authored code block.
3. **Given** a remote source URL pointing to a version-specific file, **When** the article is
   published again, **Then** the displayed source corresponds to that referenced version.

---

### User Story 2 - Understand Referenced Code (Priority: P2)

A visitor can identify where a referenced code sample came from and use the displayed code without
leaving the article.

**Why this priority**: Source attribution and convenient reuse make externally maintained examples
useful to readers rather than merely decorative embeds.

**Independent Test**: Open an article containing a remote code block and verify that its source link
is available and that the rendered code can be copied.

**Acceptance Scenarios**:

1. **Given** a published remote code block, **When** a visitor views it, **Then** the block exposes
   an accessible link to its source URL.
2. **Given** a visitor uses the copy control for a remote code block, **When** the copy action is
   available, **Then** the retrieved source text is copied rather than the source URL or fence
   directive.

---

### User Story 3 - Correct Invalid References (Priority: P3)

A blog author receives a clear publication failure when a referenced source cannot safely or
reliably be included.

**Why this priority**: A broken code reference should be found while publishing instead of silently
producing incomplete documentation for visitors.

**Independent Test**: Publish articles containing unavailable, invalid, disallowed, and non-text
source references and verify that each failure identifies the affected article and reference.

**Acceptance Scenarios**:

1. **Given** a source URL that cannot be retrieved, **When** the article is published, **Then**
   publication fails with the affected URL and a reason.
2. **Given** a source URL on a disallowed host or using an unsupported protocol, **When** the article
   is published, **Then** the URL is rejected before remote content is included.
3. **Given** a retrieved source that is not valid text, **When** the article is published, **Then**
   publication fails with an actionable error rather than emitting corrupted code.

### Edge Cases

- A remote source is empty; publication preserves an empty code block without inventing content.
- A source ends with a newline; the published code does not gain an unintended extra code line.
- A source contains markup-like characters; those characters remain escaped code text.
- A source URL contains query or fragment components; source attribution remains stable and the
  retrieval behavior is unambiguous.
- A remote source changes between publications; each publication uses the content available from
  the referenced version, while version-specific references remain reproducible.
- Multiple code blocks reference the same URL in one publication; retrieval does not produce
  inconsistent contents within that publication.
- A remote source exceeds the configured size limit; publication fails with the URL and limit.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Authors MUST be able to specify a remote source URL in a fenced code block directive
  without duplicating the source file contents in the article.
- **FR-002**: The system MUST accept only approved secure remote source URLs and MUST reject
  unsupported protocols and disallowed hosts before retrieving content.
- **FR-003**: The system MUST retrieve the referenced source during publication and use its text as
  the code block content.
- **FR-004**: The system MUST preserve the code block's explicitly selected language and existing
  line-number, line-highlight, and line-offset directives when rendering retrieved source.
- **FR-005**: The system MUST escape retrieved source text as code content and MUST prevent retrieved
  text from becoming article markup or executable page content.
- **FR-006**: The system MUST expose the referenced source URL from each successfully published
  remote code block so visitors can inspect its origin.
- **FR-007**: The system MUST apply the existing code-copy behavior to retrieved source text.
- **FR-008**: The system MUST fail publication with an actionable article, URL, and reason when a
  source URL is malformed, disallowed, unavailable, returns an unsuccessful response, contains
  non-text content, or exceeds the configured size limit.
- **FR-009**: The system MUST avoid inconsistent contents when the same source URL is referenced
  more than once during one publication.
- **FR-010**: The system MUST support version-specific source references so authors can choose a
  stable source snapshot rather than relying on a moving branch.

### Key Entities *(include if feature involves data)*

- **Remote code reference**: A fenced code block directive containing a permitted source URL and
  optional code presentation directives.
- **Remote source snapshot**: The text retrieved from a remote code reference for one publication.
- **Published code block**: The visitor-facing code block produced from authored text or a remote
  source snapshot, including its language presentation, annotations, copy behavior, and attribution.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For 100% of valid approved source references in the acceptance test set, publication
  includes the exact retrieved source text in the intended code block.
- **SC-002**: For 100% of tested remote code blocks, existing language styling, line annotations,
  source attribution, and copy behavior remain available after retrieval.
- **SC-003**: 100% of tested malformed, disallowed, unavailable, non-text, and oversized references
  stop publication with an error identifying the article, URL, and failure reason.
- **SC-004**: Articles with repeated references to one source produce identical displayed contents
  for every occurrence in at least 100% of repeated-reference tests.
- **SC-005**: At least 90% of test authors can add a valid remote code reference correctly on their
  first attempt using the authoring documentation.
- **SC-006**: Version-specific references continue to display the selected source snapshot across
  repeated publications when the source repository's default branch changes.

## Assumptions

- Remote source retrieval occurs during publication so the delivered site remains usable without a
  browser-side source-fetching runtime.
- The initial approved source host is the raw file host used by the project; expanding the approved
  host list is a separate decision.
- Authors are responsible for choosing sources they are permitted to display and for selecting
  version-specific references when reproducibility matters.
- Existing authored code fences remain supported without a remote source directive.
- A configured source-size limit and publication timeout are part of the publishing environment;
  exact operational values can be selected during planning.
- This feature does not provide authentication for private repositories or a content management
  interface.
