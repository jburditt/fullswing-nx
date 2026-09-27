# Feature Specification: Standalone Blog Generator

**Feature Branch**: `002-standalone-blog-generator`

**Created**: 2026-09-25

**Status**: Draft

**Input**: User description: "projects/typescript-blog is a standalone Node.js + TypeScript static-site
generator that mirrors the functional behavior of projects/fullswing-blog without depending on the
Angular CLI."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Publish Discovered Blog Content (Priority: P1)

A content author adds a complete blog post and can publish it as a navigable static page without
maintaining a hand-authored route list.

**Why this priority**: Publishing independently authored blog content is the core purpose of the
site.

**Independent Test**: Add one valid post with its required metadata, publish the site, and navigate
from the home page to its generated page.

**Acceptance Scenarios**:

1. **Given** a valid post and matching metadata, **When** the author publishes the site, **Then**
   the post appears in the generated content list and opens at its declared friendly route.
2. **Given** a post source without its matching metadata or metadata without its matching post,
   **When** the author publishes the site, **Then** publishing stops and identifies the unmatched
   source.
3. **Given** metadata with a missing required value, invalid date, or route inconsistent with its
   content name, **When** the author publishes the site, **Then** publishing stops and identifies
   the invalid field or route.

---

### User Story 2 - Browse Site Content (Priority: P2)

A visitor can use the generated home page and sitemap to find blog posts and richer pages, navigate
between them, and understand each item's title, date, author, and categories.

**Why this priority**: Static output is valuable only when visitors can discover and navigate the
published content.

**Independent Test**: Publish a site with multiple posts and pages, open the generated output in a
web server, and follow links from the home page, sitemap, and a nested content page.

**Acceptance Scenarios**:

1. **Given** published content with different dates and categories, **When** a visitor opens the
   home page, **Then** all content is presented newest first with category filters.
2. **Given** a visitor is on a nested post or page, **When** the visitor chooses Home or Sitemap,
   **Then** the selected destination loads with its assets intact.
3. **Given** a visitor selects or clears a category filter, **When** matching content exists,
   **Then** only matching entries are visible and at least one category remains active.

---

### User Story 3 - Read Rich Technical Content (Priority: P3)

A visitor can read formatted articles, copy code snippets, and view authored diagrams when an
appropriate diagram enhancer is available.

**Why this priority**: These behaviors preserve the useful reading experience of the reference
blog beyond basic text publication.

**Independent Test**: Publish an article containing formatted text, fenced code with individual
and ranged line highlights and a starting-number offset, and a diagram block; verify the rendered
article and code-copy interaction in a browser.

**Acceptance Scenarios**:

1. **Given** a post with formatted Markdown and supported code fences, **When** a visitor opens
   the post, **Then** the formatted content, syntax styling, requested line numbers, and requested
   line highlights are visible.
2. **Given** a code fence requesting highlighted positions such as `line=2,4-5` and a starting
  number such as `lineOffset=10`, **When** a visitor views the post, **Then** lines 2, 4, and 5
  relative to the first code line are highlighted, the range is inclusive, and the first displayed
  line number is 10. Changing the starting number does not change which lines are highlighted.
3. **Given** a visible code snippet, **When** a visitor activates its copy control, **Then** the
   snippet text is copied and an accessible success or failure status is announced.
4. **Given** a post with a diagram block, **When** no diagram enhancer is present, **Then** the
   diagram source remains readable rather than preventing the page from loading.

### Edge Cases

- Duplicate post basenames in different source-year folders cannot produce ambiguous published
  routes; publishing must stop and identify the conflict.
- Unsupported code languages render safely as readable code rather than failing the article.
- A direct request for a missing, malformed, or path-traversing route returns a not-found response
  without exposing files outside the published site.
- A page renderer that does not provide the required rendering contract stops publishing with an
  actionable error.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST publish a static home page, sitemap, blog pages, and rich pages using
  friendly directory-style routes.
- **FR-002**: The system MUST discover blog posts recursively from their authoring location and
  derive each blog route from its basename, independent of the source-year folder.
- **FR-003**: The system MUST require a same-basename content and metadata pair for each blog post
  and rich page, and MUST reject missing pairs, duplicate routes, and invalid metadata before
  publishing output.
- **FR-004**: The system MUST require each content item to provide a non-empty route, title,
  author, categories, and valid calendar date, and MUST verify that its route matches its content
  kind and basename.
- **FR-005**: The system MUST present blogs, pages, and combined content in descending date order,
  using title order to resolve equal dates, and MUST calculate category display names and counts
  from discovered content.
- **FR-006**: The system MUST render article text, supported code formatting directives, and rich
  page content into the shared site presentation while escaping all metadata and dynamic page
  values. Code highlight positions MUST be 1-based relative to the first code line and support
  comma-separated positions and inclusive ranges. A starting-number offset MUST set the displayed
  number of the first code line without changing highlighted positions; without an offset, numbering
  MUST start at 1.
- **FR-007**: The system MUST publish non-content public assets and generated site assets while
  excluding authoring source files from published assets.
- **FR-008**: The system MUST provide category filtering, accessible code-copy feedback, and a
  non-blocking diagram enhancement point in published pages.
- **FR-009**: The system MUST serve friendly routes and static assets without requiring an Angular
  CLI dependency or a client-side application runtime.
- **FR-010**: The system MUST preserve route-correct navigation and asset references at every
  published nesting depth.

### Key Entities *(include if feature involves data)*

- **Content item**: A publishable blog post or rich page with a route, title, author, date,
  categories, and source location.
- **Blog post**: A content item authored as a Markdown document paired with its metadata.
- **Rich page**: A content item with authored page content paired with its metadata.
- **Category summary**: A displayable category name, normalized identifier, and number of content
  items assigned to that category.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Publishing a valid content set creates a navigable page for 100% of discovered
  content items, plus the home page and sitemap.
- **SC-002**: Publishing fails before emitting a successful site when any required content pair,
  metadata field, date, route, or route uniqueness constraint is invalid.
- **SC-003**: A visitor can reach any published content page from the home page or sitemap in no
  more than two navigation selections.
- **SC-004**: Every generated internal navigation link and static asset reference resolves
  successfully when tested from the deepest published route.
- **SC-005**: For articles using supported code directives, 100% of requested line-number and
  highlighted-line annotations are visible in the published article; a starting-number offset
  changes the displayed number of the first code line without shifting highlighted positions.

## Assumptions

- The reference blog defines the expected user-facing behavior; visual design need not be pixel
  identical when equivalent navigation, content, and reading behavior is preserved.
- Content authors provide valid source files and use unique blog basenames across all source-year
  folders.
- The first release targets static hosting and ordinary modern web browsers; author editing,
  accounts, comments, search, and analytics are out of scope.
- Optional diagram enhancement may be supplied by a host environment; authored diagram source must
  remain readable when it is absent.
