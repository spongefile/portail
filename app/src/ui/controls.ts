/**
 * Position-carries-value controls (DESIGN pass #5). Tina reads colour and spatial position as
 * primary channels and finds long numeric dropdowns the hardest part of the UI, so wherever a value
 * is an ordinal magnitude we show it as a slider whose thumb position IS the value.
 *
 * spanSlider: a dual-handle range over a discrete option list (min…max), used by the modulation
 * matrix for the Min/Max pair — they're the two ends of one range, not two numbers to compare. The
 * fill between the thumbs takes the target's family colour.
 */

import { el } from './dom';

/**
 * Every interactive tap-target selector this control factory renders. Each MUST be floored at 44px
 * under @media (pointer: coarse) — enforced by test/touch-target.guard.test.ts, so a NEW control
 * can't ship below the touch floor: add its control here and the guard fails until it's floored.
 * (Piano keys are intentionally omitted — a keyboard is inherently dense, like a real one.)
 */
export const CONTROL_TOUCH_TARGETS = [
  '.span-thumb',     // spanSlider
  '.pslider-input',  // sliderControl / gatedSlider
  '.radio-cell',     // radioGrid
  '.seg-item',       // segmentedControl / gatedSlider
  '.toggle-switch',  // toggleControl
  '.note-trigger',   // notePopover
  '.jack-help',      // rack open-tab help button
  '.jack-disclosure',
  '.notice-close',  // dismissible notices (sim notice) — outside the control factory, still a tap target// rack open-tab collapse triangle
] as const;

export interface SpanOption { value: number; label: string; }

export interface SpanSliderOpts {
  id: string;
  options: SpanOption[];       // ordered; index in this array is the slider position
  min: number;                 // current low VALUE (option.value)
  max: number;                 // current high VALUE
  onChange: (min: number, max: number) => void;
  fill?: string | null;        // CSS colour for the selected span (family colour); default --accent
}

/** Clamp a moved pair so low never passes high, without swapping thumb identity. */
export function clampSpan(lo: number, hi: number, moved: 'lo' | 'hi'): [number, number] {
  if (lo <= hi) return [lo, hi];
  return moved === 'lo' ? [hi, hi] : [lo, lo];
}

export function spanSlider(o: SpanSliderOpts): HTMLElement {
  const n = o.options.length;
  const maxIdx = Math.max(0, n - 1);
  // Map value -> position index (values may not be 0..n-1 contiguous, though usually are).
  const idxOf = (value: number) => Math.max(0, o.options.findIndex((op) => op.value === value));
  let loIdx = idxOf(o.min);
  let hiIdx = idxOf(o.max);
  if (loIdx > hiIdx) [loIdx, hiIdx] = [hiIdx, loIdx];

  const fillColor = o.fill || 'var(--accent)';
  const wrap = el('div', { class: 'span-slider', style: `--fill: ${fillColor}` });

  const track = el('div', { class: 'span-track' });
  const fill = el('div', { class: 'span-fill' });
  track.appendChild(fill);

  const mk = (which: 'lo' | 'hi', idx: number) =>
    el('input', {
      type: 'range', class: `span-thumb span-${which}`, min: '0', max: String(maxIdx), step: '1',
      value: String(idx), id: `${o.id}-${which}`,
      'aria-label': which === 'lo' ? 'Minimum' : 'Maximum',
    }) as HTMLInputElement;

  const loEl = mk('lo', loIdx);
  const hiEl = mk('hi', hiIdx);

  const loLabel = el('span', { class: 'span-val span-val-lo' }, o.options[loIdx]?.label ?? '');
  const hiLabel = el('span', { class: 'span-val span-val-hi' }, o.options[hiIdx]?.label ?? '');

  const paint = () => {
    const loPct = maxIdx ? (loIdx / maxIdx) * 100 : 0;
    const hiPct = maxIdx ? (hiIdx / maxIdx) * 100 : 100;
    fill.style.left = `${loPct}%`;
    fill.style.right = `${100 - hiPct}%`;
    loLabel.textContent = o.options[loIdx]?.label ?? '';
    hiLabel.textContent = o.options[hiIdx]?.label ?? '';
    // At min==max, show one centred value instead of the same number twice at both ends.
    const same = loIdx === hiIdx;
    wrap.classList.toggle('is-eq', same);
    hiLabel.style.display = same ? 'none' : '';
  };

  const onInput = (moved: 'lo' | 'hi') => {
    const rawLo = Number(loEl.value);
    const rawHi = Number(hiEl.value);
    const [a, b] = clampSpan(rawLo, rawHi, moved);
    loIdx = a; hiIdx = b;
    loEl.value = String(a); hiEl.value = String(b);
    paint();
    o.onChange(o.options[a]?.value ?? 0, o.options[b]?.value ?? 0);
  };
  loEl.addEventListener('input', () => onInput('lo'));
  hiEl.addEventListener('input', () => onInput('hi'));

  paint();
  wrap.append(
    el('div', { class: 'span-rail' }, track, loEl, hiEl),
    el('div', { class: 'span-vals' }, loLabel, hiLabel),
  );
  return wrap;
}

export interface SliderOpts {
  id: string;
  options: SpanOption[];        // ordered; index is the slider position
  value: number;               // current option VALUE
  defaultValue: number;        // option VALUE of the default (drawn as a notch)
  ariaLabel: string;
  tint?: string | null;        // family colour for the fill/thumb
  landmarks?: number[];        // option indices to label under the track; default = the two ends
  onLiveValue: (label: string) => void; // update the label-row value live during a drag
  onCommit: (value: number) => void;     // commit to the store on release (not every input tick)
}

/**
 * Single-handle ordinal slider (DESIGN board 6). Commits on `change` (release), not on every
 * `input`, so a drag doesn't trigger a mid-drag re-render that would drop the pointer. The visible
 * value and aria-valuetext come from the SAME label so they can't drift.
 */
export function sliderControl(o: SliderOpts): HTMLElement {
  const n = o.options.length;
  const maxIdx = Math.max(0, n - 1);
  const idxOf = (v: number) => { const i = o.options.findIndex((op) => op.value === v); return i < 0 ? 0 : i; };
  let idx = idxOf(o.value);

  const wrap = el('div', { class: 'pslider', style: o.tint ? `--fill: ${o.tint}` : '' });
  const input = el('input', {
    type: 'range', id: o.id, class: 'pslider-input',
    min: '0', max: String(maxIdx), step: '1', value: String(idx),
    'aria-label': o.ariaLabel,
  }) as HTMLInputElement;
  input.setAttribute('aria-valuetext', o.options[idx]?.label ?? '');

  const track = el('div', { class: 'pslider-track' }, input);
  // Default notch — "here's where you started". Hidden when the value IS the default (nothing to go
  // back to, and it would otherwise poke out from under the thumb and read as a glitch). Keyboard
  // path to restore is the separate reset button paramField adds.
  if (o.value !== o.defaultValue) {
    const dpct = maxIdx ? (idxOf(o.defaultValue) / maxIdx) * 100 : 0;
    track.appendChild(el('div', { class: 'pslider-notch', 'aria-hidden': 'true', style: `left: ${dpct}%` }));
  }

  const marks = o.landmarks ?? (n > 1 ? [0, maxIdx] : [0]);
  const marksRow = el('div', { class: 'pslider-marks' },
    ...marks.map((mi) => {
      const pct = maxIdx ? (mi / maxIdx) * 100 : 0;
      return el('span', { class: 'pslider-mark', 'data-idx': String(mi), style: `left: ${pct}%` }, o.options[mi]?.label ?? '');
    }),
  );

  // A landmark under the thumb is redundant (the value is spelled out on the label row) — hide it.
  const suppressUnderThumb = () => {
    marksRow.querySelectorAll<HTMLElement>('.pslider-mark').forEach((m) => {
      m.style.visibility = Number(m.dataset['idx']) === idx ? 'hidden' : 'visible';
    });
  };

  input.addEventListener('input', () => {
    idx = Number(input.value);
    const label = o.options[idx]?.label ?? '';
    input.setAttribute('aria-valuetext', label);
    o.onLiveValue(label);
    suppressUnderThumb();
  });
  input.addEventListener('change', () => o.onCommit(o.options[idx]?.value ?? 0));

  suppressUnderThumb();
  wrap.append(track, marksRow);
  return wrap;
}

/** Landmark indices for a detented (musical-ratio) slider: the two extremes plus a 1/1 unity stop
 *  if present. Taken from the domain's own labels, so dotted-vs-plain ("1/16.") survives. */
export function detentedLandmarks(options: SpanOption[]): number[] {
  const n = options.length;
  const idxs = new Set<number>([0, n - 1]);
  const unity = options.findIndex((o) => o.label.trim() === '1/1');
  if (unity >= 0) idxs.add(unity);
  return [...idxs].sort((a, b) => a - b);
}

export interface RadioGridOpts {
  id: string;
  options: SpanOption[];       // ordered
  value: number;               // current option VALUE
  ariaLabel: string;
  cols: number;                // grid columns (4 for channels)
  tint?: string | null;
  format?: (label: string, value: number) => string | Node; // shorten/restructure the cell (e.g. "ch 3" → "3", or stacked content)
  onCommit: (value: number) => void;   // commit + refocus the chosen cell
}

/**
 * A 2-D radio grid (DESIGN board 6) — used for MIDI channel: a channel is an ADDRESS, not a
 * magnitude, so it must be hit directly, never dragged on a slider. role=radiogroup with roving
 * tabindex and 2-D arrow navigation (Left/Right within a row, Up/Down across rows, Home/End to the
 * ends). Arrow moves focus AND selection, as radiogroups do; the value is announced via aria-checked.
 */
export function radioGrid(o: RadioGridOpts): HTMLElement {
  const n = o.options.length;
  const idxOf = (v: number) => { const i = o.options.findIndex((op) => op.value === v); return i < 0 ? 0 : i; };
  const curIdx = idxOf(o.value);
  const cellId = (i: number) => `${o.id}-cell-${o.options[i]!.value}`;

  const group = el('div', {
    class: 'radio-grid', role: 'radiogroup', 'aria-label': o.ariaLabel,
    style: `--fill: ${o.tint || 'var(--accent)'}; --cols: ${o.cols}`,
  });

  const select = (i: number, focus: boolean) => {
    if (focus) {
      // Commit re-renders the grid; refocus the chosen cell by its stable id afterwards.
      if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(() => document.getElementById(cellId(i))?.focus());
      }
    }
    o.onCommit(o.options[i]!.value);
  };

  const move = (from: number, key: string): number => {
    const cols = o.cols;
    switch (key) {
      case 'ArrowRight': return Math.min(n - 1, from + 1);
      case 'ArrowLeft':  return Math.max(0, from - 1);
      case 'ArrowDown':  return Math.min(n - 1, from + cols);
      case 'ArrowUp':    return Math.max(0, from - cols);
      case 'Home':       return 0;
      case 'End':        return n - 1;
      default:           return from;
    }
  };

  o.options.forEach((op, i) => {
    const checked = i === curIdx;
    const cell = el('button', {
      type: 'button', id: cellId(i), class: `radio-cell${checked ? ' is-on' : ''}`,
      role: 'radio', 'aria-checked': checked ? 'true' : 'false',
      'aria-label': op.label, tabindex: checked ? '0' : '-1',
      onclick: () => select(i, false),
      onkeydown: (e: Event) => {
        const ke = e as KeyboardEvent;
        const to = move(i, ke.key);
        if (to !== i) { ke.preventDefault(); select(to, true); }
        else if (ke.key === ' ' || ke.key === 'Enter') { ke.preventDefault(); select(i, false); }
      },
    }, o.format ? o.format(op.label, op.value) : op.label);
    if (checked && o.tint) cell.style.color = o.tint;
    group.appendChild(cell);
  });

  return group;
}

export interface SegmentedOpts {
  id: string;
  options: SpanOption[];
  value: number;
  ariaLabel: string;
  tint?: string | null;
  variant?: 'segment' | 'chip';           // joined segments vs separate chips
  rows?: 1 | 2;                            // 2 = wrap to two rows when labels won't fit one
  chipColor?: (opt: SpanOption) => string | null; // per-option colour (jack chips)
  onCommit: (value: number) => void;
}

/**
 * A 1-D radio group (DESIGN board 6): short nominal / small-ordinal domains (segmented), voltage
 * spans and jack targets (chips). role=radiogroup, roving tabindex, Left/Right/Home/End; arrow moves
 * focus and selection. `variant:'chip'` renders separate chips; `chipColor` tints each (jack chips).
 */
export function segmentedControl(o: SegmentedOpts): HTMLElement {
  const n = o.options.length;
  const idxOf = (v: number) => { const i = o.options.findIndex((op) => op.value === v); return i < 0 ? 0 : i; };
  const curIdx = idxOf(o.value);
  const cellId = (i: number) => `${o.id}-seg-${o.options[i]!.value}`;

  const group = el('div', {
    class: `segmented is-${o.variant ?? 'segment'}${o.rows === 2 ? ' is-wrap' : ''}`,
    role: 'radiogroup', 'aria-label': o.ariaLabel,
    style: `--fill: ${o.tint || 'var(--accent)'}`,
  });

  const select = (i: number, focus: boolean) => {
    if (focus && typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => document.getElementById(cellId(i))?.focus());
    }
    o.onCommit(o.options[i]!.value);
  };

  o.options.forEach((op, i) => {
    const checked = i === curIdx;
    const col = o.chipColor ? o.chipColor(op) : null;
    const cell = el('button', {
      type: 'button', id: cellId(i), class: `seg-item${checked ? ' is-on' : ''}`,
      role: 'radio', 'aria-checked': checked ? 'true' : 'false', 'aria-label': op.label,
      tabindex: checked ? '0' : '-1',
      style: col ? `--chip: ${col}` : '',
      onclick: () => select(i, false),
      onkeydown: (e: Event) => {
        const ke = e as KeyboardEvent;
        let to = i;
        if (ke.key === 'ArrowRight' || ke.key === 'ArrowDown') to = Math.min(n - 1, i + 1);
        else if (ke.key === 'ArrowLeft' || ke.key === 'ArrowUp') to = Math.max(0, i - 1);
        else if (ke.key === 'Home') to = 0;
        else if (ke.key === 'End') to = n - 1;
        if (to !== i) { ke.preventDefault(); select(to, true); }
        else if (ke.key === ' ' || ke.key === 'Enter') { ke.preventDefault(); select(i, false); }
      },
    }, op.label);
    group.appendChild(cell);
  });
  return group;
}

export interface ToggleOpts {
  id: string; options: SpanOption[]; value: number; ariaLabel: string; tint?: string | null;
  onCommit: (value: number) => void;
}

/** A two-state switch (DESIGN board 6). role=switch; Space/Enter/click flip between the two values. */
export function toggleControl(o: ToggleOpts): HTMLElement {
  const on = o.value === o.options[1]?.value;
  const flip = () => o.onCommit((on ? o.options[0]! : o.options[1]!).value);
  const sw = el('button', {
    type: 'button', id: o.id, class: `toggle-switch${on ? ' is-on' : ''}`,
    role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': o.ariaLabel,
    style: o.tint ? `--fill: ${o.tint}` : '',
    onclick: flip,
    onkeydown: (e: Event) => { const k = (e as KeyboardEvent).key; if (k === ' ' || k === 'Enter') { e.preventDefault(); flip(); } },
  },
    // Both option labels flank the track at all times (active one emphasised), so the switch says
    // what each side DOES — no guessing what a tap will change it to.
    el('span', { class: 'toggle-side toggle-side-off' }, o.options[0]?.label ?? 'off'),
    el('span', { class: 'toggle-track' }, el('span', { class: 'toggle-knob' })),
    el('span', { class: 'toggle-side toggle-side-on' }, o.options[1]?.label ?? 'on'),
  );
  return sw;
}

const WHITE_PC = new Set([0, 2, 4, 5, 7, 9, 11]);

export interface NotePopoverOpts {
  id: string;
  options: SpanOption[];   // ordered note list; a leading non-note option (e.g. "all") is allowed
  value: number;
  ariaLabel: string;
  tint?: string | null;
  onCommit: (value: number) => void;
}

/**
 * Note picker (DESIGN board 6): a trigger button showing the current note that opens a piano popover.
 * 128 notes are too many for arrow-stepping alone, so: Left/Right = ±1 semitone, PageUp/PageDown =
 * ±octave, and typing a note name ("c#3") jumps. Dialog is focus-trapped, Escape closes and returns
 * focus to the trigger. Keys are radios; picking one commits and closes.
 *
 * NOTE: the piano VISUAL (white/black key geometry) is built headless and wants a measured pass; the
 * interaction and a11y below are unit-tested.
 */
export function notePopover(o: NotePopoverOpts): HTMLElement {
  const idxOf = (v: number) => { const i = o.options.findIndex((op) => op.value === v); return i < 0 ? 0 : i; };
  const isNote = (label: string) => /^[A-G]#?-?\d/.test(label.trim());

  const wrap = el('div', { class: 'note-picker', style: o.tint ? `--fill: ${o.tint}` : '' });
  const trigger = el('button', {
    type: 'button', id: o.id, class: 'note-trigger',
    'aria-haspopup': 'dialog', 'aria-expanded': 'false', 'aria-label': o.ariaLabel,
  }, o.options[idxOf(o.value)]?.label ?? '') as HTMLButtonElement;
  wrap.appendChild(trigger);

  let dialog: HTMLElement | null = null;
  const close = () => {
    if (!dialog) return;
    dialog.remove(); dialog = null;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.focus();
  };
  const pick = (value: number) => { o.onCommit(value); close(); };

  const open = () => {
    if (dialog) return;
    const cur = idxOf(o.value);
    dialog = el('div', { class: 'note-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': o.ariaLabel });

    // leading non-note option (e.g. "all") gets its own chip above the keys
    const lead = o.options[0] && !isNote(o.options[0].label) ? o.options[0] : null;
    if (lead) {
      dialog.appendChild(el('button', {
        type: 'button', class: `note-lead${o.value === lead.value ? ' is-on' : ''}`,
        onclick: () => pick(lead.value),
      }, lead.label));
    }

    const keys = el('div', { class: 'piano' });
    const keyEls = new Map<number, HTMLElement>();
    o.options.forEach((op) => {
      if (!isNote(op.label)) return;
      const pc = ((op.value % 12) + 12) % 12;
      const white = WHITE_PC.has(pc);
      const k = el('button', {
        type: 'button', id: `${o.id}-k-${op.value}`,
        class: `piano-key ${white ? 'is-white' : 'is-black'}${op.value === o.value ? ' is-on' : ''}`,
        role: 'radio', 'aria-checked': op.value === o.value ? 'true' : 'false', 'aria-label': op.label,
        tabindex: op.value === o.value ? '0' : '-1',
        onclick: () => pick(op.value),
      }, op.label.replace(/-?\d+$/, ''));
      keyEls.set(op.value, k);
      keys.appendChild(k);
    });
    dialog.appendChild(keys);

    // keyboard interaction over the note options
    let active = o.options[cur]!.value;
    let typed = '';
    const focusVal = (v: number) => {
      const k = keyEls.get(v); if (!k) return;
      active = v;
      keyEls.forEach((el2, vv) => el2.setAttribute('tabindex', vv === v ? '0' : '-1'));
      k.focus(); k.scrollIntoView({ block: 'nearest', inline: 'center' });
    };
    const step = (delta: number) => {
      const vals = o.options.filter((op) => isNote(op.label)).map((op) => op.value);
      const at = vals.indexOf(active);
      const to = Math.max(0, Math.min(vals.length - 1, at + delta));
      if (vals[to] !== undefined) focusVal(vals[to]!);
    };
    dialog.addEventListener('keydown', (e) => {
      const ke = e as KeyboardEvent;
      // Handled keys must not bubble to the field's Escape/hint handler, which would blur the trigger
      // this popover just refocused (dropping focus to <body>).
      switch (ke.key) {
        case 'Escape': ke.preventDefault(); ke.stopPropagation(); close(); return;
        case 'ArrowRight': case 'ArrowUp': ke.preventDefault(); ke.stopPropagation(); step(1); return;
        case 'ArrowLeft': case 'ArrowDown': ke.preventDefault(); ke.stopPropagation(); step(-1); return;
        case 'PageUp': ke.preventDefault(); ke.stopPropagation(); step(12); return;   // octave jump
        case 'PageDown': ke.preventDefault(); ke.stopPropagation(); step(-12); return;
        case 'Enter': case ' ': ke.preventDefault(); ke.stopPropagation(); pick(active); return;
        case 'Tab': ke.preventDefault(); ke.stopPropagation(); return;                // focus trap
      }
      // type-to-jump: accumulate a note name like "c#3"
      if (/^[a-gA-G#\d-]$/.test(ke.key)) {
        typed = (typed + ke.key).slice(-4);
        const norm = (s: string) => s.replace(/\s+/g, '').toUpperCase();
        const hit = o.options.find((op) => isNote(op.label) && norm(op.label).startsWith(norm(typed)));
        if (hit) focusVal(hit.value);
      }
    });

    wrap.appendChild(dialog);
    trigger.setAttribute('aria-expanded', 'true');
    focusVal(active);
  };

  trigger.addEventListener('click', () => (dialog ? close() : open()));
  return wrap;
}

export interface GatedSliderOpts {
  id: string;
  options: SpanOption[];   // index 0 is the non-duration head (e.g. Latch); 1..N are the ms values
  value: number;
  defaultValue: number;
  ariaLabel: string;
  headLabel?: string;      // label for value 0 (default "Latch")
  tint?: string | null;
  onLiveValue: (label: string) => void;
  onCommit: (value: number) => void;
}

/**
 * DESIGN board 6 — a two-question control: a "Latch / Timed" segment plus a duration slider that
 * only appears under Timed. length_menu's index 0 is LATCH (hold until the next event), a different
 * behaviour from a zero-length duration — a single slider silently crossed between them on a drag.
 * Two questions → two controls. The byte stays 0=head / 1..N=ms.
 */
export function gatedSlider(o: GatedSliderOpts): HTMLElement {
  const TIMED_DEFAULT = 10; // a sane ms landing when switching Latch → Timed (no previous is stored)
  const isHead = o.value === 0;
  const timed = o.options.filter((op) => op.value !== 0);
  const wrap = el('div', { class: 'gated-slider' });

  wrap.appendChild(segmentedControl({
    id: `${o.id}-mode`, ariaLabel: `${o.ariaLabel} mode`, tint: o.tint, variant: 'segment',
    options: [{ value: 0, label: o.headLabel ?? 'Latch' }, { value: 1, label: 'Timed' }],
    value: isHead ? 0 : 1,
    onCommit: (m) => o.onCommit(m === 0 ? 0 : (o.value > 0 ? o.value : TIMED_DEFAULT)),
  }));

  if (!isHead) {
    wrap.appendChild(sliderControl({
      id: `${o.id}-ms`, options: timed, value: o.value,
      defaultValue: o.defaultValue > 0 ? o.defaultValue : TIMED_DEFAULT,
      ariaLabel: `${o.ariaLabel} duration`, tint: o.tint,
      onLiveValue: o.onLiveValue, onCommit: o.onCommit,
    }));
  }
  return wrap;
}

/* ------------------------------------------------------------------ board 8: pictures */

/** The LFO waveform shapes, drawn — noise vs random are near-synonyms as words and obviously
 *  different as pictures (continuous hash vs stepped sample-and-hold). 34×20 viewBox on purpose,
 *  NOT the 16×16 icon grid: a waveform needs two cycles to read, and two cycles in a square is
 *  mush. Keyed by the domain's label; an unknown label degrades to its word, never to a blank. */
const WAVE_PATHS: Record<string, string> = {
  'saw up': 'M2 17 L15 3 L15 17 L28 3 L28 17',
  'saw down': 'M2 3 L15 17 L15 3 L28 17 L28 3',
  'square': 'M2 17 L2 3 L11 3 L11 17 L20 17 L20 3 L29 3 L29 17 L32 17',
  'triangle': 'M2 17 L9 3 L17 17 L25 3 L32 17',
  'sine': 'M2 10 Q6 1 10 10 T18 10 T26 10 T32 10',
  'noise': 'M2 10 L5 5 L7 15 L10 7 L13 16 L16 4 L19 13 L22 6 L25 15 L28 8 L32 12',
  'random': 'M2 14 L9 14 L9 5 L16 5 L16 16 L23 16 L23 8 L30 8 L30 12 L32 12',
};

/** Cell content for a wave-chips radioGrid: the drawn shape with its word underneath — the picture
 *  is the fast path, the label is the confirmation ("saw up" vs "saw down" is quicker to confirm in
 *  words once the right pair is spotted). Both carriers, per the house rule. */
export function waveChipContent(label: string): Node {
  const d = WAVE_PATHS[label];
  if (!d) return el('span', { class: 'wave-chip-label' }, label);
  return el('span', { class: 'wave-chip' },
    el('span', {
      class: 'wave-chip-shape',
      html: `<svg width="34" height="20" viewBox="0 0 34 20" fill="none" stroke="currentColor" ` +
        `stroke-width="1.8" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`,
    }),
    el('span', { class: 'wave-chip-label' }, label),
  );
}

export interface DivisionGridOpts {
  id: string;
  options: SpanOption[];
  value: number;
  ariaLabel: string;
  tint?: string | null;
  onCommit: (value: number) => void;
}

/** Clock divisions laid out as base × feel instead of a long slider. On the slider, 1/4 and 1/4T
 *  sat fifteen stops apart; here "same division, triplet instead" is one cell down. The grid is
 *  built by PARSING the labels (trailing T = triplet, trailing . = dotted; the rest is the base),
 *  never a hardcoded column map — both division domains share this, and the ragged corners lay
 *  themselves out. A missing combination renders as an EMPTY cell, not a skipped one: the gap where
 *  1/32. would be is real information the slider used to hide. Row headers are words, not note
 *  glyphs — glyphs are font-dependent (the disclosure-triangle trap). */
export function divisionGrid(o: DivisionGridOpts): HTMLElement {
  type Feel = 'straight' | 'triplet' | 'dotted';
  const FEELS: readonly Feel[] = ['straight', 'triplet', 'dotted'];
  const feelOf = (l: string): Feel => (l.endsWith('T') ? 'triplet' : l.endsWith('.') ? 'dotted' : 'straight');
  const baseOf = (l: string): string => (l.endsWith('T') || l.endsWith('.') ? l.slice(0, -1) : l);

  // Columns are the bases in domain order (first appearance); rows are the feels that occur.
  const bases: string[] = [];
  for (const op of o.options) { const b = baseOf(op.label); if (!bases.includes(b)) bases.push(b); }
  const feels = FEELS.filter((f) => o.options.some((op) => feelOf(op.label) === f));
  const at = new Map<string, SpanOption>();
  for (const op of o.options) at.set(`${feelOf(op.label)}|${baseOf(op.label)}`, op);
  const grid: (SpanOption | null)[][] = feels.map((f) => bases.map((b) => at.get(`${f}|${b}`) ?? null));

  const cellId = (op: SpanOption) => `${o.id}-cell-${op.value}`;
  const group = el('div', {
    class: 'division-grid', role: 'radiogroup', 'aria-label': o.ariaLabel,
    style: `--fill: ${o.tint || 'var(--accent)'}; --div-cols: ${bases.length}`,
  });

  const select = (op: SpanOption, focus: boolean) => {
    if (focus && typeof requestAnimationFrame === 'function') {
      // Commit re-renders; refocus the chosen cell by its stable id afterwards (radioGrid pattern).
      requestAnimationFrame(() => document.getElementById(cellId(op))?.focus());
    }
    o.onCommit(op.value);
  };

  // Arrows move over POPULATED cells, scanning past gaps — the gaps stay visible, they're just not stops.
  const move = (r: number, c: number, key: string): SpanOption | null => {
    let dr = 0, dc = 0;
    if (key === 'ArrowRight') dc = 1;
    else if (key === 'ArrowLeft') dc = -1;
    else if (key === 'ArrowDown') dr = 1;
    else if (key === 'ArrowUp') dr = -1;
    else if (key === 'Home') { for (const row of grid) for (const x of row) if (x) return x; return null; }
    else if (key === 'End') {
      for (let i = feels.length - 1; i >= 0; i--) for (let j = bases.length - 1; j >= 0; j--) { const x = grid[i]![j]; if (x) return x; }
      return null;
    } else return null;
    let rr = r + dr, cc = c + dc;
    while (rr >= 0 && rr < feels.length && cc >= 0 && cc < bases.length) {
      const hit = grid[rr]![cc];
      if (hit) return hit;
      rr += dr; cc += dc;
    }
    return null;
  };

  const cur = o.options.find((op) => op.value === o.value) ?? o.options[0]!;
  feels.forEach((feel, r) => {
    // aria-hidden: each cell's own label already spells the feel ("1/4T (triplet)").
    group.appendChild(el('span', { class: 'division-feel', 'aria-hidden': 'true' }, feel));
    bases.forEach((_base, c) => {
      const op = grid[r]![c];
      if (!op) { group.appendChild(el('span', { class: 'division-empty', 'aria-hidden': 'true' })); return; }
      const checked = op.value === cur.value;
      const cell = el('button', {
        type: 'button', id: cellId(op), class: `radio-cell division-cell${checked ? ' is-on' : ''}`,
        role: 'radio', 'aria-checked': checked ? 'true' : 'false',
        'aria-label': `${op.label}${feel === 'straight' ? '' : ` (${feel})`}`,
        tabindex: checked ? '0' : '-1',
        onclick: () => select(op, false),
        onkeydown: (e: Event) => {
          const ke = e as KeyboardEvent;
          if (ke.key === ' ' || ke.key === 'Enter') { ke.preventDefault(); select(op, false); return; }
          const to = move(r, c, ke.key);
          if (to && to.value !== op.value) { ke.preventDefault(); select(to, true); }
        },
      }, op.label);
      if (checked && o.tint) cell.style.color = o.tint;
      group.appendChild(cell);
    });
  });

  return group;
}

/** Sequencer direction shapes (board 8 stage 2), 30×16. "Pendulum" is the word people misread;
 *  the double-headed arrow is the point. Round linecaps on the arrows. */
const DIR_PATHS: Record<string, string> = {
  forward: 'M3 8 H24 M19 3 L25 8 L19 13',
  backward: 'M27 8 H6 M11 3 L5 8 L11 13',
  pendulum: 'M6 8 H24 M19 3 L25 8 L19 13 M11 3 L5 8 L11 13',
  random: 'M4 12 L10 5 L15 11 L21 4 L26 9',
};

/** Chip content for seq_dir_menu: arrow + word, same both-carriers rule as the waves. */
export function dirChipContent(label: string): Node {
  const d = DIR_PATHS[label];
  if (!d) return el('span', { class: 'wave-chip-label' }, label);
  return el('span', { class: 'wave-chip' },
    el('span', {
      class: 'wave-chip-shape',
      html: `<svg width="30" height="16" viewBox="0 0 30 16" fill="none" stroke="currentColor" ` +
        `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`,
    }),
    el('span', { class: 'wave-chip-label' }, label),
  );
}

/** Chip content for swing_menu: two bars of eighths — four on-beat bars fixed, the off-beat pair
 *  displaced proportionally to the swing amount (OFF = even = 50%). The drawing IS the timing. */
export function swingChipContent(label: string): Node {
  const m = label.match(/^(\d+)\s*%$/);
  const f = m ? Number(m[1]) / 100 : label === 'OFF' ? 0.5 : null;
  if (f === null || f < 0.5 || f > 1) return el('span', { class: 'wave-chip-label' }, label);
  const off = (beat: number) => (beat + 8 * f).toFixed(1); // beat period 8, off-beat at fraction f
  const d = `M2 2 V14 M10 2 V14 M18 2 V14 M26 2 V14` +           // on-beats, fixed
            ` M${off(2)} 6 V14 M${off(18)} 6 V14`;               // off-beat pair, displaced
  return el('span', { class: 'wave-chip' },
    el('span', {
      class: 'wave-chip-shape',
      html: `<svg width="30" height="16" viewBox="0 0 30 16" fill="none" stroke="currentColor" ` +
        `stroke-width="1.8" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="${d}"/></svg>`,
    }),
    el('span', { class: 'wave-chip-label' }, label),
  );
}
