# Feature Specification: Author Attribution

**Feature Branch**: Not specified (retrospective specification)

**Created**: 2026-09-25

**Status**: Implemented

**Input**: Add the selected author avatar, name, and publication date layout to blog and page templates, then show a more compact, aligned attribution on the home and sitemap content listings.

## User Scenarios & Testing

### User Story 1 - Identify an article author (Priority: P1)

As a reader, I want to see who wrote a blog post or page and when it was published near its title, so I can understand its source and recency before reading.

**Why this priority**: Authorship and publication date are important context for every content detail page.

**Independent Test**: Open one generated blog post and one generated page and inspect the title area and the beginning of the content.

**Acceptance Scenarios**:

1. **Given** a blog post with author and date metadata, **When** a reader opens it, **Then** a small profile image, author name, and readable publication date appear directly below the title and before the body.
2. **Given** a page with author and date metadata, **When** a reader opens it, **Then** the same attribution treatment appears below its title.
3. **Given** the attribution is displayed, **When** assistive technology reads the page, **Then** the image has an author-identifying alternative and the publication date is available as a date.

### User Story 2 - Scan authorship in content listings (Priority: P1)

As a reader browsing the home page or sitemap, I want each content title and its compact author attribution aligned across the row, so I can scan titles and authors quickly.

**Why this priority**: The home page and sitemap are the primary ways to discover and compare content.

**Independent Test**: Open the home page and sitemap at desktop and narrow phone widths and inspect multiple content rows.

**Acceptance Scenarios**:

1. **Given** a home-page or sitemap listing at a wide viewport, **When** a reader scans a row, **Then** the title is left-aligned and the small avatar, author name, and date are right-aligned on the same line.
2. **Given** a listing at a narrow phone width, **When** title and attribution cannot fit comfortably on one line, **Then** attribution moves below the title without overlap, clipping, or loss of information.
3. **Given** a reader opens an item from either listing, **When** the destination loads, **Then** the link remains usable and the attribution image is available.

## Edge Cases

- Long titles and author names must not overlap the attribution or be clipped at narrow widths.
- Blog, page, home, and sitemap routes have different nesting depths; the avatar must load on each.
- If author metadata is absent in a layout context, no author portrait is shown.
- The date must remain readable when the byline wraps at narrow widths.

## Requirements

### Functional Requirements

- **FR-001**: Content detail pages MUST show the author's profile image, author name, and publication date directly below the title when attribution metadata is available.
- **FR-002**: Blog posts and rich pages MUST use the same detail-page attribution treatment.
- **FR-003**: The detail-page byline MUST use the selected compact, rounded-square profile image, omit a top divider, and retain a bottom divider with visible space below it.
- **FR-004**: Home-page and sitemap content listings MUST show a compact profile image, author name, and publication date for each item.
- **FR-005**: At wide viewports, each listing MUST align its title to the left and its attribution to the right on the same row.
- **FR-006**: At narrow viewports, listing attribution MUST reflow as needed to prevent overlap, clipping, or unreadable text.
- **FR-007**: The profile image MUST have alternative text that identifies the author, and the publication date MUST be exposed accessibly.
- **FR-008**: The image MUST load correctly for content at every supported route depth.

### Key Entities

- **Content item**: A blog post or rich page with a title, author, and publication date.
- **Author attribution**: The profile image, author name, and publication date associated with a content item.
- **Content listing**: A home-page or sitemap row linking to a content item and summarizing its attribution.

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of generated blog post and rich-page detail routes with author/date metadata show the attribution below the title.
- **SC-002**: Both the home page and sitemap show author attribution for every listed content item, with no missing profile images.
- **SC-003**: At a 1440px viewport, listing titles and attribution remain on one row with title left and attribution right.
- **SC-004**: At a 390px viewport, long titles and attribution remain readable and do not overlap or clip.

## Assumptions

- The same site-owner profile image represents the author across the current blog and page content.
- The existing readable publication-date format is retained.
- At narrow phone widths, preserving legibility takes precedence over keeping title and attribution on one line.
