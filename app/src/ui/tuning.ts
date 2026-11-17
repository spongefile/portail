/**
 * The Tuning tab: author microtonal tables and send them to the module's 8 slots.
 *
 * The module can't return a table, so this edits a local LIBRARY (tuning-library.ts) and SENDS a
 * tuning to a slot. The write format is firmware-derived and not confirmed on hardware, so the first
 * send is gated behind a one-time confirmation; the UI never implies a sent table is permanent.
 */

import { el, clear, button, field, confirmDialog } from './dom';
import { PITCH_CLASS_NAMES, TWELVE_TET, type Tuning } from '../model/tuning';
import { parseScl, toScl } from '../model/scl';
import { radioGrid } from './controls';
import { tuningLibrary } from '../state/tuning-library';

export interface TuningTabOptions {
  send: (slot: number, cents: readonly number[]) => Promise<void>;
  isConnected: () => boolean;
  deviceLabel: () => string;
  toast: (kind: 'success' | 'warn' | 'error' | 'info', title: string, body?: string) => void;
}

export function mountTuning(container: HTMLElement, o: TuningTabOptions): void {
  let selectedId = tuningLibrary.tunings[0]?.id ?? null;
  let selectedSlot = Math.max(0, selectedId ? tuningLibrary.slotOf(selectedId) : 0);
  const render = () => {
    // Preserve the focused control + caret across the full rebuild (the tab re-renders on every
    // library change), so editing a cents field doesn't lose focus (reviewer #2).
    const active = document.activeElement as HTMLInputElement | null;
    const activeId = active?.id ?? '';
    const caret = active && typeof active.selectionStart === 'number' ? active.selectionStart : null;
    draw(container, o, selectedId,
      () => selectedSlot, // live getter — the single source of truth for the send slot
      (id) => { selectedId = id; const s = tuningLibrary.slotOf(id); if (s >= 0) selectedSlot = s; render(); },
      (slot) => { selectedSlot = slot; render(); }); // re-render so the slot grid reflects the pick
    if (activeId) {
      const restored = document.getElementById(activeId) as HTMLInputElement | null;
      if (restored) { restored.focus({ preventScroll: true }); if (caret != null && restored.setSelectionRange) try { restored.setSelectionRange(caret, caret); } catch { /* number inputs */ } }
    }
  };
  tuningLibrary.subscribe(render);
  render();
}

function draw(container: HTMLElement, o: TuningTabOptions, selectedId: string | null, getSlot: () => number, select_: (id: string) => void, setSlot: (slot: number) => void): void {
  clear(container);
  const lib = tuningLibrary;
  const selected = selectedId ? lib.byId(selectedId) : lib.tunings[0];

  const sidebar = el('nav', { class: 'tuning-sidebar', 'aria-label': 'Tunings' },
    el('div', { class: 'row' },
      el('h2', {}, 'Tunings'),
      el('span', { class: 'spacer' }),
      button('+ New', () => { const t = lib.add(); select_(t.id); }, { class: 'btn-sm' }),
    ),
    el('ul', { class: 'tuning-list' },
      ...lib.tunings.map((t) => {
        const slot = lib.slotOf(t.id);
        return el('li', {},
          el('button', {
            type: 'button',
            class: `tuning-item${t.id === selected?.id ? ' is-current' : ''}`,
            onclick: () => select_(t.id),
          },
            el('span', { class: 'tuning-item-name' }, t.name),
            slot >= 0 ? el('span', { class: 'tuning-item-slot' }, `table ${slot + 1}`) : null,
          ),
        );
      }),
    ),
  );

  const editor = selected ? tuningEditor(o, selected, getSlot, setSlot) : el('div', { class: 'panel-body' }, el('p', { class: 'muted' }, 'No tuning selected. Create one with “+ New”.'));

  container.appendChild(el('div', { class: 'tuning-layout' }, sidebar, editor));
}

function tuningEditor(o: TuningTabOptions, t: Tuning, getSlot: () => number, setSlot: (slot: number) => void): HTMLElement {
  const lib = tuningLibrary;

  const nameInput = el('input', {
    class: 'control', value: t.name, 'aria-label': 'Tuning name', style: 'max-width: 22rem',
    onchange: (e: Event) => lib.update(t.id, { name: (e.target as HTMLInputElement).value.trim() || 'Untitled' }),
  }) as HTMLInputElement;

  const rows = PITCH_CLASS_NAMES.map((nm, pc) => {
    const cents = t.cents[pc] ?? 0;
    const delta = Math.round(cents - (TWELVE_TET[pc] ?? 0));
    const input = el('input', {
      id: `tuning-cent-${pc}`, class: 'control tuning-cents', type: 'number', step: '0.1', value: cents.toFixed(2),
      'aria-label': `${nm} cents`,
      onchange: (e: Event) => lib.setCent(t.id, pc, Number((e.target as HTMLInputElement).value)),
    });
    return el('div', { class: 'tuning-row' },
      el('span', { class: 'tuning-pc' }, nm),
      input,
      el('span', { class: 'tuning-delta small muted' }, (delta === 0 ? '±0' : (delta > 0 ? `+${delta}` : `${delta}`)) + ' vs 12-TET'),
    );
  });

  // Import / export
  const fileInput = el('input', { type: 'file', accept: '.scl,text/plain', style: 'display:none',
    onchange: async (e: Event) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      try {
        const r = parseScl(await f.text());
        lib.update(t.id, { name: r.name, cents: r.cents });
        if (r.warnings.length) o.toast('warn', 'Imported with notes', r.warnings.join(' '));
        else o.toast('success', 'Scale imported', `${r.name} loaded into “${t.name}”.`);
      } catch (err) {
        o.toast('error', 'Could not import that .scl', String(err instanceof Error ? err.message : err));
      }
      (e.target as HTMLInputElement).value = '';
    },
  }) as HTMLInputElement;

  const exportScl = () => {
    const blob = new Blob([toScl(t.name, t.cents)], { type: 'text/plain' });
    const a = el('a', { href: URL.createObjectURL(blob), download: `${t.name.replace(/\s+/g, '_')}.scl` }) as HTMLAnchorElement;
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // Send to a slot, behind the one-time hardware gate.
  // A separate button from the Editor's "Send to module" (which writes the 16-output config); name it
  // for what it does and show the live target table so the two are never confused.
  const sendBtn = button(`Send tuning to table ${getSlot() + 1}`, () => void send(), { class: 'btn-sm btn-primary' });
  // Name each slot with what the app last SENT there — never "empty" (the app can't know a slot is
  // empty, only what it sent). "not sent from here" keeps that honest.
  const slotLabel = (i: number) => { const id = lib.assignments[i]; const t = id ? lib.byId(id) : null; return `table ${i + 1} · ${t ? t.name : 'not sent from here'}`; };
  // The 8 tables are addresses, not a magnitude — a 4-across grid (2 rows) of landscape cells, each
  // naming what the app last sent there (never "empty"), so a table's name never truncates. radioGrid
  // re-renders on pick via setSlot → the send button follows.
  const slotSelect = radioGrid({
    id: 'tuning-slot',
    options: Array.from({ length: 8 }, (_, i) => ({ value: i, label: slotLabel(i) })),
    value: getSlot(), ariaLabel: 'Destination table', cols: 4,
    // Stacked: the number is the ADDRESS (constant x-position, scannable), the name is the content.
    // Unsent slots show only the number — the "not sent" epistemics live once under the grid, not
    // eight times. The aria-label (op.label) keeps the full "table N · …" for screen readers.
    format: (_label, v) => {
      const id = lib.assignments[v]; const t = id ? lib.byId(id) : null;
      // title mirrors the aria-label ("table N · …") so the full name is available on hover too — a
      // long custom name can still ellipsise at this width, and sighted users deserve it as well.
      return el('span', { class: 'tuning-cell', title: slotLabel(v) },
        el('span', { class: 'tuning-cell-n' }, String(v + 1)),
        t ? el('span', { class: 'tuning-cell-name' }, t.name) : null,
      );
    },
    onCommit: (v) => setSlot(v),
  });
  slotSelect.classList.add('tuning-slot-grid');
  const send = async () => {
    const slot = getSlot(); // live state, never a possibly-detached DOM element
    if (!o.isConnected()) { o.toast('warn', 'No module connected', 'Connect a Portail (or use the simulator) to send a table.'); return; }
    if (!lib.hardwareVerified) {
      const ok = await confirmDialog({
        title: 'Send an unverified tuning table?',
        body: 'This write format was recovered from the firmware but has not been confirmed on real hardware. ' +
          'It cannot brick the module, and it writes to working memory only (it may revert to standard tuning on power-off). ' +
          'After sending, play a chromatic run and check the tuning matches; if it does, mark it confirmed so this warning stops.',
        confirmLabel: 'Send anyway',
      });
      if (!ok) return;
    }
    try {
      await o.send(slot, t.cents);
      lib.markSent(slot, t.id);
      o.toast('success', `Sent to table ${slot + 1}`,
        lib.hardwareVerified ? `Written to the ${o.deviceLabel()}’s working tuning.`
          : 'Written to working memory. Did it play in tune? If yes, mark it confirmed below.');
    } catch (err) {
      o.toast('error', 'Send failed', String(err instanceof Error ? err.message : err));
    }
  };

  const gateNote = lib.hardwareVerified
    ? el('div', { class: 'tuning-rearm small muted' },
        'Table writing is confirmed for your module. ',
        button('Re-arm the warning', () => { lib.reArmHardwareGate(); o.toast('info', 'Warning re-armed', 'The unverified confirmation will show again on the next send.'); }, { class: 'btn-sm btn-ghost' }),
      )
    : el('div', { class: 'tuning-gate' },
        el('span', { class: 'tag tag-unverified' }, 'Unverified'),
        el('span', { class: 'small muted' }, 'The table-write format isn’t confirmed on your hardware yet. This applies to ALL tunings, not just this one. '),
        button('Confirm the module accepts table writes', () => { lib.markHardwareVerified(); o.toast('success', 'Table writing confirmed', 'The unverified warning is now off for every tuning. You can re-arm it later.'); }, { class: 'btn-sm' }),
      );

  return el('section', { class: 'panel tuning-editor' },
    el('div', { class: 'panel-head' },
      el('h2', {}, 'Edit tuning'),
      el('span', { class: 'spacer' }),
      button('Import .scl', () => fileInput.click(), { class: 'btn-sm' }),
      button('Export .scl', exportScl, { class: 'btn-sm' }),
      button('Reset to 12-TET', () => lib.update(t.id, { cents: [...TWELVE_TET] }), { class: 'btn-sm btn-ghost' }),
      button('Delete', async () => { if (await confirmDialog({ title: `Delete “${t.name}”?`, body: 'This removes it from your library.', confirmLabel: 'Delete', danger: true })) lib.remove(t.id); }, { class: 'btn-sm btn-ghost' }),
    ),
    el('div', { class: 'panel-body' },
      fileInput,
      field({ id: 'tuning-name', label: 'Name', control: nameInput }),
      t.note ? el('p', { class: 'field-hint tuning-note' }, t.note) : null,
      el('p', { class: 'field-hint' }, 'Cents for each pitch class. The octave (1200) is added by the module. C is normally 0; a non-zero root transposes the whole table.'),
      el('div', { class: 'tuning-grid' }, ...rows),
      el('div', { class: 'tuning-send' },
        el('span', {}, 'Send to '),
        slotSelect,
        sendBtn,
        el('span', { class: 'small muted' }, `· ${o.deviceLabel()}`),
      ),
      // Adjacent to the picker on purpose: once the picker asserts what's in each slot, this caveat
      // is what keeps that assertion honest.
      el('p', { class: 'field-hint' },
        'A blank table was not sent from here — the module may still hold something; this app only ' +
        'tracks what IT last sent, since the module can’t report its tables back. Sending replaces one ' +
        'of the 8 tables in working memory, and the change does not survive a power-cycle.'),
      gateNote,
    ),
  );
}
