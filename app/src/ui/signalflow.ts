/**
 * FX signal flow (DESIGN.md §6.5): the editable chain for the selected output, in the inspector.
 * MIDI source → FX chips → "+ insert FX". Clicking a chip expands its parameters INLINE below the
 * strip (the output stays selected — no context jump). No endpoint jack: the inspector header
 * already names the output. Shape encodes ontology (§6.0-A): MIDI/FX are lozenges.
 *
 * (A separate whole-module read-only map was tried and removed — with 8 shared FX slots it almost
 * always just mirrored this strip; the rack already flags which outputs carry FX.)
 */

import { el, button } from './dom';
import { openIconMenu } from './mode-menu';
import { iconSvg } from './icons';
import { fxChip } from './primitives';
import type { Store } from '../state/store';
import { chainForOutput, validFxModesForOutput, usedFxCount, fxTargetsCv, outputModeWakesFx, fxWakeModeNames } from '../model/fx';
import { familyOfLine, labelFor, modeByIndex, modeColor } from '../model/model';
import { renderParamGrid } from './params';

const FX_BUDGET = 8;

function arrow(dim = false): HTMLElement {
  return el('span', { class: `flow-arrow${dim ? ' is-dim' : ''}`, 'aria-hidden': 'true' }, dim ? '⇢' : '→');
}

/** The MIDI source node — shows the channel the output listens on, if any. */
function sourceChip(store: Store, line: number, withChannel: boolean): HTMLElement {
  const family = familyOfLine(line);
  const l = store.get().config.lines[line]!;
  const mode = modeByIndex(family, l.mode);
  const chParam = mode?.params.find((p) => p.id === 'channel');
  const chLabel = chParam ? labelFor(chParam, l.bytes[chParam.index] ?? 0) : null;
  // In the inspector the channel has its own labelled field below, so the source is just "MIDI"
  // (R3 — no duplication). In the read-only map there is no field, so show the channel here.
  const label = withChannel && chLabel && chLabel !== 'MIDI' ? `MIDI ${chLabel}` : 'MIDI';
  const open = store.get().sourceOpen;
  // NOT selected: styling comes from .is-source (jack colour), never the generic FX blue/selected.
  const chip = fxChip({
    label, icon: 'note',
    onClick: () => store.toggleSource(),
    title: open ? 'Close this output’s settings' : 'MIDI in — tap to edit this output’s settings',
  });
  // The MIDI node isn't an effect — it's this output's input, so it takes the jack's family colour.
  const col = modeColor(family, l.mode);
  chip.classList.add('is-source');
  if (open) chip.classList.add('is-open');
  if (col) chip.style.setProperty('--src', col);
  return chip;
}

/**
 * One editable FX chip. Tap to open its inline editor; DRAG to reorder or onto the trash to remove
 * (see attachDragReorder). No visible arrows or ✕ — those are replaced by dragging. Keyboard users
 * keep a path: ← / → reorder, Delete/Backspace removes.
 */
/** "Note, Arpeggiator, Sequencer or Random" from a list of mode names. */
function orList(names: string[]): string {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}`;
}

function chainChip(store: Store, entry: ReturnType<typeof chainForOutput>[number]): HTMLElement {
  const expanded = store.get().expandedFx === entry.fxLine;
  const chip = fxChip({
    label: entry.display,
    icon: entry.key,
    sub: fxSummaryValue(store, entry.fxLine),
    selected: expanded,
    onClick: () => store.setExpandedFx(entry.fxLine),
    title: expanded ? 'Close this FX’s settings' : `${entry.display} — tap to edit, drag to reorder or to the trash to remove`,
  });
  chip.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); store.removeFxSlot(entry.fxLine); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); store.moveFx(entry.fxLine, -1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); store.moveFx(entry.fxLine, 1); }
  });
  const group = el('span', { class: `chain-chip-group${entry.inert ? ' is-inert' : ''}` }, chip);
  if (entry.inert) {
    // Kept in the chain, never auto-deleted (this project preserves what the user made and explains).
    const wake = orList(fxWakeModeNames(fxTargetsCv(entry.mode)));
    chip.classList.add('is-inert');
    chip.title = `${entry.display} is inert — this output's mode doesn't produce the ${fxTargetsCv(entry.mode) ? 'note' : 'gate'} data it processes, so it does nothing. It still uses one of the 8 FX slots. Set this output to ${wake} to reactivate; drag to the trash to remove.`;
    group.appendChild(el('span', { class: 'chain-inert-note small', 'aria-hidden': 'true' }, `inert · needs ${wake}`));
  }
  return group;
}

const TRASH_ICON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 4M6.5 7v4M9.5 7v4"/></svg>';

function trashZone(): HTMLElement {
  // Tapping the trash can't delete anything (it's a DRAG target) — say so, briefly, then fade.
  const zone = el('span', {
    class: 'chain-trash', title: 'Drag an effect here to remove it', html: TRASH_ICON,
    onclick: () => {
      zone.querySelector('.chain-trash-hint')?.remove();
      const hint = el('span', { class: 'chain-trash-hint' }, 'drag FX here to delete');
      hint.addEventListener('animationend', () => hint.remove());
      zone.appendChild(hint);
    },
  });
  return zone;
}

/** Value label for an FX's most identifying parameter, e.g. "dorian" for SCALE. */
function fxSummaryValue(store: Store, fxLine: number): string {
  const l = store.get().config.lines[fxLine]!;
  const mode = modeByIndex('fx', l.mode);
  const p = mode?.params.find((x) => x.index >= 2);
  if (!p) return '';
  return labelFor(p, l.bytes[p.index] ?? 0);
}

/** The inline editor shown under the strip for the expanded FX (J2): change its effect + params. */
function inlineFxEditor(store: Store, fxLine: number): HTMLElement {
  const l = store.get().config.lines[fxLine]!;
  const mode = modeByIndex('fx', l.mode);
  const outputLine = (fxTargetsCv(l.mode) ? 0 : 8) + (l.bytes[1] ?? 0);
  // Only effects valid for THIS output's bank — else picking a gate effect from a CV output would
  // fling the FX to GATE 1 (reviewer finding #1). Same icon+label popover as the mode menu / insert.
  const fxModes = validFxModesForOutput(outputLine);
  const cur = fxModes.find((m) => m.index === l.mode);
  const modeSelect = button(cur?.display ?? mode?.display ?? '?', () => {
    openIconMenu(modeSelect, 'Effect', [{
      label: null, tint: 'var(--fx)',
      items: fxModes.map((m) => ({ value: m.index, display: m.display, icon: m.icon ?? m.key })),
    }], l.mode, (v) => store.setLineMode(fxLine, v));
  }, { id: `fx-mode-${fxLine}`, class: 'btn-sm fx-mode-btn' });
  if (mode) modeSelect.prepend(el('span', { class: 'mode-menu-ic', html: iconSvg(mode.icon ?? mode.key, 15) }));
  return el('div', { class: 'fx-inline-editor' },
    el('div', { class: 'fx-inline-head' },
      el('span', { class: 'small muted' }, 'Editing'),
      modeSelect,
      el('span', { class: 'spacer' }),
      mode?.key === 'microtonal'
        ? button('Edit tables…', () => document.dispatchEvent(new CustomEvent('portail:navigate', { detail: 'tuning' })), { class: 'btn-sm', title: 'Open the Tuning tab to author the 8 microtonal tables' })
        : null,
      button('Done', () => store.setExpandedFx(null), { class: 'btn-sm btn-ghost', title: 'Close this FX’s settings' }),
    ),
    mode && mode.doc ? el('p', { class: 'field-hint' }, mode.doc) : null,
    renderParamGrid(store, fxLine),
  );
}

/** The editable chain for one output line, for the inspector. */
export function renderChainStrip(store: Store, line: number): HTMLElement {
  const config = store.get().config;
  const entries = chainForOutput(config, line);
  const expanded = store.get().expandedFx;
  const expandedHere = expanded !== null && entries.some((e) => e.fxLine === expanded);

  const nodes: HTMLElement[] = [sourceChip(store, line, true)];
  entries.forEach((e) => {
    nodes.push(arrow(e.inert)); // a broken link into a dead node reads as broken
    nodes.push(chainChip(store, e));
  });
  nodes.push(arrow());
  nodes.push(insertControl(store, line));
  const trash = entries.length > 0 ? trashZone() : null;
  if (trash) nodes.push(trash);

  const used = usedFxCount(config);
  const row = el('div', { class: 'flow-row' }, ...nodes);
  if (entries.length > 0) attachDragReorder(row, store, entries.map((e) => e.fxLine), trash);
  return el('div', { class: 'signal-flow' },
    el('div', { class: 'flow-head' },
      el('span', { class: 'flow-label small muted' }, 'Signal flow into this output'),
      used >= FX_BUDGET ? el('span', { class: 'small warn' }, 'all 8 FX slots used') : null,
    ),
    row,
    entries.length === 0
      ? el('span', { class: 'small muted' }, 'No FX on this output yet. Add one with “+ insert FX”; add more to build a chain (they process left to right).')
      : null,
    expandedHere ? inlineFxEditor(store, expanded!) : null,
    store.get().sourceOpen ? sourceEditor(store, line) : null,
  );
}

/** The output's own mode parameters, revealed inline when the MIDI node is tapped. */
function sourceEditor(store: Store, line: number): HTMLElement {
  return el('div', { class: 'fx-inline-editor source-inline' },
    el('div', { class: 'fx-inline-head' },
      el('span', { class: 'small muted' }, 'Output settings'),
      el('span', { class: 'spacer' }),
      button('Done', () => store.toggleSource(), { class: 'btn-sm btn-ghost', title: 'Close this output’s settings' }),
    ),
    renderParamGrid(store, line),
  );
}

/**
 * Pointer-drag reorder for the FX chips (mouse + touch). A plain tap still opens the chip's editor;
 * dragging past a threshold reorders and commits once on release (so the DOM isn't rebuilt mid-drag).
 * The ‹ › chevrons remain for keyboard users.
 */
function attachDragReorder(row: HTMLElement, store: Store, fxLines: number[], trash: HTMLElement | null): void {
  const groups = Array.from(row.querySelectorAll<HTMLElement>('.chain-chip-group'));
  const overTrash = (e: PointerEvent): boolean => {
    if (!trash) return false;
    const r = trash.getBoundingClientRect();
    return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
  };
  groups.forEach((group, index) => {
    const chip = group.querySelector<HTMLElement>('.fx-chip');
    if (!chip) return;
    chip.addEventListener('pointerdown', (down: PointerEvent) => {
      if (down.button !== 0) return;
      if ((down.target as HTMLElement).closest('select')) return; // ignore controls inside
      const startX = down.clientX, startY = down.clientY;
      const centers = groups.map((g) => { const r = g.getBoundingClientRect(); return r.left + r.width / 2; });
      let dragging = false;

      const move = (e: PointerEvent) => {
        const dx = e.clientX - startX, dy = e.clientY - startY;
        if (!dragging && Math.hypot(dx, dy) > 4) {
          dragging = true;
          chip.setPointerCapture(e.pointerId);
          group.classList.add('is-dragging');
        }
        if (dragging) {
          group.style.transform = `translate(${dx}px, ${dy}px)`;
          trash?.classList.toggle('is-target', overTrash(e));
        }
      };
      const up = (e: PointerEvent) => {
        chip.removeEventListener('pointermove', move);
        chip.removeEventListener('pointerup', up);
        chip.removeEventListener('pointercancel', up);
        group.style.transform = '';
        group.classList.remove('is-dragging');
        trash?.classList.remove('is-target');
        if (!dragging) return; // a tap — let the chip's onClick open the editor
        // swallow the click that would otherwise fire after this drag
        const swallow = (c: Event) => { c.preventDefault(); c.stopPropagation(); };
        chip.addEventListener('click', swallow, { once: true, capture: true });
        setTimeout(() => chip.removeEventListener('click', swallow, true), 0);
        if (overTrash(e)) { store.removeFxSlot(fxLines[index]!); return; } // dropped on the trash → remove
        // otherwise reorder: drop index = how many OTHER chips' centres the pointer ended up past
        let target = 0;
        for (let j = 0; j < centers.length; j++) { if (j !== index && e.clientX > centers[j]!) target++; }
        if (target !== index) store.reorderFx(fxLines[index]!, target);
      };
      chip.addEventListener('pointermove', move);
      chip.addEventListener('pointerup', up);
      chip.addEventListener('pointercancel', up);
    });
  });
}

/** The "+ insert FX" control — a select of valid FX modes for this output. */
function insertControl(store: Store, line: number): HTMLElement {
  const used = usedFxCount(store.get().config);
  if (used >= FX_BUDGET) {
    return el('span', { class: 'chain-insert-full small muted' }, '8 / 8 FX slots used');
  }
  // FX only do something if this output's CURRENT mode produces their input signal, so offer them
  // only then; when they're hidden for that reason, say so rather than silently showing an empty list.
  const allModes = validFxModesForOutput(line);
  const wakes = outputModeWakesFx(store.get().config, line);
  const modes = wakes ? allModes : [];
  const hidden = allModes.length - modes.length;

  const wrap = el('span', { class: 'chain-insert-wrap' });
  if (modes.length) {
    // Same icon+label popover as the mode menu (Tina) — one flat FX group, accent-tinted.
    const btn = button('+ insert FX', () => {
      openIconMenu(btn, 'Insert FX', [{
        label: null, tint: 'var(--fx)',
        items: modes.map((m) => ({ value: m.index, display: m.display, icon: m.icon ?? m.key })),
      }], null, (v) => {
        const fxLine = store.insertFx(line, v);
        if (fxLine !== null) store.setExpandedFx(fxLine); // open the new FX for editing straight away
      });
    }, { id: `insert-fx-${line}`, class: 'btn-sm chain-insert' });
    wrap.appendChild(btn);
  }
  if (hidden > 0) {
    wrap.appendChild(el('span', { class: 'chain-insert-full chain-insert-hint small muted' },
      'choose output to add FX'));
  }
  return wrap;
}

