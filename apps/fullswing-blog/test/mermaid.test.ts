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

  assert.equal(calls.length, 2);
  assert.equal(new Set(calls).size, 2);
  assert.match(calls[0], /^mermaid-[0-9a-f]{12}:default$/);
  assert.match(first, /^<figure class="mermaid-diagram" role="img" aria-label="A &quot;title&quot;"><svg id="mermaid-[0-9a-f]{12}"><\/svg><\/figure>$/);
});

test('createMermaidPrerenderer should render with the requested theme', async () => {
  const themes: string[] = [];
  const prerenderer = createMermaidPrerenderer(async (_source, svgId, theme) => {
    themes.push(theme);
    return { svg: `<svg id="${svgId}"></svg>`, title: null, desc: null };
  }, undefined, 'dark');

  await prerenderer.render('graph TD; A-->B');

  assert.deepEqual(themes, ['dark']);
});

test('createMermaidPrerenderer should fail with the offending source', async () => {
  const prerenderer = createMermaidPrerenderer(async () => { throw new Error('parse error'); });

  await assert.rejects(prerenderer.render('oops'), /Unable to prerender Mermaid diagram: parse error\noops/);
});
