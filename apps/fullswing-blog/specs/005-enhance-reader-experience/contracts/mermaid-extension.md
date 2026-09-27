# Mermaid Host Extension Contract

## Server Markup

For each Mermaid fenced block, the generator MUST emit:

```html
<pre class="mermaid">escaped diagram source</pre>
```

The source MUST remain readable when no host runtime is present. The generator MUST escape
HTML-sensitive authored content before inserting it into the page.

## Automatic Runtime

The shared client script MAY invoke a host-provided runtime with:

```js
window.mermaid.run({ nodes: mermaidBlocks })
```

`mermaidBlocks` is the collection of `pre.mermaid` elements discovered on the current page. The
host owns loading, versioning, configuration, security policy, and accessibility configuration.
The automatic invocation is optional and must not be required for page reading.

## Manual Runtime

The shared client script exposes:

```js
window.typescriptBlog.enhanceMermaid(enhancer)
```

`enhancer` is a function receiving the discovered Mermaid elements. A host that loads Mermaid after
the shared client script calls this function after Mermaid initialization. The enhancer MAY return a
promise. The implementation MUST contain thrown or rejected enhancement failures so they do not
break unrelated page behavior.

## Failure and Accessibility Contract

- Missing runtime is a no-op with readable source preserved.
- A failed block remains readable; failure in one block must not prevent other content from working.
- Successful rendering should preserve Mermaid accessibility metadata such as `accTitle` and
  `accDescr` when authors provide it.
- Hosts MUST NOT rely on permissive Mermaid security settings or interactive diagram callbacks as a
  requirement of this contract.
