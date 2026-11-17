/**
 * The two ontology primitives (DESIGN.md §6.0-A): shape encodes what a thing IS.
 *
 *  - `outputJack()` → a CIRCLE (ring + socket), for a physical output you patch. Ring tinted by the
 *    output's mode-FAMILY colour (§6.2, editor convention — NOT the hardware LED).
 *  - `fxChip()`     → a LOZENGE/pill, for an abstract node (FX, MIDI source, jack-less thing).
 *    Always NEUTRAL grey — cable colour is reserved for outputs.
 *
 * They are separate functions on purpose: there is no `variant` flag that could render an output as
 * a pill or an FX as a circle, so the concrete/abstract boundary cannot drift.
 */

import { el } from './dom';
import { iconSvg } from './icons';

export interface OutputJackOptions {
  /** e.g. "CV 3" or "D-GATE 5". */
  name: string;
  /** Mode display name, e.g. "LFO". */
  mode: string;
  /** icon id (mode key or spec icon id). */
  icon: string;
  /** family ring colour, or null for OFF (unlit). */
  color: string | null;
  /** optional one-line parameter summary. */
  summary?: string;
  /** the output's MIDI channel ("ch 7"), shown top-right on a CLOSED card. */
  channel?: string;
  /** true → dimmed (mode is OFF). */
  off?: boolean;
  /** true → shows the "differs from module" marker. */
  changed?: boolean;
  /** true → currently selected. */
  selected?: boolean;
  /** FX icon ids (mode keys) for the chain on this output, in order — shown as small glyphs. */
  fx?: string[];
  onClick?: () => void;
  id?: string;
  /** Render as a <div> (the OPEN tab), not a <button> — an open card holds a <select> and interactive
   *  controls, which are illegal inside a <button>. Closed cards stay clickable <button>s. */
  asTab?: boolean;
  /** aria-expanded for a closed card (a disclosure trigger); the open tab carries it on its triangle. */
  expanded?: boolean;
  /** On the open tab, the mode-tag control shown in place of the static mode-name line. */
  modeControl?: HTMLElement | null;
  /** Trailing content: the open tab's control row (? + ▼), or a closed card's decorative glyph. */
  trailing?: HTMLElement | null;
}

/** A physical output, drawn as a circular jack. Closed = a clickable <button>; open (asTab) = a <div>
 *  carrying the mode control and a disclosure triangle (a <select> can't live inside a <button>). */
export function outputJack(o: OutputJackOptions): HTMLElement {
  // The circle is a clean patch socket — ring + socket only, tinted by the family colour. The mode
  // icon lives BESIDE the mode name (below), never overlaid on the jack (DESIGN §6.0-A).
  const jackVar = o.color ? `--jack: ${o.color}` : '--jack: var(--border-strong)';
  const ring = el('span', { class: 'jack-ring', 'aria-hidden': 'true' }, el('span', { class: 'jack-socket' }));

  const attrs: Record<string, string | number | boolean | EventListener | null | undefined> = {
    id: o.id,
    class:
      `output-jack${o.off ? ' is-off' : ''}${o.changed ? ' is-changed' : ''}` +
      `${o.selected ? ' is-selected' : ''}${o.asTab ? ' is-tab' : ''}`,
    'aria-current': o.selected ? 'true' : 'false',
    title: o.changed ? `${o.name} — differs from the module` : o.name,
    style: jackVar,
  };
  if (!o.asTab) { attrs['type'] = 'button'; attrs['onclick'] = o.onClick; attrs['aria-expanded'] = o.expanded ? 'true' : 'false'; }

  return el(
    o.asTab ? 'div' : 'button',
    attrs,
    ring,
    el('span', { class: 'jack-body' },
      el('span', { class: 'jack-name' }, o.name,
        o.fx && o.fx.length
          ? el('span', { class: 'jack-fx', title: `${o.fx.length} FX on this output` },
              ...o.fx.map((k) => el('span', { class: 'jack-fx-icon', html: iconSvg(k, 13) })))
          : null),
      // Open tab: the interactive mode control replaces the static mode-name line.
      o.modeControl ?? el('span', { class: 'jack-mode' },
        o.off ? null : el('span', { class: 'jmode-icon', html: iconSvg(o.icon, 15) }),
        o.mode),
      o.summary && !o.asTab ? el('span', { class: 'jack-summary' }, o.summary) : null,
    ),
    o.channel ? el('span', { class: 'jack-channel', 'aria-hidden': 'true' }, o.channel) : null,
    o.trailing ?? null,
    o.changed && !o.asTab ? el('span', { class: 'jack-changed', 'aria-hidden': 'true' }) : null,
    o.changed ? el('span', { class: 'visually-hidden' }, ' — differs from the module') : null,
  );
}

export interface FxChipOptions {
  /** primary label, e.g. "SCALE" or "MIDI". */
  label: string;
  /** FX slot number (1-8), shown as a small dim badge before the label. */
  slot?: number;
  /** icon id; omit for a plain node like the MIDI source. */
  icon?: string;
  /** small secondary line, e.g. "minor". */
  sub?: string;
  /** true → currently selected/active. */
  selected?: boolean;
  onClick?: () => void;
  id?: string;
  /** true → render as a static span rather than a button (e.g. the MIDI source node). */
  static?: boolean;
  title?: string;
}

/** An abstract node, drawn as a neutral lozenge. Never tinted by a family colour. */
export function fxChip(o: FxChipOptions): HTMLElement {
  const children = [
    o.icon ? el('span', { class: 'chip-icon', html: iconSvg(o.icon, 14) }) : null,
    o.slot ? el('span', { class: 'chip-slot' }, String(o.slot)) : null,
    el('span', { class: 'chip-label' }, o.label),
    o.sub ? el('span', { class: 'chip-sub' }, o.sub) : null,
  ];
  const cls = `fx-chip${o.selected ? ' is-selected' : ''}`;
  if (o.static) {
    return el('span', { class: `${cls} is-static`, id: o.id, title: o.title }, ...children);
  }
  return el('button', { type: 'button', class: cls, id: o.id, title: o.title, onclick: o.onClick }, ...children);
}
