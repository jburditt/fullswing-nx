# Data Model: Mermaid Diagram Rendering

## Diagram Block

A server-rendered authored diagram represented by one Mermaid fenced Markdown block.

| Field | Type | Rules |
|---|---|---|
| `source` | escaped HTML text | Preserve the authored Mermaid source; escape HTML-sensitive characters before insertion. |
| `language` | literal `mermaid` | Recognized from the fenced-code info string. |
| `element` | `HTMLPreElement` | Published as `<pre class="mermaid">...</pre>`. |
| `page` | generated route | Belongs to a blog or rich page and uses the existing route-safe layout. |

## Enhancement State

A client-side state associated with a discovered diagram block:

- `fallback`: no compatible enhancer is available; source remains readable.
- `pending`: a host enhancer has been invoked and may complete asynchronously.
- `enhanced`: the host runtime successfully transforms the block.
- `failed`: enhancement throws or rejects; source remains available and other blocks continue.

State is ephemeral browser behavior and is not persisted in content metadata.

## Relationships and Invariants

- A published page may contain zero or more Diagram Blocks.
- The shared client discovers only blocks present when the extension point is initialized.
- A host enhancer receives the discovered block collection and owns Mermaid configuration.
- Missing or failed enhancement never invalidates the page or removes the source fallback.
- Mermaid content is not copied through code-copy controls because it is a diagram block, not a
  regular highlighted code sample.
