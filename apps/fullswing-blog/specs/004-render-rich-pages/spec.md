# Feature Specification: Render Rich Pages

**Feature Branch**: `004-render-rich-pages`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "Page renderers and metadata sidecars are placed in the rich-page
authoring area. Each renderer exports `renderPage(context)` and its sidecar declares the route
`/page/<basename>`."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Publish an Authored Rich Page (Priority: P1)

A page author adds a renderer and matching metadata record and can publish a dedicated rich page
without adding it to a manual route registry.

**Why this priority**: Rich pages let authors publish content that needs more structure than a
standard blog post.

**Independent Test**: Add a valid renderer and matching metadata record, publish the site, and
open the resulting friendly page route.

**Acceptance Scenarios**:

1. **Given** a renderer and same-basename metadata record, **When** the author publishes the site,
   **Then** the page is discovered and published at the route derived from its basename.
2. **Given** a published rich page, **When** a visitor opens its route, **Then** the page displays
   its rendered body and metadata within the shared site presentation.
3. **Given** multiple valid rich pages, **When** the author publishes the site, **Then** every
   page is published exactly once and appears in content discovery views.

---

### User Story 2 - Use the Page Rendering Contract (Priority: P2)

A page author can produce dynamic page content using the page context made available during
publication.

**Why this priority**: A consistent contract makes custom pages predictable while allowing richer
content than static posts.

**Independent Test**: Publish a renderer that uses supplied page metadata and safely displays a
dynamic value in its body.

**Acceptance Scenarios**:

1. **Given** a renderer that implements the required page-rendering contract, **When** the author
   publishes the site, **Then** the renderer receives its page context and its returned content is
   included in the published page.
2. **Given** a renderer that displays a dynamic value, **When** the value contains markup-like
   characters, **Then** those characters are displayed as content and do not alter the page
   structure.
3. **Given** a renderer that does not provide the required rendering contract, **When** the author
   publishes the site, **Then** publishing stops and identifies the renderer and missing contract.

---

### User Story 3 - Correct Page Authoring Errors (Priority: P3)

A page author receives an actionable failure when the renderer and metadata records are incomplete
or inconsistent.

**Why this priority**: Clear failures prevent broken rich pages from reaching visitors.

**Independent Test**: Publish source sets with an orphan renderer, orphan metadata, malformed
metadata, and a route mismatch; verify that each failure identifies its source and reason.

**Acceptance Scenarios**:

1. **Given** a renderer without matching metadata, **When** the author publishes the site,
   **Then** publishing stops and identifies the unmatched renderer.
2. **Given** metadata without a matching renderer, **When** the author publishes the site,
   **Then** publishing stops and identifies the unmatched metadata.
3. **Given** valid renderer and metadata files that declare an inconsistent route, **When** the
   author publishes the site, **Then** publishing stops and identifies the expected route.

### Edge Cases

- Declaration-only source files are not treated as publishable renderers.
- A renderer that returns empty content still publishes a valid page shell and metadata.
- A renderer that fails while producing page content stops publication and identifies the affected
  page.
- Two page sources that would produce the same public route are rejected before a successful
  publication.
- Rich-page metadata with an impossible calendar date or empty category value is rejected.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST discover rich-page renderers and metadata records from the designated
  page authoring location without a manual route registry.
- **FR-002**: The system MUST require every publishable renderer to have a same-basename metadata
  record and every metadata record to have a same-basename renderer.
- **FR-003**: The system MUST stop publication before producing a successful site when a renderer
  or metadata record is unmatched, and MUST identify the unmatched source.
- **FR-004**: The system MUST require rich-page metadata to provide non-empty route, title, author,
  and categories values and a valid calendar date.
- **FR-005**: The system MUST derive every rich page's public route from its basename and MUST
  require metadata to declare the corresponding `/page/<basename>` route.
- **FR-006**: The system MUST make the required page context available to every valid renderer and
  MUST publish the content returned by that renderer within the shared page presentation.
- **FR-007**: The system MUST provide a safe mechanism for renderers to display dynamic text and
  MUST preserve rendered page-body markup as authored content.
- **FR-008**: The system MUST stop publication with an actionable error when a renderer does not
  implement the required rendering contract or fails while rendering.
- **FR-009**: The system MUST include discovered rich pages in combined content listings, category
  summaries, and the sitemap.
- **FR-010**: The system MUST reject duplicate rich-page public routes before publication succeeds.

### Key Entities *(include if feature involves data)*

- **Rich page renderer**: Authored page content that produces a page body from a supplied page
  context.
- **Rich page metadata**: The matching record that provides a page's public route, title, author,
  date, and categories.
- **Page context**: Information available to a renderer during publication, including its metadata
  and safe dynamic-text display capability.
- **Rich page**: A discovered renderer-metadata pair published at a friendly page route.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Publishing valid page sources creates a navigable page for 100% of complete
  renderer-metadata pairs.
- **SC-002**: Publishing stops before successful output for 100% of unmatched renderers,
  unmatched metadata records, invalid metadata records, and inconsistent routes.
- **SC-003**: Every published rich page appears in the sitemap and combined content listing with
  its title, author, date, and categories.
- **SC-004**: Dynamic text containing markup-like characters is displayed safely in 100% of tested
  rich-page renderers.
- **SC-005**: A visitor can open every published rich page directly at its declared friendly route
  with the shared site navigation and assets intact.

## Assumptions

- Rich pages supplement blog posts for content that requires custom structure; they use the same
  metadata rules and public-site presentation.
- A page basename uniquely identifies its public route.
- Page authors are responsible for supplying trusted body markup; dynamic values use the provided
  safe display capability.
- This feature does not add author accounts, a visual page editor, or a client-side application
  framework.
