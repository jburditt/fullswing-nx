# Data Model: Remote Code Fences

## Remote Code Reference

A Markdown fenced-code directive that identifies an external text source.

| Field | Constraint |
| --- | --- |
| source URL | Required, absolute HTTPS URL, host must be approved |
| language | Optional existing code language; preserved when supplied |
| line directives | Optional existing `line`, `lineOffset`, and `lineNumbers` directives |
| attribution | Derived from the source URL and exposed on successful output |

## Remote Source Snapshot

The text retrieved for one source URL during one publication.

| Field | Constraint |
| --- | --- |
| request URL | The validated source URL used as the cache key |
| text | Required valid text content within the configured size limit |
| retrieval result | Successful response only; unsuccessful responses are publication errors |
| publication scope | In-memory and discarded after the publication completes |

## Published Code Block

The visitor-facing result of an authored or remote code fence.

| Field | Constraint |
| --- | --- |
| code text | Remote snapshot text or authored fence text |
| language presentation | Uses the selected language and existing highlighting fallback |
| line presentation | Uses existing numbering, offsets, and highlight ranges |
| source attribution | Present for remote blocks and safely escaped |
| copy content | Contains code text only, not the URL or directive metadata |

## Relationships

- One remote code reference resolves to one remote source snapshot per publication.
- Multiple references with the same validated URL share one snapshot within a publication.
- Each successfully resolved reference produces one published code block.
