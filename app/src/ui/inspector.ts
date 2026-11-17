/**
 * Parameter editor for the selected slot, plus the global parameters.
 *
 * Every control carries its label, unit, full range and default, and an inline explanation of what
 * it does — the official editor shows none of these, and its tooltips are mis-indexed so they
 * describe the wrong parameter entirely (AUDIT.md §2.11, §2.12).
 */

import { el, select, button } from './dom';
import { openModeMenu } from './mode-menu';
import { iconSvg } from './icons';
import { toggleControl, segmentedControl, sliderControl, radioGrid } from './controls';
import { classifyDomain } from '../model/control-kind';
import type { Store } from '../state/store';
import type { GlobalDef } from '../model/types';
import {
  familyOfLine, labelFor, lineLabel, model, modeByIndex, readGlobal, familyOfMode, iconForMode } from '../model/model';
import { MODE_FAMILIES, familyColor } from '../model/families';

export interface InspectorOptions {
  /** Opens the manual at a given mode's page. */
  onHelp?: (family: string, key: string) => void;
}

/** The colored family+mode tag that edits the output's mode ("EXPRESSION : Velocity"). */
export function renderModeTag(store: Store, line: number): HTMLElement {
  const family = familyOfLine(line);
  const l = store.get().config.lines[line]!;
  const mode = modeByIndex(family, l.mode);
  const fam = MODE_FAMILIES[familyOfMode(family, l.mode)];
  const famVar = familyColor(fam.id);
  // The capsule is a real <button>, not a <select>: a native select loses a *trusted* click to the
  // OS picker (the styled popover opened behind it and the OS popup's dismissal closed it — a live
  // bug invisible to synthetic-event tests). The mode's ICON stands in for the family word (Tina:
  // colour + icon say the family; the word was noise); Off keeps its grey dot so geometry is stable.
  const btn = el('button', {
    type: 'button', class: `mode-tag mode-tag-btn${famVar ? '' : ' is-off'}`,
    style: famVar ? `--fam:${famVar}` : '', 'aria-haspopup': 'listbox',
    'aria-label': `${lineLabel(line)} mode: ${mode?.display ?? 'Off'}`,
    onclick: () => openModeMenu(btn, family, l.mode, (v) => store.setLineMode(line, v)),
  },
    el('span', { class: 'mode-tag-ic', html: iconSvg(iconForMode(family, l.mode), 15) }),
    el('span', { class: 'mode-tag-name' }, mode?.display ?? 'Off'),
    el('span', { class: 'mode-tag-caret', 'aria-hidden': 'true' }, '▾'),
  );
  return btn;
}

/** The one-line mode description (with an Unverified tag when applicable), or null for OFF. */
export function renderModeDoc(store: Store, line: number): HTMLElement | null {
  const family = familyOfLine(line);
  const mode = modeByIndex(family, store.get().config.lines[line]!.mode);
  if (!mode || mode.key === 'off') return null;
  return el('p', { class: 'field-hint mode-doc' },
    mode.docSource !== 'spec' ? el('span', { class: 'tag tag-unverified', title: 'Not yet confirmed against hardware.' }, 'Unverified') : null,
    mode.doc ?? '');
}

/* ------------------------------------------------------------------ globals */

/** DESIGN board 7 — globals get the same domain-driven controls as the jack editor, not dropdowns
 *  and number boxes. Enum globals route through classifyDomain; the two ints are special-cased. */
function globalControl(store: Store, g: GlobalDef, value: number, onLiveValue: (label: string) => void): HTMLElement {
  const id = `g-${g.id}`;
  const commit = (v: number) => store.setGlobal(g.id, v);

  // "Disable default CC map" reads backwards as a switch (on = disabled). Present it as "Factory CC
  // map", on = active; the byte is unchanged (wire = active ? 0 : 1).
  if (g.id === 'disable_default_cc_map') {
    return toggleControl({
      id, ariaLabel: 'Factory CC map',
      options: [{ value: 1, label: 'off' }, { value: 0, label: 'on' }], // on ⇒ options[1].value ⇒ byte 0
      value, tint: null, onCommit: commit,
    });
  }

  if (g.kind === 'enum' && g.domain) {
    const opts = (model.domains[g.domain]?.labels ?? []).map((label, i) => ({ value: i, label: String(label) }));
    const kind = classifyDomain(g.domain).kind;
    if (kind === 'toggle') return toggleControl({ id, options: opts, value, ariaLabel: g.label, tint: null, onCommit: commit });
    if (kind === 'segmented') return segmentedControl({ id, options: opts, value, ariaLabel: g.label, tint: null, variant: 'segment', onCommit: commit });
    return select(id, opts, value, commit);
  }

  // Global CC channel: an address, not a magnitude — the same 4×4 grid as the jack channel. The value
  // IS the channel number (1–16), so build the grid on 1..16, NOT ch_menu's 0-based indices.
  if (g.id === 'global_cc_channel') {
    const opts = Array.from({ length: 16 }, (_, i) => ({ value: i + 1, label: String(i + 1) }));
    return radioGrid({ id, options: opts, value, ariaLabel: g.label, cols: 4, tint: null, onCommit: commit });
  }

  // Tempo (int14, 30–250 BPM) → a slider, not a number box.
  const opts = Array.from({ length: g.max - g.min + 1 }, (_, i) => ({ value: g.min + i, label: String(g.min + i) }));
  return sliderControl({
    id, options: opts, value, defaultValue: g.default, ariaLabel: g.label, tint: null,
    onLiveValue, onCommit: commit,
  });
}

/** One global as a 63px pfield (label + value on the head, control beneath) — the board-4 anatomy. */
function globalField(store: Store, g: GlobalDef): HTMLElement {
  const value = readGlobal(store.get().config.globals, g);
  const isFactoryCc = g.id === 'disable_default_cc_map';
  const label = isFactoryCc ? 'Factory CC map' : g.label;
  const d = g.kind === 'enum' && g.domain ? model.domains[g.domain] : undefined;

  const valueText = isFactoryCc ? (value === 0 ? 'on' : 'off')
    : d ? String(d.labels[value] ?? value)
    : `${value}${g.unit ? ` ${g.unit}` : ''}`;
  const valueEl = el('span', { class: 'pfield-value' }, valueText);

  const control = globalControl(store, g, value, (lbl) => { valueEl.textContent = g.unit ? `${lbl} ${g.unit}` : lbl; });
  control.classList.add('pfield-control');

  const rowspan2 = g.id === 'global_cc_channel'; // the 4×4 grid needs two rows
  // The presentation layer owns the inversion (label + value + THIS doc). The spec's g.doc describes
  // the un-inverted 'Disable default CC map' polarity, which reads backwards under 'Factory CC map'.
  const doc = isFactoryCc
    ? 'When on, the module’s built-in CC map applies alongside your modulation-matrix rows. Turn it off so only your own rows apply.'
    : g.doc;
  const hover = [doc, d ? `Range ${d.labels[0]} … ${d.labels[d.count - 1]}` : `Range ${g.min} … ${g.max}`]
    .filter(Boolean).join('\n');

  return el('div', { class: `field pfield${rowspan2 ? ' is-rowspan2' : ''}`, title: hover },
    el('div', { class: 'pfield-head' },
      el('span', { class: 'pfield-name' }, label),
      el('span', { class: 'spacer' }),
      g.docSource !== 'spec' ? el('span', { class: 'tag tag-unverified', title: 'Not confirmed against the manual or hardware.' }, 'unverified') : null,
      valueEl,
    ),
    control,
  );
}

export function renderGlobals(store: Store): HTMLElement {
  const fields = model.globals.map((g) => globalField(store, g));

  return el(
    'section',
    { class: 'panel' },
    el('div', { class: 'panel-head' }, el('h2', {}, 'Global parameters')),
    el(
      'div',
      { class: 'panel-body' },
      el('div', { class: 'inspector-grid' }, ...fields),
      el(
        'p',
        { class: 'field-hint' },
        'The clock source labels come from the original editor’s source, which contradicts its ' +
        'own on-screen label. Worth confirming against your module before relying on it.',
      ),
    ),
  );
}

/** Small read-only summary of a line, used by the mod matrix to show what it is targeting. */
export function describeLine(store: Store, line: number): string {
  const family = familyOfLine(line);
  const l = store.get().config.lines[line];
  if (!l) return 'unassigned';
  const mode = modeByIndex(family, l.mode);
  return mode ? `${lineLabel(line)} · ${mode.name}` : lineLabel(line);
}

export { labelFor, button };
