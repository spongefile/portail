/**
 * Live MIDI activity monitor.
 *
 * The official editor offers a 12 px dot that blinks and a div showing raw comma-separated decimal
 * bytes (AUDIT.md §2.13). This decodes messages into note names, channels and CC numbers so
 * "why isn't it doing anything" is answerable without a second tool.
 */

import { el, button } from './dom';
import type { MidiActivity } from '../device/types';

const MAX_ROWS = 400;

export interface MonitorFilters {
  notes: boolean;
  cc: boolean;
  clock: boolean;
  sysex: boolean;
  other: boolean;
}

export const defaultFilters: MonitorFilters = {
  notes: true, cc: true, clock: false, sysex: true, other: true,
};

export class MidiMonitor {
  private events: MidiActivity[] = [];
  private paused = false;
  filters: MonitorFilters = { ...defaultFilters };
  /** Counts every message seen, including ones the filters hide. */
  private counts = { in: 0, out: 0 };
  private lastActivityAt = 0;

  push(e: MidiActivity): void {
    this.counts[e.direction]++;
    this.lastActivityAt = e.at;
    if (this.paused) return;
    this.events.push(e);
    if (this.events.length > MAX_ROWS) this.events.splice(0, this.events.length - MAX_ROWS);
  }

  clear(): void { this.events = []; }
  setPaused(v: boolean): void { this.paused = v; }
  isPaused(): boolean { return this.paused; }
  getCounts(): { in: number; out: number } { return { ...this.counts }; }

  /** True if anything arrived in the last 150 ms — drives the activity LED. */
  isLit(now: number): boolean { return now - this.lastActivityAt < 150; }

  visible(): MidiActivity[] {
    return this.events.filter((e) => this.matches(e));
  }

  private matches(e: MidiActivity): boolean {
    switch (e.kind) {
      case 'note-on': case 'note-off': case 'poly-at': return this.filters.notes;
      case 'cc': return this.filters.cc;
      case 'clock': case 'transport': case 'sense': return this.filters.clock;
      case 'sysex': return this.filters.sysex;
      default: return this.filters.other;
    }
  }
}

export function renderMonitor(monitor: MidiMonitor, onChange: () => void): HTMLElement {
  const rows = monitor.visible().slice().reverse();
  const counts = monitor.getCounts();

  const toggle = (key: keyof MonitorFilters, label: string) =>
    el('label', { class: 'toggle' },
      el('input', {
        type: 'checkbox',
        checked: monitor.filters[key],
        onchange: (e: Event) => {
          monitor.filters[key] = (e.target as HTMLInputElement).checked;
          onChange();
        },
      }),
      label,
    );

  return el(
    'section',
    { class: 'panel' },
    el(
      'div',
      { class: 'panel-head' },
      el('h2', {}, 'MIDI activity'),
      el('span', { class: `activity-led${monitor.isLit(performance.now()) ? ' lit' : ''}`, id: 'activity-led' }),
      el('span', { class: 'spacer' }),
      el('span', { class: 'small muted mono' }, `in ${counts.in} · out ${counts.out}`),
      button(monitor.isPaused() ? 'Resume' : 'Pause', () => { monitor.setPaused(!monitor.isPaused()); onChange(); }, { class: 'btn-sm' }),
      button('Clear', () => { monitor.clear(); onChange(); }, { class: 'btn-sm btn-ghost' }),
    ),
    el(
      'div',
      { class: 'panel-body' },
      el('div', { class: 'monitor-filters' },
        toggle('notes', 'Notes'),
        toggle('cc', 'CC'),
        toggle('clock', 'Clock'),
        toggle('sysex', 'SysEx'),
        toggle('other', 'Other'),
      ),
      el(
        'div',
        { class: 'monitor-list', role: 'log', 'aria-label': 'MIDI activity log', 'aria-live': 'off' },
        rows.length === 0
          ? el('p', { class: 'monitor-empty' },
              counts.in + counts.out === 0
                ? 'No MIDI seen yet. Play a note on your controller — if nothing appears here, the module is not receiving it either.'
                : 'Nothing matches the current filters.')
          : el('div', {}, ...rows.map((e) =>
              el('div', { class: 'monitor-row' },
                el('span', { class: `mon-dir mon-${e.direction}` }, e.direction === 'in' ? '←' : '→'),
                el('span', { class: 'mon-ch' }, e.channel ? `ch${e.channel}` : ''),
                el('span', { class: 'mon-summary' }, e.summary),
              ),
            )),
      ),
    ),
  );
}
