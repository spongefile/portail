/**
 * In-app manual (DESIGN.md §6.7). The docs/ markdown is bundled at BUILD TIME (Vite glob, no runtime
 * fetch — the app stays a static site). Searchable, with a sidebar; mode "?" links jump to a mode's
 * page. `TODO(verify)` / unverified markers render as the same provenance badge the inspector uses.
 */

import { el, clear } from './dom';
import { familyOfKey, FAMILY_ORDER, MODE_FAMILIES, familyColor, type FamilyId } from '../model/families';

/* Bundle every docs page as raw markdown at build time. Keyed by path like "../../docs/modes/lfo.md". */
const RAW = import.meta.glob('../../../docs/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

interface Page { slug: string; path: string; title: string; group: string; body: string; searchText: string; }

const GROUP_ORDER = ['Start', 'Guide', 'Modes', 'FX', 'Recipes', 'Reference', 'About'];

function groupFor(slug: string): string {
  if (slug === 'modes/index') return 'Guide'; // the Mode reference is a guide page, not a mode
  if (slug.startsWith('modes/')) return 'Modes';
  if (slug.startsWith('fx/')) return 'FX';
  if (slug.startsWith('recipes/')) return 'Recipes';
  if (['quick-start', 'concepts'].includes(slug)) return 'Start';
  if (['editor', 'on-module', 'troubleshooting'].includes(slug)) return 'Guide';
  if (slug.startsWith('appendix-') || ['specifications', 'unverified', 'audit'].includes(slug)) return 'Reference';
  if (slug === 'index') return 'Start';
  return 'About';
}

function firstHeading(md: string, fallback: string): string {
  const m = md.match(/^#\s+(.+)$/m);
  return m ? m[1]!.trim() : fallback;
}

const PAGES: Page[] = Object.entries(RAW)
  .map(([path, body]) => {
    const slug = path.replace(/^.*\/docs\//, '').replace(/\.md$/, '');
    return {
      slug, path, body,
      title: firstHeading(body, slug),
      group: groupFor(slug),
      searchText: (slug + ' ' + body).toLowerCase(),
    };
  })
  .sort((a, b) => a.slug.localeCompare(b.slug));

const BY_SLUG = new Map(PAGES.map((p) => [p.slug, p]));

/** A mode doc slug -> its editor family, resolved through the slug->key map below and familyOfKey.
 *  Several keys can share a slug (trig=cvtrigger/trigger, seq=seq/gate_seq); they share a family, so
 *  the first match is deterministic and correct. */
function familyOfModeSlug(slug: string): FamilyId | null {
  for (const [key, s] of Object.entries(MODE_SLUG)) if (s === slug) return familyOfKey(key);
  return null;
}

/** Mode/FX key → docs slug. Model keys differ from doc filenames; this is the bridge (§6.7). */
const MODE_SLUG: Record<string, string> = {
  note: 'modes/note', cvtrigger: 'modes/trig', trigger: 'modes/trig', cc: 'modes/cc',
  vel: 'modes/vel', aftertouch: 'modes/at', poly_after: 'modes/poly-at', pitchbend: 'modes/pb',
  clock: 'modes/clock', lfo: 'modes/lfo', env: 'modes/env', seq: 'modes/seq', gate_seq: 'modes/seq',
  'random cv': 'modes/random', random: 'modes/random', arp: 'modes/arp', cc_rec: 'modes/cc-recorder',
  gate: 'modes/gate', euclid: 'modes/euclidean',
};
const FX_SLUG: Record<string, string> = {
  'note filter': 'fx/note-filter', 'random oct': 'fx/random-oct', 'random fx': 'fx/random-note',
  chance: 'fx/chance', accumulate: 'fx/accumulate', transpose: 'fx/transpose', scale: 'fx/scale',
  microtonal: 'fx/microtonal', delay: 'fx/delay', humanize: 'fx/humanize', logic: 'fx/logic',
  'random vel': 'fx/random-vel', 'random trig': 'fx/random-trig-length', invert: 'fx/invert',
  repeats: 'fx/repeats',
};

export function docPageForMode(family: string, key: string): string | null {
  const slug = family === 'fx' ? FX_SLUG[key] : MODE_SLUG[key];
  return slug && BY_SLUG.has(slug) ? slug : null;
}

/* --------------------------------------------------------------- markdown */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// The directory of the page currently being rendered, so relative .md links resolve to the right
// slug. Set once per render (rendering is synchronous); mdToHtml recurses for blockquotes but keeps
// the same base. Without this, a sibling link like `drum-triggers.md` inside `recipes/index.md`
// resolved to slug `drum-triggers` instead of `recipes/drum-triggers`, and went nowhere.
let linkBase = '';

/** Resolve a relative .md link (with optional #anchor) against `base` into a page slug, collapsing
 *  `.`/`..` segments — e.g. ("../audit.md", "recipes") → "audit", ("gate.md", "modes") → "modes/gate". */
export function resolveDocSlug(url: string, base: string): string {
  const path = url.replace(/#.*$/, '').replace(/\.md$/, '');
  const parts = base ? base.split('/') : [];
  for (const seg of path.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

function inline(s: string): string {
  let t = escapeHtml(s);
  // TODO(verify) / unverified markers → provenance badge
  t = t.replace(/TODO\(verify\)([^\n]*)?/g,
    '<span class="tag tag-unverified" title="Unconfirmed — needs hardware confirmation.">unverified</span>$1');
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  // links [text](url) — internal .md links become in-app nav, external open normally
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_m, text: string, url: string) => {
    if (/^https?:\/\//.test(url)) return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
    const slug = resolveDocSlug(url, linkBase);
    return `<a href="#" data-doc="${slug}">${text}</a>`;
  });
  return t;
}

function mdToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let i = 0;
  const flushList = (items: string[], ordered: boolean) => {
    if (!items.length) return;
    out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
  };

  while (i < lines.length) {
    const line = lines[i]!;

    if (line.startsWith('```')) { // fenced code
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) { buf.push(lines[i]!); i++; }
      i++;
      out.push(`<pre class="doc-code"><code>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    const h = line.match(/^(#{1,6})\s+(.+)$/);
    if (h) { const lv = h[1]!.length; out.push(`<h${lv}>${inline(h[2]!)}</h${lv}>`); i++; continue; }

    if (/^\s*---\s*$/.test(line)) { out.push('<hr/>'); i++; continue; }

    if (line.startsWith('>')) {
      const buf: string[] = [];
      while (i < lines.length && lines[i]!.startsWith('>')) { buf.push(lines[i]!.replace(/^>\s?/, '')); i++; }
      out.push(`<blockquote>${mdToHtml(buf.join('\n'))}</blockquote>`);
      continue;
    }

    if (line.includes('|') && lines[i + 1] && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]!)) {
      const rows: string[][] = [];
      const parse = (r: string) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const header = parse(line);
      i += 2;
      while (i < lines.length && lines[i]!.includes('|')) { rows.push(parse(lines[i]!)); i++; }
      const th = header.map((c) => `<th>${inline(c)}</th>`).join('');
      const body = rows.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('');
      out.push(`<div class="doc-table-wrap"><table><thead><tr>${th}</tr></thead><tbody>${body}</tbody></table></div>`);
      continue;
    }

    const ul = line.match(/^\s*[-*]\s+(.+)$/);
    if (ul) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+(.+)$/.test(lines[i]!)) { items.push(lines[i]!.replace(/^\s*[-*]\s+/, '')); i++; }
      flushList(items, false);
      continue;
    }
    const ol = line.match(/^\s*\d+\.\s+(.+)$/);
    if (ol) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+(.+)$/.test(lines[i]!)) { items.push(lines[i]!.replace(/^\s*\d+\.\s+/, '')); i++; }
      flushList(items, true);
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    // paragraph — gather until blank
    const buf: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== '' && !/^(#{1,6}\s|>|```|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i]!)) {
      buf.push(lines[i]!); i++;
    }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  return out.join('\n');
}

/* --------------------------------------------------------------- view */

let container: HTMLElement | null = null;
let currentSlug = 'index';
let onBack: () => void = () => {};

export function mountManual(root: HTMLElement, opts: { onBackToEditor: () => void }): void {
  container = root;
  onBack = opts.onBackToEditor;
  render();
}

export function showManual(target?: { slug?: string; mode?: { family: string; key: string } }): void {
  if (target?.slug && BY_SLUG.has(target.slug)) currentSlug = target.slug;
  else if (target?.mode) {
    const slug = docPageForMode(target.mode.family, target.mode.key);
    if (slug) currentSlug = slug;
  }
  render();
}

function render(): void {
  if (!container) return;
  clear(container);

  const page = BY_SLUG.get(currentSlug) ?? BY_SLUG.get('index') ?? PAGES[0];
  if (!page) {
    container.appendChild(el('div', { class: 'panel-body' },
      el('p', { class: 'muted' }, 'The manual could not be bundled. Rebuild the app to include docs/.')));
    return;
  }

  const searchInput = el('input', {
    type: 'search', class: 'control', placeholder: 'Search the manual…', id: 'manual-search',
    oninput: (e: Event) => filterSidebar((e.target as HTMLInputElement).value),
  });

  const sidebar = el('nav', { class: 'manual-sidebar', 'aria-label': 'Manual contents' },
    el('div', { class: 'row' },
      el('button', { type: 'button', class: 'btn btn-sm btn-ghost', onclick: () => onBack() }, '← Editor'),
    ),
    searchInput,
    el('div', { id: 'manual-toc' }, ...tocGroups()),
  );

  linkBase = page.slug.includes('/') ? page.slug.slice(0, page.slug.lastIndexOf('/')) : '';
  const content = el('article', { class: 'manual-content', id: 'manual-content', html: mdToHtml(page.body) });
  content.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('a[data-doc]') as HTMLElement | null;
    if (a) { e.preventDefault(); showManual({ slug: a.dataset['doc']! }); content.scrollTop = 0; }
  });

  // Tina: the official editor link is the FIRST thing on the manual page — and right next to an
  // official link is exactly where the unofficial status gets restated. Position + the existing
  // info treatment carry the prominence; no new component. ("AI-generated", not "community" — the
  // provenance wording Tina corrected in docs/index.md applies here too.)
  container.appendChild(el('div', { class: 'notice notice-info manual-official' },
    el('p', {},
      el('strong', {}, 'Official editor'), ' — eowave’s own Portail editor is at ',
      el('a', { href: 'https://www.eowave.app/portail/', target: '_blank', rel: 'noopener noreferrer' }, 'eowave.app/portail'),
      '. This unofficial, AI-generated manual and editor may differ from official behaviour.',
    ),
  ));
  container.appendChild(el('div', { class: 'manual-layout' }, sidebar, content));
}

function tocLink(p: Page): HTMLElement {
  return el('a', {
    href: '#', class: `toc-link${p.slug === currentSlug ? ' is-current' : ''}`,
    'data-slug': p.slug,
    onclick: (e: Event) => { e.preventDefault(); showManual({ slug: p.slug }); },
  }, p.title);
}

/**
 * The Modes group, grouped by mode family (board 5c). Family order follows FAMILY_ORDER (so the
 * manual matches the palette's order), modes alphabetical by title within. Each family is a real
 * text label — a screen reader hears "Pitch", not a colour — with a decorative family-colour dot.
 */
function modeFamilySections(pages: Page[]): HTMLElement[] {
  const byFam = new Map<FamilyId, Page[]>();
  const unmapped: Page[] = [];
  for (const p of pages) {
    const fam = familyOfModeSlug(p.slug);
    if (!fam) { unmapped.push(p); continue; }
    (byFam.get(fam) ?? byFam.set(fam, []).get(fam)!).push(p);
  }
  const sections = FAMILY_ORDER.filter((f) => f !== 'off' && byFam.has(f)).map((f) => {
    const col = familyColor(f);
    const modes = byFam.get(f)!.slice().sort((a, b) => a.title.localeCompare(b.title));
    return el('div', { class: 'toc-fam' },
      el('div', { class: 'toc-fam-title' },
        el('span', { class: 'toc-fam-dot', 'aria-hidden': 'true', style: col ? `background: ${col}` : '' }),
        MODE_FAMILIES[f].label,
      ),
      ...modes.map(tocLink),
    );
  });
  // Defensive: never silently drop a mode page that isn't in the family map.
  if (unmapped.length) sections.push(el('div', { class: 'toc-fam' }, ...unmapped.map(tocLink)));
  return sections;
}

function tocGroups(): HTMLElement[] {
  const groups = new Map<string, Page[]>();
  for (const p of PAGES) { const g = groups.get(p.group) ?? []; g.push(p); groups.set(p.group, g); }
  const ordered = [...groups.entries()].sort((a, b) => GROUP_ORDER.indexOf(a[0]) - GROUP_ORDER.indexOf(b[0]));
  return ordered.map(([group, pages]) =>
    el('div', { class: 'toc-group', 'data-group': group },
      el('div', { class: 'toc-group-title' }, group),
      ...(group === 'Modes' ? modeFamilySections(pages) : pages.map(tocLink)),
    ),
  );
}

function filterSidebar(q: string): void {
  const query = q.trim().toLowerCase();
  const toc = document.getElementById('manual-toc');
  if (!toc) return;
  toc.querySelectorAll<HTMLElement>('.toc-link').forEach((a) => {
    const slug = a.dataset['slug']!;
    const page = BY_SLUG.get(slug);
    const hit = !query || (page ? page.searchText.includes(query) : false);
    a.style.display = hit ? '' : 'none';
  });
  toc.querySelectorAll<HTMLElement>('.toc-group').forEach((g) => {
    const anyVisible = [...g.querySelectorAll<HTMLElement>('.toc-link')].some((a) => a.style.display !== 'none');
    g.style.display = anyVisible ? '' : 'none';
  });
}
