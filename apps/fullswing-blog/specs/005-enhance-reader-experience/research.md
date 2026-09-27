# Research: Mermaid Diagram Rendering

## Decision: Keep Mermaid optional and host-provided

Mermaid will not be added to `package.json` or bundled into the static site. The generator emits
escaped `<pre class="mermaid">` source, and a host may load/configure Mermaid separately.

**Rationale:** This preserves static-site generation, avoids coupling the build to a browser
runtime, and guarantees that articles remain readable when Mermaid is unavailable.

**Alternatives considered:** Bundling Mermaid would provide a turnkey experience but would add
client payload and a mandatory runtime dependency to a feature explicitly specified as optional.

## Decision: Use the existing extension point and modern `run` API

The shared client script will discover `pre.mermaid` blocks, expose
`window.typescriptBlog.enhanceMermaid(enhancer)`, and invoke a compatible host runtime through
`window.mermaid.run({ nodes })` when it is already available. Hosts that load Mermaid later call
the manual hook after initialization.

**Rationale:** This matches the existing implementation and gives hosts control over runtime
loading, version, configuration, CSP, and initialization timing. `mermaid.run` is the current API;
`mermaid.init` is not needed.

**Alternatives considered:** Loading Mermaid from the generated page would make the generator
responsible for external scripts and versioning. Dynamically polling for Mermaid would add timing
complexity without improving the host contract.

## Decision: Treat enhancement as non-blocking and failure-isolated

Automatic and manual enhancement must tolerate a missing runtime, asynchronous completion, rejected
promises, malformed diagrams, and multiple blocks. A failed enhancement must not hide or destroy
the escaped source or prevent unrelated article behavior.

**Rationale:** The feature specification explicitly requires readable fallback content and isolation
when enhancement is unavailable or fails.

**Alternatives considered:** Letting Mermaid errors escape is simpler but violates the graceful
failure requirements. Replacing source before successful rendering would make failure recovery
unreliable.

## Decision: Preserve safe source and author-controlled accessibility

Continue escaping authored source with the existing HTML helper. Hosts should retain Mermaid's
restrictive security defaults and authors should use Mermaid `accTitle` and `accDescr` for diagrams
that convey important information.

**Rationale:** Server escaping prevents authored Markdown from becoming page HTML, while Mermaid's
accessibility directives let successful SVG output expose a title and description. Interactive click
behavior and permissive security settings are outside this feature.

**Sources:** Existing repository implementation and tests; Mermaid usage, accessibility, and security
guidance referenced during research.
