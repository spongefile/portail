/**
 * The 32-row modulation matrix.
 *
 * Keeps the one genuinely good idea in the official editor — the parameter and min/max choices are
 * populated from the *current mode* of whatever line the row targets — while fixing its splice-based
 * row deletion, which corrupts neighbouring rows (AUDIT.md §2.17).
 *
 * The wire format is 32 FIXED slots, so a row's index is its identity: we never splice. The UI shows
 * only ASSIGNED rows (plus the one currently being learned) so a fresh config isn't 32 empty rows;
 * "+ Add assignment" simply reveals the lowest free slot and arms it for MIDI learn.
 */

import { el, button, select } from './dom';
import { spanSlider } from './controls';
import type { Store } from '../state/store';
import type { ModRow } from '../model/types';
import { familyOfLine, labelFor, lineLabel, model, modeByIndex, modeColor } from '../model/model';
import { noteName } from '../device/midi-decode';

const UNASSIGNED = 127;

const isEmptyRow = (m: ModRow): boolean => m.statusHigh === 0 && m.targetParam === 0;

/** "CH 3 CC 74" / "CH 1 NOTE C3" / "not assigned". */
export function describeAssignment(m: ModRow): string {
  if (m.statusHigh === 0) return 'not assigned';
  const kind = m.statusHigh === 9 ? 'NOTE' : m.statusHigh === 11 ? 'CC' : `status ${m.statusHigh}`;
  const value = m.statusHigh === 9 ? noteName(m.number) : String(m.number);
  return `CH ${m.channel + 1} · ${kind} ${value}`;
}

function modRowEl(
  store: Store,
  m: ModRow,
  i: number,
  armedRow: number | null,
  onArm: (row: number | null) => void,
): HTMLElement {
  const state = store.get();
  const targetLine = m.targetLine;
  const assigned = targetLine !== UNASSIGNED && targetLine <= 24;
  const family = assigned && targetLine < 24 ? familyOfLine(targetLine) : null;
  const line = assigned && targetLine < 24 ? state.config.lines[targetLine] : null;
  const mode = family && line ? modeByIndex(family, line.mode) : null;
  const params = mode?.params ?? [];
  const param = params.find((p) => p.index === m.targetParam);
  const domain = param ? model.domains[param.domain] : undefined;
  const valueOptions = domain
    ? domain.labels.slice(0, Math.min(param!.wireMax, domain.count - 1) + 1)
        .map((label, idx) => ({ value: idx, label: String(label) }))
    : [];
  // The Target select's text takes the target output's family colour (matches the jack).
  const famColor = family && line ? modeColor(family, line.mode) : null;

  const destSelect = select(
    `mod-dest-${i}`,
    [
      { value: UNASSIGNED, label: '— none —' },
      ...model.modMatrix.destinations.map((d) => ({ value: d.line, label: d.label })),
    ],
    assigned ? targetLine : UNASSIGNED,
    (v) => store.setModRow(i, { targetLine: v, targetParam: 0, valueMin: 0, valueMax: 0 }),
  );
  if (famColor) destSelect.style.color = famColor;

  return el(
    'div',
    { class: `modrow${armedRow === i ? ' is-armed' : ''}`, role: 'group', 'aria-label': `Modulation row ${i + 1}` },
    el('span', { class: 'modrow-index' }, String(i + 1)),

    // MIDI source, via learn
    el('div', { class: 'field' },
      el('label', { class: 'field-label', for: `mod-learn-${i}` }, 'MIDI source'),
      button(
        armedRow === i ? 'Move a control…' : describeAssignment(m),
        () => onArm(armedRow === i ? null : i),
        {
          id: `mod-learn-${i}`,
          class: `learn-btn ${armedRow === i ? 'is-armed' : ''}`,
          title: 'Click, then move a knob or play a note to assign it.',
        },
      ),
    ),

    // Destination line
    el('div', { class: 'field' },
      el('label', { class: 'field-label', for: `mod-dest-${i}` }, 'Target'),
      destSelect,
    ),

    // Parameter within that line
    el('div', { class: 'field' },
      el('label', { class: 'field-label', for: `mod-param-${i}` }, 'Parameter'),
      select(
        `mod-param-${i}`,
        [
          { value: 0, label: params.length ? '— choose —' : '— target is OFF —' },
          ...params.map((p) => ({ value: p.index, label: p.label })),
        ],
        m.targetParam,
        (v) => {
          const p = params.find((x) => x.index === v);
          const max = p ? Math.min(p.wireMax, p.max) : 0;
          store.setModRow(i, { targetParam: v, valueMin: 0, valueMax: max });
        },
      ),
    ),

    // Min + Max are the two ends of ONE range — a single dual-handle span slider, filled in the
    // target's family colour. Drawn from the target parameter's own value list.
    el('div', { class: 'field field-span' },
      el('label', { class: 'field-label' }, 'Range'),
      valueOptions.length
        ? spanSlider({
            id: `mod-span-${i}`, options: valueOptions, min: m.valueMin, max: m.valueMax,
            fill: famColor,
            onChange: (lo, hi) => store.setModRow(i, { valueMin: lo, valueMax: hi }),
          })
        : el('span', { class: 'small muted' }, '—'),
    ),

    button('Clear', () => { store.clearModRow(i); if (armedRow === i) onArm(null); }, {
      class: 'btn-sm btn-ghost',
      title: `Clear modulation row ${i + 1}`,
      disabled: isEmptyRow(m),
    }),
  );
}

export function renderModMatrix(
  store: Store,
  armedRow: number | null,
  onArm: (row: number | null) => void,
): HTMLElement {
  const state = store.get();
  const rows = state.config.modMatrix;
  const used = rows.filter((r) => r.statusHigh > 0 || r.targetParam > 0).length;

  // Show only assigned rows (plus the one being learned, which may still be empty). Rows keep their
  // fixed slot index — the index is the wire identity, so nothing is renumbered.
  const visible = rows
    .map((m, i) => ({ m, i }))
    .filter(({ m, i }) => !isEmptyRow(m) || i === armedRow);

  const firstFree = rows.findIndex((m) => isEmptyRow(m));
  const addBtn = button('+ Add assignment', () => { if (firstFree >= 0) onArm(firstFree); }, {
    class: 'btn-sm',
    disabled: firstFree < 0,
    title: firstFree < 0 ? 'All 32 modulation slots are in use.' : 'Reveal the next free slot and listen for a control.',
  });

  const body = visible.length
    ? visible.map(({ m, i }) => modRowEl(store, m, i, armedRow, onArm))
    : [el('p', { class: 'field-hint', style: 'margin: .2rem 0' },
        'No modulation assignments yet. “+ Add assignment”, then move a knob or play a note.')];

  return el(
    'section',
    { class: 'panel' },
    el(
      'div',
      { class: 'panel-head' },
      el('h2', {}, 'Modulation matrix'),
      el('span', { class: 'small muted' }, `${used} of ${rows.length} rows assigned`),
      el('span', { class: 'spacer' }),
      armedRow !== null
        ? el('span', { class: 'small', style: 'color: var(--pending); font-weight: 600' },
            `Listening for row ${armedRow + 1} — move a control on your controller`)
        : addBtn,
    ),
    el('div', { class: 'panel-body tight scroll-x' }, ...body),
    el(
      'div',
      { class: 'panel-body' },
      el(
        'p',
        { class: 'field-hint' },
        'Each row maps one incoming MIDI note or CC onto one parameter of one slot. The parameter ' +
        'list and the min/max values follow whatever mode the target slot is currently in, so ' +
        'changing a slot’s mode clears its rows’ parameter (the MIDI assignment is kept).',
      ),
    ),
  );
}

export { labelFor, lineLabel };
