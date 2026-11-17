import { describe, it, expect } from 'vitest';
// @ts-expect-error node builtins; no @types/node, resolved at runtime (see no-sourcemaps.guard)
import { readdirSync, readFileSync } from 'node:fs';
import { resolveDocSlug } from '../src/ui/manual';

// Walk the real docs/ tree (cwd is app/, so docs live at ../docs) and confirm EVERY internal .md
// link resolves to a page that exists — the check that would have caught the recipe links going
// nowhere (a sibling link recipes/index.md -> drum-triggers.md must resolve to recipes/drum-triggers).
const DOCS = '../docs';

function mdFiles(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`;
    if (e.isDirectory()) mdFiles(p, acc);
    else if (e.name.endsWith('.md')) acc.push(p);
  }
  return acc;
}

const files = mdFiles(DOCS);
const slugOf = (f: string) => f.slice(DOCS.length + 1).replace(/\.md$/, '');
const exists = new Set(files.map(slugOf));

describe('manual internal links', () => {
  it('bundles some docs (guards against an empty walk passing vacuously)', () => {
    expect(files.length).toBeGreaterThan(20);
    expect(exists.has('recipes/index')).toBe(true);
    expect(exists.has('recipes/drum-triggers')).toBe(true);
  });

  it('every internal .md link across all docs resolves to an existing page', () => {
    const broken: string[] = [];
    for (const f of files) {
      const s = slugOf(f);
      const base = s.includes('/') ? s.slice(0, s.lastIndexOf('/')) : '';
      const md: string = readFileSync(f, 'utf8');
      for (const m of md.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
        const url = m[1]!;
        if (/^https?:\/\//.test(url)) continue;                 // external
        if (url.startsWith('#') && !/\.md/.test(url)) continue;  // same-page anchor
        const slug = resolveDocSlug(url, base);
        if (!exists.has(slug)) broken.push(`${s} -> ${url} (resolved: ${slug || '∅'})`);
      }
    }
    expect(broken).toEqual([]);
  });
});

describe('resolveDocSlug', () => {
  it('resolves relative paths against the current dir, collapsing . and ..', () => {
    expect(resolveDocSlug('drum-triggers.md', 'recipes')).toBe('recipes/drum-triggers');
    expect(resolveDocSlug('../audit.md', 'recipes')).toBe('audit');
    expect(resolveDocSlug('gate.md', 'modes')).toBe('modes/gate');
    expect(resolveDocSlug('fx/microtonal.md', '')).toBe('fx/microtonal');
    expect(resolveDocSlug('editor.md#backing-up', '')).toBe('editor'); // anchor dropped, doc resolves
    expect(resolveDocSlug('../modes/trig.md', 'recipes')).toBe('modes/trig');
  });
});
