# Feature Specification: Reading Theme, Accordions, and Optimized Delivery

**Feature Branch**: `Not specified (retrospective specification)`

**Created**: 2026-10-04

**Status**: Draft

**Input**: User description: "markdown accordion with collapse/expand; hover line on accordion; page load
optimizations (minify, compress) that are configurable; dark/light theme toggle next to the LinkedIn
icon; a single Mermaid variant"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Choose a Light or Dark Reading Theme (Priority: P1)

A visitor can switch the site between a light theme and a dark theme with a control in the header, and
the choice is remembered on later pages and visits.

**Why this priority**: Reading comfort in different lighting conditions is the main visitor-facing
benefit of this feature, and every other presentation change builds on the theme being switchable.

**Independent Test**: Open any page, activate the theme control, then navigate to other pages and
reload; verify the chosen theme applies everywhere without a visible flash of the other theme.

**Acceptance Scenarios**:

1. **Given** a first-time visitor, **When** any page loads, **Then** the light theme is shown and the
   theme control is displayed immediately after the LinkedIn icon.
2. **Given** the light theme, **When** the visitor activates the control, **Then** the page switches to
   a black-background theme with light, high-contrast text, and the control's icon and accessible name
   indicate that activating it returns to the light theme.
3. **Given** a visitor who chose a theme, **When** they open another page or reload, **Then** the same
   theme is applied before the page first paints.
4. **Given** a stored theme value that is not a supported theme, **When** a page loads, **Then** the
   light theme is used.
5. **Given** a visitor using only the keyboard, **When** the control receives focus, **Then** it shows a
   visible focus indicator and can be activated with Enter or Space.

---

### User Story 2 - Expand and Collapse Sections (Priority: P2)

A blog author can include collapsible question-and-answer style sections in a Markdown article, and a
visitor can expand and collapse each one.

**Why this priority**: Collapsible sections let authors keep long supporting detail out of the way
without needing a client-side framework.

**Independent Test**: Publish an article containing several collapsible sections and verify each can be
toggled independently, one can start expanded, and none requires JavaScript.

**Acceptance Scenarios**:

1. **Given** an article using the documented collapsible-section markup, **When** a visitor views it,
   **Then** each section shows its title with a plus indicator on the right and hides its body.
2. **Given** a collapsed section, **When** the visitor activates its title, **Then** the body is shown
   and the indicator changes to a minus.
3. **Given** a section marked as open by the author, **When** the page loads, **Then** it starts
   expanded.
4. **Given** the visitor hovers over or keyboard-focuses a section title, **When** the title is active,
   **Then** a thin vertical line in the theme accent colour appears to its left, and it is hidden again
   when the hover or focus ends.
5. **Given** either theme, **When** sections are shown, **Then** no horizontal separator lines are drawn
   between sections and all text meets readable contrast.

---

### User Story 3 - Faster Page Loads in Production (Priority: P2)

A visitor on the deployed site receives smaller pages, and the site owner can turn this optimization on
for production publishing while leaving it off for local work.

**Why this priority**: Smaller responses improve load time on real networks, while keeping local builds
readable and fast to iterate on.

**Independent Test**: Build the site with and without the optimization setting; verify that only the
enabled build contains minified output and pre-compressed files, and that the pages still render
identically.

**Acceptance Scenarios**:

1. **Given** the optimization setting is not enabled, **When** the site is built, **Then** the output is
   unminified and no pre-compressed files are written.
2. **Given** the optimization setting is enabled, **When** the site is built, **Then** generated HTML and
   the site's own CSS and JavaScript are minified, and Brotli and gzip copies are written for
   compressible files of meaningful size.
3. **Given** minified HTML, **When** a page is rendered, **Then** preformatted code and inline text
   spacing are unchanged.
4. **Given** the production publishing workflow, **When** it builds the site, **Then** the optimization
   setting is enabled.
5. **Given** the preview server and a client that accepts Brotli or gzip, **When** a page or asset that
   has a pre-compressed copy is requested, **Then** the compressed copy is sent with the matching
   content encoding.
6. **Given** the build cache, **When** the optimization setting changes, **Then** the build is rerun
   rather than reusing output produced with the other setting.

---

### User Story 4 - One Diagram Rendering per Theme Choice (Priority: P3)

Each Mermaid diagram is published as a single rendering instead of separate light and dark copies, so
article pages stay small.

**Why this priority**: Shipping two renderings of every diagram roughly doubled diagram payload for a
dark variant nothing displayed until a theme toggle existed.

**Independent Test**: Publish an article with diagrams and verify each contains exactly one SVG with a
unique identifier and no light/dark wrapper elements.

**Acceptance Scenarios**:

1. **Given** an article with a diagram, **When** it is published, **Then** the diagram is a single
   figure containing one SVG rendered in the build's configured Mermaid theme (default: the light
   theme).
2. **Given** the same diagram source appears more than once, **When** it is published, **Then** it is
   rendered once and reused.
3. **Given** the dark site theme, **When** a diagram is shown, **Then** it remains legible (displayed on
   a light panel).

### Edge Cases

- Browser storage is unavailable; the theme still switches for the current page and falls back to light
  on the next load.
- A page contains no collapsible sections; no accordion-related markup or behavior is added.
- A very small text file is below the compression threshold; no compressed copy is written.
- Third-party files copied from `public/` (not the site's own assets) are not minified.
- A client does not accept Brotli or gzip; the uncompressed file is served.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a header control after the LinkedIn icon that switches between
  light and dark themes, exposing its pressed state and a label describing the next action.
- **FR-002**: The system MUST default to the light theme and MUST ignore unsupported stored theme values.
- **FR-003**: The system MUST persist the chosen theme across pages and visits and MUST apply it before
  first paint.
- **FR-004**: The dark theme MUST use a black page background with light text and MUST maintain at least
  WCAG AA contrast for body text, muted text, links, and accent text.
- **FR-005**: The system MUST support author-written collapsible sections using native
  details/summary markup with a right-aligned plus/minus indicator and no horizontal separators.
- **FR-006**: The system MUST show a vertical accent-colour line to the left of a collapsible section
  title on hover and keyboard focus.
- **FR-007**: Collapsible sections MUST work without client-side JavaScript.
- **FR-008**: The build MUST apply minification and pre-compression only when the `BLOG_OPTIMIZE`
  environment variable is `1`.
- **FR-009**: When optimization is enabled, the build MUST minify generated HTML and the site's own CSS
  and JavaScript, and MUST preserve whitespace inside preformatted code and between inline elements.
- **FR-010**: When optimization is enabled, the build MUST write `.br` and `.gz` copies of compressible
  files (HTML, CSS, JavaScript, SVG, text, XML) of at least 256 bytes.
- **FR-011**: The preview server MUST serve a pre-compressed copy when the client accepts its encoding,
  and MUST send `Vary: Accept-Encoding`, `Cache-Control: no-cache` for HTML, and a one-hour
  `Cache-Control` for other assets, except in live-reload mode.
- **FR-012**: The production publishing workflow MUST enable `BLOG_OPTIMIZE`, and the build cache MUST
  treat `BLOG_OPTIMIZE` as an input.
- **FR-013**: The system MUST render each Mermaid diagram once as a single SVG in the configured Mermaid
  theme (`default` unless otherwise specified), cached by diagram source, with SVG ids unique per
  diagram and no light/dark wrapper elements.
- **FR-014**: Diagrams MUST remain legible under the dark site theme.

### Key Entities *(include if feature involves data)*

- **Theme preference**: The visitor's saved choice of `light` or `dark`, stored in the browser.
- **Collapsible section**: Author-written details/summary markup with the `accordion-item` class.
- **Optimization setting**: The `BLOG_OPTIMIZE` build environment variable.
- **Pre-compressed asset**: A `.br` or `.gz` file stored beside its source file in the published output.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In both themes, body text contrast against the page card is at least 4.5:1 (measured:
  17.2:1 body, 10.2:1 muted, 9.1:1 links and accents in dark).
- **SC-002**: The chosen theme persists across 100% of tested navigations and reloads with no visible
  flash of the other theme.
- **SC-003**: With optimization enabled, transfer size for the tested pages drops by at least 60%
  (measured: home 16,437 to 2,590 bytes; demo-features 109,601 to 7,269 bytes; docker-cheatsheet 5,935
  to 2,135 bytes), recorded in `specs/performance/blog-renderer-optimized.csv` against the baseline
  `blog-renderer.csv`.
- **SC-004**: A build without the optimization setting produces zero `.br`/`.gz` files.
- **SC-005**: A published diagram contains exactly one SVG (no duplicated light/dark renderings).

## Assumptions

- Dark mode is opt-in through the header control; operating-system theme preference is not read.
- Mermaid diagrams are rendered in the light theme and shown on a light panel under the dark site
  theme. A future change may render the dark variant per build or restore both variants if the toggle
  must switch diagrams without a rebuild; the prior two-variant behavior was saved as a patch outside
  the repository.
- Compression copies are produced for servers that can use them; hosting that already compresses
  responses (such as Azure Static Web Apps) benefits mainly from minification.
- The performance figures come from a local server and indicate relative change only.
- The performance measurements were taken before the single-variant Mermaid change, so the
  demo-features figures include both diagram variants; unoptimized, that page is now about 73 KB
  instead of 109 KB.
