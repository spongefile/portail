/**
 * The rack overview: all 16 outputs laid out like the panel — CV in the left column, D-GATE in the
 * right (DESIGN.md §2.3). FX slots are NOT outputs and do not appear here; they live in the FX
 * signal-flow (§6.5). Each output is an <OutputJack> circle tinted by its mode-family colour (§6.2).
 *
 * Selecting an output turns its card into a TAB and opens a full-width editor BAND on the row below
 * it (DESIGN pass #3, board 3C). One row-major grid so CV/GATE rows stay aligned; the tab bridges
 * into the band with padding + min-height (never align-items), and the band's top border is notched
 * open exactly under the tab. All geometry derives from the grid's gap variables so a gap change
 * keeps tab and band aligned.
 */

import { el, button, confirmDialog } from './dom';
import { outputJack, type OutputJackOptions } from './primitives';
import { disclosureTriangleSvg } from './icons';
import type { Store } from '../state/store';
import type { PortailConfig } from '../model/types';
import { LINE_BYTES, LINE_COUNT } from '../model/types';
import { familyOfLine, labelFor, lineLabel, modeByIndex, modeColor, iconForMode } from '../model/model';
import { chainForOutput } from '../model/fx';
import { renderModeTag, renderModeDoc, type InspectorOptions } from './inspector';
import { renderChainStrip } from './signalflow';

/** One line of "what is this output doing", from its most identifying parameters. */
export function slotSummary(config: PortailConfig, line: number): string {
  const family = familyOfLine(line);
  const l = config.lines[line]!;
  const mode = modeByIndex(family, l.mode);
  if (!mode || mode.key === 'off') return '';

  // Channel is shown as its own top-right badge on the card (jackOptions.channel), so it's NOT
  // repeated here — the summary carries only the mode-specific detail (Tina: no redundant values).
  const parts: string[] = [];
  const extra = mode.params.find((p) =>
    ['note', 'cc_number', 'division', 'rate', 'waveform', 'scale', 'envelope_shape', 'steps', 'base_note'].includes(p.id),
  );
  if (extra) parts.push(`${labelFor(extra, l.bytes[extra.index] ?? 0)}`);
  return parts.slice(0, 2).join(' · ');
}

/** D-GATE cards sometimes link to a CV voice; surface that as "← CV n". */
function gateLink(config: PortailConfig, line: number): string | undefined {
  const l = config.lines[line]!;
  const mode = modeByIndex('gate', l.mode);
  const src = mode?.params.find((p) => p.id === 'trigger_source');
  if (!src) return undefined;
  const v = l.bytes[src.index] ?? 0;
  // dest_note_menu: 0 = note, 1..8 = CV 1..8
  if (v >= 1 && v <= 8) return `← CV ${v}`;
  return undefined;
}

/** The shared OutputJack options for a line (everything but the click behaviour). */
/** The output's channel as "ch N" for the closed-card badge, or null if the mode has no channel. */
function channelLabel(l: PortailConfig['lines'][number], mode: ReturnType<typeof modeByIndex>): string | null {
  if (!mode || mode.key === 'off') return null;
  const p = mode.params.find((pp) => pp.id === 'channel');
  if (!p) return null;
  return `MIDI ch ${labelFor(p, l.bytes[p.index] ?? 0).replace(/^ch /, '')}`;
}

function jackOptions(store: Store, line: number, changed: Set<number>): Omit<OutputJackOptions, 'onClick' | 'selected'> {
  const state = store.get();
  const family = familyOfLine(line);
  const l = state.config.lines[line]!;
  const mode = modeByIndex(family, l.mode);
  const isOff = !mode || mode.key === 'off';
  const fxIcons = chainForOutput(state.config, line).map((e) => e.key);
  const summary = family === 'gate' ? (gateLink(state.config, line) ?? slotSummary(state.config, line))
                                    : slotSummary(state.config, line);
  return {
    id: `jack-${line}`,
    name: lineLabel(line),
    mode: mode ? mode.display : `? (${l.mode})`,
    icon: iconForMode(family, l.mode),
    color: modeColor(family, l.mode),
    summary,
    channel: channelLabel(l, mode) ?? undefined,
    off: isOff,
    changed: changed.has(line),
    fx: fxIcons,
  };
}

/** On OPEN: centre the tab (so its editor isn't below the fold) AND move focus to the ▼ — the
 *  <button>→<div> swap otherwise drops keyboard focus to <body>. Runs in rAF, after the re-render. */
function afterOpen(line: number): void {
  if (typeof requestAnimationFrame !== 'function') return;
  requestAnimationFrame(() => {
    // Focus BEFORE scroll: the ▼ carries aria-expanded, so landing on it announces the state change —
    // and a scrollIntoView that throws (some environments) must not swallow the focus move.
    document.getElementById(`disclose-${line}`)?.focus();
    const el = document.getElementById(`jack-${line}`);
    if (el && typeof el.scrollIntoView === 'function') {
      const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      try { el.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); } catch { /* no-op in non-layout DOMs */ }
    }
  });
}

/** On COLLAPSE: the ▼ button is replaced by the card button, so move focus back to the card. */
function afterClose(line: number): void {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => document.getElementById(`jack-${line}`)?.focus());
}

/** An unselected output card. */
function jackCard(store: Store, line: number, changed: Set<number>): HTMLElement {
  // A closed card is a disclosure trigger: the WHOLE card is clickable (the frequent direction stays
  // easy), aria-expanded=false, with a decorative ◀ advertising that it opens.
  return outputJack({
    ...jackOptions(store, line, changed),
    selected: false,
    expanded: false,
    trailing: el('span', { class: 'jack-disclosure-glyph', 'aria-hidden': 'true', html: disclosureTriangleSvg(false) }),
    onClick: () => { store.setSelectedLine(line); afterOpen(line); },
  });
}

/** The selected output's card, open. The mode control and its ? live ON the card (where the tap
 *  landed) so the edit target never jumps across to the band's left edge; a ▼ disclosure collapses. */
function tabCard(store: Store, opts: InspectorOptions, line: number, changed: Set<number>): HTMLElement {
  const family = familyOfLine(line);
  const mode = modeByIndex(family, store.get().config.lines[line]!.mode);
  const help = mode && mode.key !== 'off'
    ? button('?', () => opts.onHelp?.(family, mode.key), {
        class: 'jack-help', title: `What does ${mode.name} do? Open the manual.`,
        ariaLabel: `What does ${mode.name} do? Open the manual.`,
      })
    : null;
  // A real disclosure: aria-expanded + aria-controls the band's region (unlike the closed card's
  // decorative glyph). Open points down (▼); the closed card's is the same drawn path rotated 90°.
  const disclosure = el('button', {
    type: 'button', id: `disclose-${line}`, class: 'jack-disclosure',
    'aria-expanded': 'true', 'aria-controls': `band-${line}`,
    'aria-label': `Collapse ${lineLabel(line)}`,
    onclick: () => { store.setSelectedLine(null); afterClose(line); },
  }, el('span', { class: 'jack-disclosure-glyph', 'aria-hidden': 'true', html: disclosureTriangleSvg(true) }));
  return outputJack({
    ...jackOptions(store, line, changed),
    selected: true,
    asTab: true,
    modeControl: renderModeTag(store, line),
    trailing: el('span', { class: 'jack-controls' }, help, disclosure),
  });
}

/** The full-width editor band that opens under the selected tab. The mode tag + ? now live on the
 *  card, so the band opens straight at the doc line (no band-head). */
function bandFor(store: Store, line: number, changed: Set<number>): HTMLElement {
  const family = familyOfLine(line);
  const color = modeColor(family, store.get().config.lines[line]!.mode);
  const isGate = line >= 8; // right column → the notch and radius mirror
  return el('div', {
    class: `rack-band ${isGate ? 'is-gate-tab' : 'is-cv-tab'}${changed.has(line) ? ' is-changed' : ''}`,
    id: `band-${line}`,
    style: color ? `--jack: ${color}` : '--jack: var(--border-strong)',
    role: 'region', 'aria-label': `${lineLabel(line)} settings`,
  },
    // Erases the band's top border directly under the tab so the two read as one shape.
    el('div', { class: 'rack-band-notch', 'aria-hidden': 'true' }),
    renderModeDoc(store, line),
    renderChainStrip(store, line),
  );
}

export function renderRack(store: Store, opts: InspectorOptions = {}): HTMLElement {
  const diff = store.diffAgainstDevice();
  const changed = new Set(diff?.lines.map((l) => l.line) ?? []);
  const state = store.get();
  const sel = state.selectedLine;

  const inUse = state.config.lines.slice(0, 16).filter((l, i) => {
    const m = modeByIndex(familyOfLine(i), l.mode);
    return m && m.key !== 'off';
  }).length;

  // Row-major DOM order breaks the old per-column role="group", so the column headers carry the
  // grouping via aria-owns (which re-parents in the a11y tree regardless of visual order).
  const owns = (base: number) => Array.from({ length: 8 }, (_, i) => `jack-${base + i}`).join(' ');
  const cells: HTMLElement[] = [
    el('div', { class: 'rack-head-cell', role: 'group', 'aria-label': 'CV outputs', 'aria-owns': owns(0) }, 'CV · 16-bit'),
    el('div', { class: 'rack-head-cell', role: 'group', 'aria-label': 'D-GATE outputs', 'aria-owns': owns(8) }, 'D-GATE · 12-bit'),
  ];
  // In one column (≤720px) the band must be the OPEN tab's immediate sibling, so the tab→band bridge
  // (negative margin + min-height) connects to the band and not to the paired card — otherwise that
  // paired card gets pulled up and overlapped. In two columns the band sits on the row below the pair
  // (grid-column 1/-1), so it comes after BOTH cards. Re-render on the breakpoint (see main.ts).
  const oneColumn = typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches;
  for (let i = 0; i < 8; i++) {
    const cv = i, gate = 8 + i;
    const cvCard = sel === cv ? tabCard(store, opts, cv, changed) : jackCard(store, cv, changed);
    const gateCard = sel === gate ? tabCard(store, opts, gate, changed) : jackCard(store, gate, changed);
    if (oneColumn) {
      cells.push(cvCard);
      if (sel === cv) cells.push(bandFor(store, cv, changed));
      cells.push(gateCard);
      if (sel === gate) cells.push(bandFor(store, gate, changed));
    } else {
      cells.push(cvCard);
      cells.push(gateCard);
      if (sel === cv || sel === gate) cells.push(bandFor(store, sel!, changed));
    }
  }

  return el(
    'section',
    { class: 'panel', id: 'rack-panel' },
    el('div', { class: 'panel-head' },
      el('h2', {}, 'Module overview'),
      el('span', { class: 'small muted' }, `${inUse} of 16 outputs in use`),
      el('span', { class: 'spacer' }),
      button('Clear all', () => void clearAll(store), {
        class: 'btn-sm btn-ghost',
        title: 'Set every output and FX slot to OFF. Editor only — nothing is sent to the module.',
      }),
    ),
    el('div', { class: 'panel-body' },
      el('div', { class: 'rack-grid' }, ...cells),
    ),
  );
}


async function clearAll(store: Store): Promise<void> {
  const ok = await confirmDialog({
    title: 'Set all outputs and FX to OFF?',
    body: 'This clears the configuration in the editor. Nothing is sent to the module, and you can undo it with Ctrl/Cmd+Z.',
    confirmLabel: 'Clear all',
    danger: true,
  });
  if (!ok) return;
  store.commit('clear all', (c) => {
    for (let i = 0; i < LINE_COUNT; i++) c.lines[i] = { mode: 0, bytes: new Array<number>(LINE_BYTES).fill(0) };
  });
  store.toast('info', 'All slots cleared', 'Undo with Ctrl/Cmd+Z. Nothing was sent to the module.');
}
