/**
 * Connection state and the sync controls.
 *
 * The whole point of this bar is that it is never ambiguous. At any moment it answers:
 *   - is a Portail attached, on which port, running what firmware?
 *   - does the module match what is in the editor?
 * The official editor answers neither: it has no persistent connection indicator, and its only
 * failure message is "lost connection !!" produced by a 50 ms race (AUDIT.md §2.1-2.3).
 */

import { el, button, timeAgo } from './dom';
import type { Store, SyncStatus } from '../state/store';
import type { ConnectionState, PortailDevice, TransferProgress } from '../device/types';

export interface SyncActions {
  readFromModule: () => Promise<void>;
  sendToModule: () => Promise<void>;
  checkModule: () => Promise<void>;
  resolveConflict: () => Promise<void>;
  reconnect: () => Promise<void>;
  selectPort: (id: string) => Promise<void>;
  useSimulator: () => void;
  useHardware: () => void;
}

function statusView(state: ConnectionState, deviceKind: string): { dot: string; cls: string; text: string; detail: HTMLElement | string } {
  switch (state.status) {
    case 'unsupported':
      return {
        dot: 'bad', cls: 'state-unsupported',
        text: 'Web MIDI not available',
        detail: state.reason,
      };
    case 'requesting':
      return { dot: 'warn', cls: 'state-searching', text: 'Asking for MIDI access…', detail: 'Choose “Allow” in the browser prompt.' };
    case 'denied':
      return { dot: 'bad', cls: 'state-denied', text: 'MIDI access refused', detail: state.reason };
    case 'searching':
      return {
        dot: 'warn', cls: 'state-searching',
        text: 'No Portail found',
        detail: state.ports.length
          ? `${state.ports.length} MIDI port${state.ports.length === 1 ? '' : 's'} available, none answered. Pick one manually if you know which it is.`
          : 'No MIDI ports at all. Check the USB cable and that the module is powered.',
      };
    case 'connected':
      // The simulator must not wear the hardware's green "Portail connected" — the at-a-glance
      // channel (dot + headline) was actively saying "you're on the real thing". Blue = the app's
      // info colour; GREEN IS RESERVED for a real module (accent-vs-ok also splits cleanly under
      // CVD). The word "Simulator" carries it for everyone else — colour is never the sole carrier.
      if (deviceKind === 'simulator') {
        return {
          dot: 'sim', cls: 'state-sim',
          text: 'Simulator',
          detail: el('span', {},
            'nothing reaches real hardware',
            state.firmware ? el('span', {}, ' · firmware ', el('code', {}, state.firmware)) : null,
          ),
        };
      }
      return {
        dot: 'ok', cls: 'state-connected',
        text: 'Portail connected',
        detail: el('span', {},
          state.port.name,
          state.firmware ? el('span', {}, ' · firmware ', el('code', {}, state.firmware)) : ' · firmware unknown',
        ),
      };
    case 'lost':
      return {
        dot: 'bad', cls: 'state-lost',
        text: 'Connection lost',
        detail: `${state.port.name} stopped answering. The module may have been unplugged or power-cycled.`,
      };
    case 'error':
      return { dot: 'bad', cls: 'state-error', text: 'MIDI error', detail: state.reason };
  }
}

function syncPill(sync: SyncStatus, t: string): HTMLElement {
  switch (sync.kind) {
    case 'unknown':
      return el('span', { class: 'sync-pill sync-unknown', title: `Read from the ${t} to find out whether it matches the editor.` },
        `${t === 'simulator' ? 'Simulator' : 'Module'} contents unknown`);
    case 'in-sync':
      // The age is ALWAYS shown; we never claim the module matches "now" (DESIGN §3.3).
      return el('span', { class: 'sync-pill sync-in-sync', title: 'Verified by the last read; the module could have changed since.' },
        `Matched ${t} · verified ${timeAgo(sync.verifiedAt)}`);
    case 'modified': {
      const bits: string[] = [];
      if (sync.changedLines) bits.push(`${sync.changedLines} slot${sync.changedLines === 1 ? '' : 's'}`);
      if (sync.globals) bits.push('globals');
      if (sync.modMatrix) bits.push('mod matrix');
      return el('span', { class: 'sync-pill sync-modified', title: 'These differences are only in the editor until you send them.' },
        `Not sent: ${bits.join(', ')}`);
    }
    case 'device-ahead':
      return el('span', { class: 'sync-pill sync-device-ahead', title: 'The module changed since we last read it — perhaps a preset was recalled on the panel. Read to catch up.' },
        `Module changed — ${sync.changedLines} slot${sync.changedLines === 1 ? '' : 's'} differ`);
    case 'conflict':
      return el('span', { class: 'sync-pill sync-conflict', title: 'Both the editor and the module changed. Resolve before sending or reading.' },
        `Conflict — both changed`);
  }
}

export function renderConnection(
  store: Store,
  device: PortailDevice,
  actions: SyncActions,
  progress: TransferProgress,
): HTMLElement {
  const state = device.getState();
  const view = statusView(state, device.kind);
  // "Where are these bytes going right now" — the action verbs name the transport (Tina). Copy
  // about the Portail as a DEVICE stays "module".
  const t = device.kind === 'simulator' ? 'simulator' : 'module';
  const sync = store.syncStatus();
  const connected = state.status === 'connected';
  const busy = progress.phase !== 'idle';

  const ports = device.listPorts();
  const portPicker =
    state.status === 'searching' && ports.length > 0
      ? el('label', { class: 'toggle' },
          el('span', { class: 'visually-hidden' }, 'MIDI port'),
          (() => {
            const s = el('select', {
              id: 'port-picker',
              class: 'control',
              style: 'width:auto',
              onchange: (e: Event) => void actions.selectPort((e.target as HTMLSelectElement).value),
            });
            s.appendChild(el('option', { value: '' }, 'Choose a MIDI port…'));
            for (const p of ports) s.appendChild(el('option', { value: p.id }, p.name));
            return s;
          })(),
        )
      : null;

  return el(
    'div',
    { class: `connbar ${view.cls}`, role: 'status', 'aria-live': 'polite' },
    el('span', { class: `status-dot ${view.dot}` }),
    el('span', { class: 'conn-text' }, view.text),
    el('span', { class: 'conn-detail' }, view.detail),
    portPicker,

    el('span', { class: 'masthead-spacer' }),

    busy
      ? el('span', { class: 'progress' },
          el('span', {}, progress.phase === 'sending' ? 'Sending' : 'Reading', ' ', progress.label),
          el('span', { class: 'progress-bar' },
            el('span', { class: 'progress-fill', style: `width:${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` })),
          el('span', { class: 'mono' }, `${progress.done}/${progress.total}`),
        )
      : syncPill(sync, device.kind === 'simulator' ? 'simulator' : 'module'),

    // In a conflict, bulk Send and Read are REPLACED by the resolve flow (DESIGN §3.6) — the user
    // must not be able to silently clobber the module or lose their edits.
    ...(sync.kind === 'conflict'
      ? [button('Resolve…', () => void actions.resolveConflict(), {
          class: 'btn-sm btn-danger', disabled: busy,
          title: 'Both the editor and the module changed. Choose which side wins.',
        })]
      : [
          button(`Check ${t}`, () => void actions.checkModule(), {
            class: 'btn-sm',
            disabled: !connected || busy,
            title: connected
              ? `Re-read the ${t} and report whether it still matches — catches changes made on the panel.`
              : 'Needs a connected module',
          }),
          button(`Read from ${t}`, () => void actions.readFromModule(), {
            class: `btn-sm${sync.kind === 'device-ahead' ? ' btn-nudge' : ''}`,
            disabled: !connected || busy,
            title: connected
              ? (sync.kind === 'device-ahead'
                  ? `The ${t} changed — read to catch up.`
                  : `Read the ${t}’s current configuration into the editor, replacing what is here.`)
              : 'Needs a connected module',
          }),
          button(`Send to ${t}`, () => void actions.sendToModule(), {
            // Primary only when it can work; in a failure state the actionable control is promoted
            // instead (Reconnect / Use simulator) so the bar points at the way forward, not the dead end.
            class: `btn-sm${connected ? ' btn-primary' : ''}`,
            disabled: !connected || busy,
            title: connected
              ? `Write the editor’s configuration to the ${t}’s working memory. Does not save it to a preset.`
              : 'Needs a connected module',
          }),
        ]),
    state.status === 'lost' || state.status === 'searching' || state.status === 'error'
      ? button('Reconnect', () => void actions.reconnect(), { class: 'btn-sm btn-primary' })
      : null,

    device.kind === 'simulator'
      // The door OUT of the simulator, not a fourth sim action: hardware-green outline (green is
      // reserved for "hardware", so it also marks the button that LEADS there) and pushed to the far
      // right, so the row reads [sim actions] … [exit]. Position + colour + the word "hardware"
      // carry it together. Outline not filled: a filled ok-button implies a safe default, and this
      // is a deliberate mode switch. Primary stays Send's.
      ? button('Use real hardware', actions.useHardware, { class: 'btn-sm btn-hw', title: 'Switch back to the Web MIDI transport' })
      : button('Use simulator', actions.useSimulator, {
          class: `btn-sm${state.status === 'denied' || state.status === 'unsupported' ? ' btn-primary' : ' btn-ghost'}`,
          title: 'Work against a simulated Portail — useful with no module attached, or to try something risky',
        }),
  );
}

/** Full-width explainer shown under the bar when the browser simply cannot do MIDI. */
export function renderBrowserNotice(device: PortailDevice, onUseSimulator: () => void): HTMLElement | null {
  const state = device.getState();
  if (state.status !== 'unsupported' && state.status !== 'denied') return null;

  return el(
    'div',
    { class: 'notice notice-danger' },
    el('h3', {}, state.status === 'unsupported' ? 'This browser cannot talk to the module' : 'MIDI access was refused'),
    el('p', {}, state.reason),
    el(
      'p',
      {},
      'Editing, import and export all work normally here. You can build a patch, export it as JSON, ' +
      'and send it to the module later from a browser that supports Web MIDI.',
    ),
    el('div', { class: 'row' }, button('Work against the simulator', onUseSimulator, { class: 'btn-sm' })),
  );
}

/** Shown when the simulator is in use, so nobody mistakes it for their actual module. */
const SIM_NOTICE_KEY = 'portail-editor:sim-notice-dismissed';

/** The long-form explanation earns its place once; after that it repeats what the blue Simulator
 *  bar already says permanently. The BAR is the honest indicator and is never dismissible — this
 *  box is only the explanation. */
export function simNoticeDismissed(): boolean {
  try { return localStorage.getItem(SIM_NOTICE_KEY) === '1'; } catch { return false; }
}
/** Cleared on a switch INTO the simulator from hardware — that is the moment the reminder is worth
 *  showing again. Never cleared on page load: not seeing it every session is the point of closing it. */
export function resetSimNoticeDismissal(): void {
  try { localStorage.removeItem(SIM_NOTICE_KEY); } catch { /* private mode: nothing to reset */ }
}

export function renderSimulatorNotice(device: PortailDevice, onSimulatePanelChange?: () => void, onDismiss?: () => void): HTMLElement | null {
  if (device.kind !== 'simulator' || simNoticeDismissed()) return null;
  return el(
    'div',
    { class: 'notice notice-info notice-dismissible' },
    el('button', {
      type: 'button', class: 'notice-close', 'aria-label': 'Dismiss',
      title: 'Dismiss — the Simulator bar above keeps showing which transport you are on.',
      onclick: () => {
        try { localStorage.setItem(SIM_NOTICE_KEY, '1'); } catch { /* private mode: shows again next load */ }
        onDismiss?.();
      },
    }, '×'),
    el('h3', {}, 'No hardware attached'), // the connbar headline already says Simulator; this box is the long form
    el(
      'p',
      {},
      'You are working against a simulated Portail with its own working memory and 8 preset slots. ' +
      'Reads, writes, preset saves and MIDI learn all behave as they would with a module, but ' +
      'nothing reaches real hardware.',
    ),
    onSimulatePanelChange
      ? el('div', { class: 'row' },
          button('Simulate a panel preset change', onSimulatePanelChange, {
            class: 'btn-sm btn-ghost',
            title: 'Mimic someone pressing the module’s ▲ button — changes the module under the editor so you can see the device-ahead / conflict flow. Then press “Check module”.',
          }))
      : null,
  );
}
