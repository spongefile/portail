/**
 * Parameter-grid renderer for one line (output or FX), shared by the inspector and the inline
 * FX editor in the signal-flow strip. Extracted so an FX's parameters can be edited in place under
 * its chip (DESIGN §6.5) without the inspector and signal-flow modules importing each other.
 *
 * Every control carries its label, unit, full range, default, and inline explanation — the official
 * editor shows none of these and mis-indexes its tooltips (AUDIT.md §2.11, §2.12).
 */

import { el, select } from './dom';
import { openPopover } from './mode-menu';
import type { Store } from '../state/store';
import type { ParamDef } from '../model/types';
import { familyOfLine, labelFor, model, modeByIndex, modeColor } from '../model/model';
import { classifyDomain } from '../model/control-kind';
import { envCanvas } from './env-canvas';
import { tuningLibrary } from '../state/tuning-library';
import { euclidRing } from './euclid-ring';
import { rangeStrip } from './range-strip';
import { riseFall } from './rise-fall';
import { sliderControl, detentedLandmarks, radioGrid, segmentedControl, toggleControl, notePopover, gatedSlider, waveChipContent, dirChipContent, swingChipContent, divisionGrid, type SpanOption } from './controls';

/** The range shown under a control: first and last legal value, as labels not raw bytes. */
export function rangeLabel(p: ParamDef): string {
  const d = model.domains[p.domain];
  if (!d) return `${p.min}–${p.max}`;
  const lo = String(d.labels[p.min] ?? p.min);
  const hi = String(d.labels[Math.min(p.max, p.wireMax)] ?? p.max);
  return lo === hi ? lo : `${lo} … ${hi}`;
}

/** The {value,label} option list for a parameter, clamped to what a 7-bit byte can carry. */
export function optionList(p: ParamDef): SpanOption[] {
  const d = model.domains[p.domain];
  const usable = Math.min(p.max, p.wireMax);
  return d
    ? d.labels.slice(p.min, usable + 1).map((label, i) => ({ value: p.min + i, label: String(label) }))
    : Array.from({ length: usable - p.min + 1 }, (_, i) => ({ value: p.min + i, label: String(p.min + i) }));
}

export function paramControl(store: Store, line: number, p: ParamDef, value: number): HTMLElement {
  return select(`p-${line}-${p.index}`, optionList(p), value, (v) => store.setLineByte(line, p.index, v));
}

/**
 * The grid of parameter fields for `line`'s current mode, or a short note when the mode has none.
 * Returns null only when the line has no resolvable mode.
 */
/** If a value label names another output ("CV 3", "GATE 7"), return that jack's family colour. */
function referencedJackColor(store: Store, valueLabel: string): string | null {
  const m = /^(CV|GATE)\s?([1-8])$/i.exec(valueLabel.trim());
  if (!m) return null;
  const isCv = m[1]!.toUpperCase() === 'CV';
  const refLine = (Number(m[2]) - 1) + (isCv ? 0 : 8);
  return modeColor(isCv ? 'cv' : 'gate', store.get().config.lines[refLine]?.mode ?? 0);
}

export function renderParamGrid(store: Store, line: number): HTMLElement {
  const family = familyOfLine(line);
  const l = store.get().config.lines[line]!;
  const mode = modeByIndex(family, l.mode);

  if (!mode || mode.params.length === 0) {
    return el('p', { class: 'muted small' }, 'This mode has no parameters.');
  }

  const isFx = family === 'fx';
  // Output params take the output's family colour (matches the jack); FX params stay blue (CSS).
  const famColor = isFx ? null : modeColor(family, l.mode);
  // Board 8 stage 3: envelope modes hide the FIELDS of stages the current shape doesn't have
  // (ar has no decay/sustain; ad and loop fall to zero, no sustain/release). Hidden is NOT deleted:
  // the bytes stay untouched and switching shapes back reveals the old values — a drawing can only
  // show the stages that exist, and the dropdowns always behaved non-destructively.
  const shapeParam = mode.params.find((p) => p.domain === 'env_type_menu');
  let params = mode.params;
  // The FX Target field is GONE from the chain editor (Tina): the target is implied by which
  // output's chain you opened, and changing it silently moved the FX to another chain — the
  // classic "my effect just vanished". Re-homing an FX = insert it on the other output. The
  // byte and store.retargetFx stay; only the UI writer is removed. (logic's Operand — a second
  // fx_dest reference that genuinely selects an input — keeps its field: it is not id 'target'.)
  if (isFx) params = params.filter((x) => x.id !== 'target');
  if (shapeParam && !isFx) {
    const shape = ['ar', 'ad', 'adsr', 'loop'][l.bytes[shapeParam.index] ?? shapeParam.default];
    const hidden = shape === 'ar' ? ['decay', 'sustain'] : shape === 'ad' || shape === 'loop' ? ['sustain', 'release'] : [];
    params = mode.params.filter((p) => !hidden.includes(p.id));
  }
  // Mode-level canvases: the drawing and ITS value fields are ONE layout block — canvas left,
  // fields stacked right in stage order — so the group can't scatter around its own graphic under
  // auto-flow (Attack right of the canvas, Decay below-left…: the values read as unrelated
  // leftovers). Fields keep their exact anatomy; only placement changes. Non-canvas params of the
  // mode flow on below the block as normal.
  let group: { canvas: HTMLElement; ids: string[] } | null = null;
  if (!isFx) {
    const has = (id: string) => params.some((p) => p.id === id);
    if (params.some((p) => p.domain === 'env_type_menu')) {
      const c = envCanvas(store, line);
      // Stage order A,D,S,R; the hidden-stage rule follows the stack (ar drops decay/sustain
      // from `params` above, so they vanish from the right place).
      if (c) group = { canvas: c, ids: ['attack', 'decay', 'sustain', 'release'].filter(has) };
    } else if (has('steps') && has('fills') && has('rotate')) {
      const c = euclidRing(store, line);
      if (c) group = { canvas: c, ids: ['steps', 'fills', 'rotate'] };
    } else if (has('note_low') && has('note_high')) {
      const c = rangeStrip(store, line);
      if (c) group = { canvas: c, ids: ['note_low', 'note_high'] };
    } else if (has('rise') && has('fall')) {
      const c = riseFall(store, line);
      if (c) group = { canvas: c, ids: ['rise', 'fall'] }; // Retrigger is not a canvas param: normal flow
    }
  }
  const fieldOf = new Map(params.map((p) => [p.id, paramField(store, line, p, famColor)]));
  const out: HTMLElement[] = [];
  for (const p of params) {
    if (group && group.ids.includes(p.id)) {
      if (p.id === group.ids[0]) {
        out.push(el('div', { class: 'canvas-block' },
          group.canvas,
          el('div', { class: 'canvas-block-fields' }, ...group.ids.map((id) => fieldOf.get(id)!)),
        ));
      }
      continue; // canvas params render inside the block, nowhere else
    }
    out.push(fieldOf.get(p.id)!);
  }
  return el('div', { class: 'inspector-grid' }, ...out);

}

/**
 * DESIGN board 4 — one field anatomy, ~63px, whatever control sits in it:
 *   label row: label + unit  ·······  [unverified] CURRENT VALUE (family-tinted, right-aligned)
 *   control:   30px beneath
 * The old range line and prose hint are gone from the layout — the control shows the range
 * spatially, and the hint returns as an out-of-flow overlay on hover/focus (never growing the box).
 */
function paramField(store: Store, line: number, p: ParamDef, famColor: string | null): HTMLElement {
  const value = store.get().config.lines[line]!.bytes[p.index] ?? 0;
  const d = model.domains[p.domain];
  const clamped = p.wireMax < p.max;
  const id = `p-${line}-${p.index}`;

  const valueText = labelFor(p, value);
  const defaultLabel = String(d?.labels[p.default] ?? p.default);
  // Value tint: if this param's value REFERENCES another output ("CV 3", FX Target), use THAT jack's
  // colour; otherwise the current output's family colour.
  const refColor = referencedJackColor(store, valueText);
  const tint = refColor ?? famColor;

  const valueEl = el('span', { class: 'pfield-value' }, valueText);
  if (tint) valueEl.style.color = tint;

  // The control comes from the DOMAIN (board 6), not the parameter. tables_menu/_1_8_menu keep the
  // select; everything else has a purpose-built control.
  const choice = classifyDomain(p.domain);
  const commit = (v: number) => store.setLineByte(line, p.index, v);
  // The header value duplicates the control for anything that shows its own selection (a highlighted
  // chip/cell/grid, a menu button reading "ch 7"). Keep it ONLY for the slider family, where the
  // thumb is a position, not a readable value — those live-update valueEl via onLiveValue (Tina).
  const showHeadValue = choice.kind === 'slider' || choice.kind === 'detented' || choice.kind === 'gated-slider';
  // Controls whose activation opens a popover: on touch the tap that opens the menu also fires the
  // field hint, which then covers the menu. Suppress the hover/focus hint route for these on coarse
  // pointers (the label-tap route still works). See .opens-popover in styles.css.
  const opensPopover = choice.kind === 'channel-grid' || choice.kind === 'keyboard';
  let control: HTMLElement;
  let reset: HTMLElement | null = null;
  let segRows2 = false;
  if (choice.kind === 'channel-grid') {
    // A compact button showing the current channel; the 4×4 grid opens as a popover (Tina). A grid
    // is right for picking an address, but inline it costs two rows on a control most patches set once.
    const opts = optionList(p);
    const curLabel = () => opts.find((o) => o.value === (store.get().config.lines[line]!.bytes[p.index] ?? 0))?.label ?? '';
    const btn = el('button', {
      type: 'button', id, class: 'field-menu-btn', 'aria-haspopup': 'listbox',
      onclick: () => {
        const grid = radioGrid({
          id: `${id}-grid`, options: opts, value: store.get().config.lines[line]!.bytes[p.index] ?? 0,
          ariaLabel: p.label, cols: 4, tint,
          format: (lbl) => lbl.replace(/^ch\s*/i, ''),
          onCommit: (v) => { commit(v); h.close(); },
        });
        const h = openPopover(btn, grid, { ariaLabel: p.label });
        grid.querySelector<HTMLButtonElement>('.radio-cell.is-on')?.focus();
      },
    },
      el('span', { class: 'field-menu-val' }, curLabel()),
      el('span', { class: 'mode-tag-caret', 'aria-hidden': 'true' }, '▾'),
    );
    if (tint) (btn.firstElementChild as HTMLElement).style.color = tint;
    control = btn;
  } else if (choice.kind === 'wave-chips') {
    // Board 8: picture chips — shape drawn, word kept underneath. Art and wrap come from the
    // domain: waves 4-across (7 → 4+3), direction 2×2, swing 3-across (6 → 3+3). radioGrid
    // supplies the radio semantics and the touch floor.
    const art = p.domain === 'seq_dir_menu' ? dirChipContent
      : p.domain === 'swing_menu' ? swingChipContent : waveChipContent;
    const cols = p.domain === 'seq_dir_menu' ? 2 : p.domain === 'swing_menu' ? 3 : 4;
    control = radioGrid({
      id, options: optionList(p), value, ariaLabel: p.label, cols, tint,
      format: (lbl) => art(lbl),
      onCommit: commit,
    });
    control.classList.add('is-wave');
  } else if (choice.kind === 'division-grid') {
    // Board 8: base × feel grid — same division, triplet instead, is one cell down.
    control = divisionGrid({ id, options: optionList(p), value, ariaLabel: p.label, tint, onCommit: commit });
  } else if (choice.kind === 'table-grid') {
    // The 8 microtonal tables, 4×2, each cell naming what the app last SENT there — the same grid,
    // cells and epistemics as the Tuning tab's picker ("never 'empty'": the app only knows what it
    // wrote; the module can't report its tables back).
    const lib = tuningLibrary;
    const full = (i: number) => { const tid = lib.assignments[i]; const t = tid ? lib.byId(tid) : null; return `table ${i + 1} · ${t ? t.name : 'not sent from here'}`; };
    control = radioGrid({
      id, options: Array.from({ length: 8 }, (_, i) => ({ value: i, label: full(i) })),
      value, ariaLabel: p.label, cols: 4, tint,
      format: (_label, v) => {
        const tid = lib.assignments[v]; const t = tid ? lib.byId(tid) : null;
        return el('span', { class: 'tuning-cell', title: full(v) },
          el('span', { class: 'tuning-cell-n' }, String(v + 1)),
          t ? el('span', { class: 'tuning-cell-name' }, t.name) : null);
      },
      onCommit: commit,
    });
    control.classList.add('tuning-slot-grid');
  } else if (choice.kind === 'segmented') {
    const segOpts = optionList(p);
    // Wrap to two rows when the labels won't fit one column at this segment count — clipped labels
    // are worse than a dropdown (a per-domain measurement, not a per-parameter map).
    const maxLen = segOpts.reduce((m, o) => Math.max(m, o.label.length), 0);
    const segRows: 1 | 2 = segOpts.length * (maxLen * 6.5 + 14) > 240 ? 2 : 1;
    control = segmentedControl({ id, options: segOpts, value, ariaLabel: p.label, tint, variant: 'segment', rows: segRows, onCommit: commit });
    if (segRows === 2) segRows2 = true;
  } else if (choice.kind === 'voltage-chips') {
    control = segmentedControl({ id, options: optionList(p), value, ariaLabel: p.label, tint, variant: 'chip', onCommit: commit });
    control.classList.add('is-voltage');
  } else if (choice.kind === 'jack-chips') {
    control = segmentedControl({
      id, options: optionList(p), value, ariaLabel: p.label, tint, variant: 'chip',
      chipColor: (op) => referencedJackColor(store, op.label),
      onCommit: commit,
    });
    control.classList.add('is-jack');
  } else if (choice.kind === 'toggle') {
    control = toggleControl({ id, options: optionList(p), value, ariaLabel: p.label, tint, onCommit: commit });
  } else if (choice.kind === 'keyboard') {
    control = notePopover({ id, options: optionList(p), value, ariaLabel: p.label, tint, onCommit: commit });
  } else if (choice.kind === 'gated-slider') {
    control = gatedSlider({
      id, options: optionList(p), value, defaultValue: p.default, ariaLabel: p.label, headLabel: 'Latch', tint,
      onLiveValue: (lbl) => { valueEl.textContent = lbl; if (tint) valueEl.style.color = tint; },
      onCommit: commit,
    });
  } else if (choice.kind === 'slider' || choice.kind === 'detented') {
    const options = optionList(p);
    control = sliderControl({
      id, options, value, defaultValue: p.default, ariaLabel: p.label, tint,
      landmarks: choice.kind === 'detented' ? detentedLandmarks(options) : undefined,
      onLiveValue: (lbl) => { valueEl.textContent = lbl; if (tint) valueEl.style.color = tint; },
      onCommit: (v) => store.setLineByte(line, p.index, v),
    });
    if (value !== p.default) {
      reset = el('button', {
        type: 'button', class: 'pfield-reset',
        'aria-label': `Reset ${p.label} to default, ${defaultLabel}`,
        title: `Reset to default (${defaultLabel})`,
        onclick: () => store.setLineByte(line, p.index, p.default),
      }, '↺');
    }
  } else {
    control = paramControl(store, line, p, value);
    if (tint) control.style.color = tint;
  }
  control.classList.add('pfield-control');

  // Hover carries what left the layout: the prose hint, the full range, and the clamp caveat.
  const hover = [
    p.doc,
    `Range ${rangeLabel(p)} · default ${defaultLabel}`,
    clamped
      ? `This list has ${d?.count ?? '?'} entries but a SysEx byte only carries 0–127, so values ` +
        `above ${p.wireMax} aren't offered.`
      : null,
  ].filter(Boolean).join('\n');

  const showUnit = !!p.unit && !p.label.toLowerCase().includes(p.unit.toLowerCase());
  const hintId = `${id}-hint`;
  const hintEl = hover
    ? el('div', { class: 'pfield-hint', role: 'tooltip', id: hintId }, hover)
    : null;

  // The hint must be described from the CONTROL (the label span is tabindex=-1, never focused). The
  // overlay stays in the a11y tree (hidden by opacity only), so this announces on focus.
  if (hintEl) {
    control.setAttribute('aria-describedby', hintId);
    control.querySelector('input, select, .note-trigger')?.setAttribute('aria-describedby', hintId);
  }

  // Flip the overlay above its field when there isn't room below inside the band, so it never
  // overhangs the band edge (general collision handling, not a last-row special case).
  const positionHint = () => {
    if (!hintEl) return;
    const fr = fieldEl.getBoundingClientRect();
    const need = hintEl.offsetHeight || 50;
    const container = fieldEl.closest('.rack-band, .panel-body');
    // Clamp to the band AND the viewport — whichever is nearer is the edge the overlay must not cross.
    const containerBottom = container ? container.getBoundingClientRect().bottom : Infinity;
    const limit = Math.min(containerBottom, window.innerHeight);
    fieldEl.classList.toggle('hint-above', fr.bottom + 3 + need > limit);
  };
  // Measure now (covers tests/no-scroll) AND after the browser settles focus scroll-into-view.
  const revealHint = () => { positionHint(); if (typeof requestAnimationFrame === 'function') requestAnimationFrame(positionHint); };

  // The label is the hint's THIRD reveal route (tap), because Safari — a first-class EDITING target
  // via offline authoring, and always WebKit on iOS — doesn't reliably focus non-input elements on
  // tap, so :focus-within can't cover touch there. tabindex=-1: tappable, but not a second tab stop.
  const nameEl = el('span', {
    class: 'pfield-name',
    ...(hintEl ? { tabindex: '-1', 'aria-describedby': hintId } : {}),
    ...(hintEl ? { onclick: () => { fieldEl.classList.toggle('hint-shown'); revealHint(); } } : {}),
  }, p.label, showUnit ? el('span', { class: 'unit' }, p.unit) : null);
  if (famColor) nameEl.style.color = famColor;
  // A tap ON the shown overlay dismisses it (it has pointer-events only when shown, so it absorbs its
  // own dismissal instead of passing the tap through to the field below — which would jump a slider).
  if (hintEl) hintEl.addEventListener('click', () => fieldEl.classList.remove('hint-shown'));

  const fieldEl = el('div', {
    class: `field pfield${clamped ? ' is-clamped' : ''}${choice.span === 2 ? ' is-span2' : ''}${opensPopover ? ' opens-popover' : ''}${(choice.kind === 'gated-slider' || choice.kind === 'wave-chips' || choice.kind === 'division-grid' || choice.kind === 'table-grid' || segRows2) ? ' is-rowspan2' : ''}`,
    // Escape dismisses the overlay by adding hint-suppressed (opacity:0 beats :focus-within by source
    // order), WITHOUT blurring — blurring dropped focus to <body> and lost the keyboard user's place.
    // onfocusin clears the class when the field is re-entered, so re-showing still works.
    onkeydown: (e: Event) => {
      if ((e as KeyboardEvent).key === 'Escape' && hintEl) { fieldEl.classList.remove('hint-shown'); fieldEl.classList.add('hint-suppressed'); }
    },
    onpointerenter: () => { fieldEl.classList.remove('hint-suppressed'); revealHint(); },
    onfocusin: () => { fieldEl.classList.remove('hint-suppressed'); revealHint(); },
  },
    el('div', { class: 'pfield-head' },
      nameEl,
      el('span', { class: 'spacer' }),
      p.docSource !== 'spec'
        ? el('span', { class: 'tag tag-unverified', title: 'Derived by reading the official editor’s source. Not confirmed against the manual or hardware.' }, 'unverified')
        : null,
      showHeadValue ? valueEl : null,
    ),
    reset ? el('div', { class: 'pfield-controlrow' }, control, reset) : control,
    hintEl,
  );
  return fieldEl;
}

export { labelFor };
