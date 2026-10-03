import assert from 'node:assert/strict';
import test from 'node:test';
import { createMermaidPrerenderer } from '../src/lib/mermaid.js';

test('createMermaidPrerenderer should wrap SVG, cache by source, and use unique ids', async () => {
  const calls: string[] = [];
  const prerenderer = createMermaidPrerenderer(async (source, svgId, theme) => {
    calls.push(`${svgId}:${theme}`);
    return { svg: `<svg id="${svgId}"></svg>`, title: 'A "title"', desc: null };
  });

  const first = await prerenderer.render('graph TD; A-->B');
  await prerenderer.render('graph TD; A-->B');
  await prerenderer.render('graph TD; B-->C');

  assert.equal(calls.length, 4);
  assert.equal(new Set(calls).size, 4);
  assert.match(calls[0], /^mermaid-[0-9a-f]{12}-light:default$/);
  assert.match(calls[1], /^mermaid-[0-9a-f]{12}-dark:dark$/);
  assert.match(first, /^<figure class="mermaid-diagram" role="img" aria-label="A &quot;title&quot;"><div class="mermaid-diagram__light"><svg id="mermaid-[0-9a-f]{12}-light"><\/svg><\/div><div class="mermaid-diagram__dark"><svg id="mermaid-[0-9a-f]{12}-dark"><\/svg><\/div><\/figure>$/);
});

test('createMermaidPrerenderer should fail with the offending source', async () => {
  const prerenderer = createMermaidPrerenderer(async () => { throw new Error('parse error'); });

  await assert.rejects(prerenderer.render('oops'), /Unable to prerender Mermaid diagram: parse error\noops/);
});
