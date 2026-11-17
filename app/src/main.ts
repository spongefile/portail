/**
 * Application controller: wires the store, the device (simulator or WebMIDI, behind one interface),
 * and the panels together, and owns the render loop.
 *
 * The app opens against the SIMULATOR so it is fully usable with no hardware and no permission
 * prompt. Switching to real hardware is an explicit action that (first time) shows the liability
 * disclaimer and then requests Web MIDI. Nothing is ever written to a module as a side effect of
 * editing — Send/Read are deliberate actions (DESIGN §3.4).
 */

import './styles.css';
import { el, clear, scheduler, confirmDialog } from './ui/dom';
import { store } from './state/store';
import { SimulatorDevice } from './device/simulator';
import { WebMidiDevice, webMidiAvailable } from './device/webmidi';
import type { PortailDevice, ConnectionState, TransferProgress, MidiActivity } from './device/types';

import { renderConnection, renderBrowserNotice, renderSimulatorNotice, resetSimNoticeDismissal, type SyncActions } from './ui/connection';
import { renderRack } from './ui/rack';
import { renderGlobals } from './ui/inspector';
import { renderModMatrix } from './ui/modmatrix';
import { MidiMonitor, renderMonitor } from './ui/monitor';
import { renderPresets, confirmLoad, confirmSave, type PresetActions } from './ui/presets';
import { renderLedGuide } from './ui/ledguide';
import { renderFiles } from './ui/files';
import { mountMasthead, type MastheadHandle } from './ui/masthead';
import { maybeShowFirstRunDisclaimer } from './ui/disclaimer';
import { mountManual, showManual } from './ui/manual';
import { mountTuning } from './ui/tuning';

/* ------------------------------------------------------------------ state */

let device: PortailDevice = new SimulatorDevice({ latency: 3 });
const monitor = new MidiMonitor();
let progress: TransferProgress = { phase: 'idle', done: 0, total: 0, label: '' };
let armedModRow: number | null = null;
let view: 'editor' | 'manual' | 'hardware' | 'tuning' = 'editor';
let masthead: MastheadHandle | undefined;
// After a send, how long to let the module settle before a second, confirming verify read (only used
// when the first read-back shows a difference — see sendToModule).
const VERIFY_SETTLE_MS = 250;
let deviceUnsub: (() => void)[] = [];

/* ------------------------------------------------------------------ device wiring */

function wireDevice(d: PortailDevice): void {
  for (const u of deviceUnsub) u();
  deviceUnsub = [];
  let baselined = false; // once per wiring — reconnects re-wire, repeated 'connected' emits don't re-read
  deviceUnsub.push(d.on('connection', (s: ConnectionState) => {
    // Simulator: learn the sync baseline silently on connect (a local object, ~3ms) — without it,
    // diffAgainstDevice() is null until a manual Read, so the changed-dot is silently unavailable
    // and nothing says so. setDeviceConfig ONLY, never replaceConfig: local (possibly persisted)
    // edits must survive a (re)connect, and no conflict dialog can fire from a baseline learn.
    // Real hardware keeps the explicit Read — the transfer is slow enough to want its progress bar,
    // and reading uninvited on connect would be a behaviour change nobody asked for.
    if (s.status === 'connected' && d instanceof SimulatorDevice && !baselined) { baselined = true; void autoBaseline(d); }
    rerender();
  }));
  deviceUnsub.push(d.on('activity', (e: MidiActivity) => { monitor.push(e); scheduleMonitor(); }));
  deviceUnsub.push(d.on('progress', (p: TransferProgress) => {
    progress = p;
    // During a transfer, only the connection bar changes (the progress meter). Re-rendering all
    // panels per message is far too heavy — do a single full rerender when it returns to idle.
    scheduleConnbar();
    if (p.phase === 'idle') rerender();
  }));
  deviceUnsub.push(d.on('preset', (slot: number) => store.setCurrentPreset(slot)));
  deviceUnsub.push(d.on('learn', (m) => {
    if (armedModRow !== null) {
      store.setModRow(armedModRow, { statusHigh: m.statusHigh, channel: m.channel, number: m.number });
      armedModRow = null;
      void device.setLearnMode(false);
      store.toast('success', `Row learned: ${m.statusHigh === 9 ? 'note' : 'CC'} ${m.number} on ch ${m.channel + 1}`);
    }
  }));
}

let autoBaselining = false;
async function autoBaseline(d: PortailDevice): Promise<void> {
  if (autoBaselining) return;
  autoBaselining = true;
  try {
    const res = await d.readConfig();
    if (!res.partial && device === d) store.setDeviceConfig(res.config); // silent: no toast, no replace
  } catch { /* silent — the explicit Read path is where errors get reported */ }
  finally { autoBaselining = false; }
}

async function useSimulator(): Promise<void> {
  resetSimNoticeDismissal(); // switching INTO the sim from hardware is when the explanation earns its place again
  device.stop();
  device = new SimulatorDevice({ latency: 3 });
  wireDevice(device);
  await device.start();
  store.toast('info', 'Switched to the simulator', 'A simulated Portail with its own memory and 8 presets. Nothing reaches hardware.');
  rerender();
}

async function useHardware(): Promise<void> {
  const ok = await maybeShowFirstRunDisclaimer();
  if (!ok) return;
  device.stop();
  device = new WebMidiDevice();
  wireDevice(device);
  await device.start();
  rerender();
}

/* ------------------------------------------------------------------ sync actions */

// "Where are these bytes going right now" names the transport; copy about the Portail as a device
// stays "module" (Tina's heuristic — see connection.ts).
const target = () => (device.kind === 'simulator' ? 'simulator' : 'module');

const syncActions: SyncActions = {
  async readFromModule() {
    if (store.syncStatus().kind === 'modified') {
      const choice = await confirmDialog({
        title: `Replace editor contents with the ${target()}?`,
        body: `The editor has changes that are not on the ${target()}. Reading replaces them with the ${target()}’s configuration. You can undo it afterwards.`,
        confirmLabel: 'Read anyway',
        danger: true,
      });
      if (!choice) return;
    }
    try {
      const res = await device.readConfig();
      if (res.partial) {
        store.toast('warn', `Partial read — not all of the ${target()} answered`,
          `Missing: ${res.missing.slice(0, 6).join(', ')}${res.missing.length > 6 ? '…' : ''}. Not taken as the baseline; try again.`);
        return;
      }
      store.replaceConfig(res.config, `read from ${target()}`);
      store.setDeviceConfig(res.config);
      store.toast('success', `Read from ${target()}`, `The editor now matches the ${target()}.`);
    } catch (err) {
      store.toast('error', 'Read failed', String(err instanceof Error ? err.message : err));
    }
  },

  async sendToModule() {
    try {
      await device.writeConfig(store.get().config);
      const res = await device.readConfig();
      if (res.partial) {
        store.toast('warn', 'Sent, but read-back was partial', 'Could not verify every line. Try again.');
        return;
      }
      store.setDeviceConfig(res.config);
      let st = store.syncStatus();
      // The module can commit a line-write to its readable config slightly AFTER it accepts the write,
      // so an immediate read-back sometimes shows pre-write values for a few lines — a false "changed"
      // that a later manual read disproves. Confirm any apparent difference with one settled re-read
      // before reporting it: a transient race clears here, a real clamp/rejection persists.
      if (st.kind !== 'in-sync') {
        await new Promise((r) => setTimeout(r, VERIFY_SETTLE_MS));
        const res2 = await device.readConfig();
        if (!res2.partial) { store.setDeviceConfig(res2.config); st = store.syncStatus(); }
      }
      if (st.kind === 'in-sync') store.toast('success', 'Sent and verified', `The ${target()} now matches the editor.`);
      else {
        // Survived a settled re-read, so the difference is real — the module changed a value we sent.
        // Name the outputs so the user can act, not "some lines".
        const names = store.diffAgainstDevice()?.lines.map((l) => l.label).join(', ') ?? '';
        store.toast('warn', `Sent, but the ${target()} changed some values`,
          names
            ? `${names} read back different from what was sent — the ${target()} may have clamped or rejected a value. Check those outputs.`
            : 'The read-back differs from what was sent. Check the flagged outputs.');
      }
    } catch (err) {
      store.toast('error', 'Send failed', String(err instanceof Error ? err.message : err));
    }
  },

  async checkModule() {
    try {
      const res = await device.readConfig();
      if (res.partial) { store.toast('warn', 'Check incomplete', `The ${target()} did not fully answer. Try again.`); return; }
      const status = store.observeDeviceDrift(res.config);
      if (status.kind === 'conflict') {
        store.toast('warn', `The ${target()} changed, and so did the editor`, 'Both differ from the last sync — resolve before sending or reading.');
        await syncActions.resolveConflict();
      } else if (status.kind === 'device-ahead') {
        store.toast('warn', `The ${target()} changed under us`, 'Someone may have recalled a preset on the panel. Read to catch up.');
      } else {
        store.toast('success', 'Still matches', `The ${target()} agrees with the editor.`);
      }
    } catch (err) {
      store.toast('error', 'Check failed', String(err instanceof Error ? err.message : err));
    }
  },

  async resolveConflict() {
    const status = store.syncStatus();
    if (status.kind !== 'conflict') return;
    const choice = await conflictDialog();
    if (choice === 'export') {
      const { toFile, download, safeFilename } = await import('./state/files');
      const cfg = store.get().config;
      download(`${safeFilename(cfg.name)}.portail.json`, JSON.stringify(toFile(cfg), null, 2), 'application/json');
      // after exporting, ask again
      await syncActions.resolveConflict();
    } else if (choice === 'keep') {
      await syncActions.sendToModule();
    } else if (choice === 'take') {
      store.takeModuleVersion();
      store.toast('success', `Took the ${target()}’s version`, `The editor now matches the ${target()}. Undo with Ctrl/Cmd+Z.`);
    }
    // 'cancel' → leave everything as-is
  },

  async reconnect() { await device.probe(); rerender(); },
  async selectPort(id: string) { await device.selectPort(id); rerender(); },
  useSimulator: () => void useSimulator(),
  useHardware: () => void useHardware(),
};

const presetActions: PresetActions = {
  async loadSlot(slot: number) {
    // Warn only when the editor actually holds a patch (any output in use, or a mod-matrix row) AND it
    // isn't provably in sync with the module. A fresh/empty editor reads as 'modified' against the
    // simulator's own config but has nothing to lose, so it gets the plain dialog, not the scary one.
    // 'in-sync'/'device-ahead' are always safe to load over.
    const cfg = store.get().config;
    const hasContent =
      cfg.lines.slice(0, 16).some((l) => l.mode !== 0) ||
      cfg.modMatrix.some((m) => m.statusHigh !== 0 || m.targetParam !== 0);
    const k = store.syncStatus().kind;
    const mayLoseEdits = hasContent && k !== 'in-sync' && k !== 'device-ahead';
    if (!(await confirmLoad(slot, mayLoseEdits))) return;
    try {
      await device.loadPreset(slot);
      const res = await device.readConfig();
      store.replaceConfig(res.config, `load preset ${slot + 1}`);
      store.setDeviceConfig(res.config);
      store.setCurrentPreset(slot);
      store.toast('success', `Loaded preset ${slot + 1}`);
    } catch (err) {
      store.toast('error', 'Load failed', String(err instanceof Error ? err.message : err));
    }
  },

  async saveSlot(slot: number) {
    // OQ-1 gate: the first preset WRITE requires a one-time hardware confirmation of numbering.
    const { ensurePresetWriteAllowed } = await import('./state/preset-gate');
    const allowed = await ensurePresetWriteAllowed(device);
    if (!allowed) return;

    const name = store.get().presetMeta[slot]?.name ?? `Preset ${slot + 1}`;
    if (!(await confirmSave(slot, name))) return;
    try {
      const result = await device.savePreset(slot, store.get().config);
      store.setCurrentPreset(slot);
      if (result.ok) {
        store.setDeviceConfig(store.get().config);
        store.toast('success', `Saved to preset ${slot + 1}`, 'Written and verified against a read-back.');
      } else {
        store.toast('warn', `Saved to preset ${slot + 1}, but verify found differences`,
          result.mismatches.slice(0, 6).join(', '));
      }
    } catch (err) {
      store.toast('error', 'Save failed', String(err instanceof Error ? err.message : err));
    }
  },

  async backupAll() {
    try {
      const original = await device.getCurrentPreset();
      for (let slot = 0; slot < 8; slot++) {
        await device.loadPreset(slot);
        const res = await device.readConfig();
        store.setPresetBackup(slot, res.config);
      }
      if (original !== null) await device.loadPreset(original);
      store.toast('success', 'Backed up all 8 slots', `Copies stored in this browser. The ${target()}’s original preset was restored.`);
    } catch (err) {
      store.toast('error', 'Backup failed', String(err instanceof Error ? err.message : err));
    }
  },
};

/* ------------------------------------------------------------------ render */

const scheduleConnbar = scheduler(() => {
  mountInto('connbar-mount', renderConnection(store, device, syncActions, progress));
});

const scheduleMonitor = scheduler(() => {
  const mount = document.getElementById('monitor-mount');
  if (mount) { clear(mount); mount.appendChild(renderMonitor(monitor, scheduleMonitor)); }
  const lit = monitor.isLit(performance.now());
  // Both the (hidden) in-panel LED and the one on the MIDI tab — the tab dot is what stays visible
  // when the Globals tab is showing.
  for (const id of ['activity-led', 'tab-activity-led']) {
    document.getElementById(id)?.classList.toggle('lit', lit);
  }
});

/** Switch the sidebar's MIDI-activity / Globals tabbed card. DOM is the state — the pane divs keep
 *  their hidden flag and the tabs their active class across content re-mounts. */
function switchSideTab(key: string): void {
  const root = document.getElementById('side-tabs');
  if (!root) return;
  for (const t of root.querySelectorAll<HTMLElement>('.tab')) {
    const on = t.dataset['tab'] === key;
    t.classList.toggle('is-active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  }
  for (const p of root.querySelectorAll<HTMLElement>('.tab-pane')) {
    p.hidden = p.dataset['tab'] !== key;
  }
}

// Preserve the focused control and scroll position across a re-mount (mountInto does clear+append,
// which otherwise drops focus, closes an open <select>, and can jump scroll on every value edit).
function withUiPreserved(fn: () => void): void {
  const activeId = (document.activeElement as HTMLElement | null)?.id || '';
  const mainCol = document.querySelector<HTMLElement>('#view-editor .main-col');
  const scroll = mainCol?.scrollTop ?? 0;
  fn();
  if (activeId) document.getElementById(activeId)?.focus({ preventScroll: true });
  if (mainCol) mainCol.scrollTop = scroll;
}

const rerender = scheduler(() => {
  if (view === 'manual') return; // manual view manages its own DOM
  withUiPreserved(() => {
  mountInto('connbar-mount', renderConnection(store, device, syncActions, progress));
  mountInto('notices-mount', notices());
  mountInto('rack-mount', renderRack(store, { onHelp: openModeHelp }));
  mountInto('presets-mount', renderPresets(store, device, presetActions));
  mountInto('globals-mount', renderGlobals(store));
  mountInto('modmatrix-mount', renderModMatrix(store, armedModRow, onArmModRow));
  mountInto('files-mount', renderFiles(store, device));
  mountInto('monitor-mount', renderMonitor(monitor, scheduleMonitor));
  mountInto('masthead-sync', null); // masthead updates its own bits below
  });
  renderToasts();
});

// Selection / FX-expand changes only affect these three panels, so re-mount just them. This is what
// stops clicking a slot or an FX chip from rebuilding all 11 panels — the cause of the focus loss,
// scroll jumps and dropdown resets (J1). Config edits still do a full rerender (scope 'all').
const rerenderEditRegion = scheduler(() => {
  if (view === 'manual') return;
  mountInto('rack-mount', renderRack(store, { onHelp: openModeHelp }));
});

function mountInto(id: string, node: HTMLElement | null): void {
  const mount = document.getElementById(id);
  if (!mount) return;
  clear(mount);
  if (node) mount.appendChild(node);
}

/**
 * The conflict resolve dialog (DESIGN §3.6, Conflict.dc.html). No default action (Enter does
 * nothing); always offers "Export my version first". No auto-merge.
 */
function conflictDialog(): Promise<'keep' | 'take' | 'export' | 'cancel'> {
  const { editor, device } = store.conflictChanges();
  const colList = (cls: string, items: string[]) =>
    el('div', { class: 'conflict-col' },
      ...items.length ? items.map((t) => el('div', { class: `conflict-item ${cls}` }, t))
                      : [el('div', { class: 'conflict-item muted' }, '(none)')]);

  return new Promise((resolve) => {
    const dialog = el('dialog', { class: 'confirm conflict-dialog' });
    const done = (v: 'keep' | 'take' | 'export' | 'cancel') => { dialog.close(); dialog.remove(); resolve(v); };
    dialog.appendChild(
      el('form', { method: 'dialog', class: 'confirm-inner' },
        el('h2', {}, 'Both changed — resolve the conflict'),
        el('p', { class: 'small muted' }, `The editor and the ${target()} both changed since you last synced. Nothing is merged automatically — choose which side wins.`),
        el('div', { class: 'conflict-grid' },
          el('div', {}, el('div', { class: 'conflict-head' }, 'EDITOR CHANGED'), colList('editor', editor)),
          el('div', {}, el('div', { class: 'conflict-head' }, 'MODULE CHANGED'), colList('device', device)),
        ),
        el('div', { class: 'row', style: 'margin-top:.6rem' },
          el('button', { type: 'button', class: 'btn btn-ghost', style: 'color:var(--accent);font-weight:600', onclick: () => done('export') }, 'Export my version first'),
        ),
        el('div', { class: 'conflict-actions' },
          el('button', { type: 'button', class: 'btn', onclick: () => done('cancel') }, 'Cancel'),
          el('button', { type: 'button', class: 'btn', onclick: () => done('take') }, `Take the ${target()}’s `, el('span', { class: 'mono small muted' }, '← read')),
          el('button', { type: 'button', class: 'btn btn-danger', onclick: () => done('keep') }, 'Keep my edits ', el('span', { class: 'mono small' }, 'send →')),
        ),
        el('p', { class: 'small muted', style: 'margin-top:.5rem' }, `No default — Enter does nothing here. “Take the ${target()}’s” goes through the undo stack.`),
      ),
    );
    // No default: Escape resolves to 'cancel'; Enter does nothing (all buttons are type=button).
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); done('cancel'); });
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

function notices(): HTMLElement {
  const wrap = el('div', { class: 'stack' });
  const browser = renderBrowserNotice(device, () => void useSimulator());
  if (browser) wrap.appendChild(browser);
  const sim = renderSimulatorNotice(device, device.kind === 'simulator'
    ? () => { (device as unknown as { simulatePanelPresetChange: () => void }).simulatePanelPresetChange(); store.toast('info', 'Module changed on the “panel”', 'Now press “Check simulator” to see the editor notice.'); }
    : undefined,
    () => rerender());
  if (sim) wrap.appendChild(sim);
  return wrap;
}

function onArmModRow(row: number | null): void {
  armedModRow = row;
  void device.setLearnMode(row !== null);
  rerender();
}

function openModeHelp(family: string, key: string): void {
  setView('manual'); // through setView so the masthead nav reflects it (not a bare view = ...)
  showManual({ mode: { family, key } });
}

function renderToasts(): void {
  const mount = document.getElementById('toasts-mount');
  if (!mount) return;
  clear(mount);
  for (const t of store.getToasts()) {
    mount.appendChild(
      el('div', { class: `toast toast-${t.level}`, role: 'status' },
        el('div', { class: 'toast-body' },
          el('div', { class: 'toast-msg' }, t.message),
          t.detail ? el('div', { class: 'toast-detail' }, t.detail) : null,
        ),
        el('button', { class: 'btn btn-ghost btn-sm', 'aria-label': 'Dismiss', onclick: () => store.dismissToast(t.id) }, '✕'),
      ),
    );
  }
}

/* ------------------------------------------------------------------ view shell */

function renderView(): void {
  const editor = document.getElementById('view-editor');
  const manual = document.getElementById('view-manual');
  const hardware = document.getElementById('view-hardware');
  const tuning = document.getElementById('view-tuning');
  if (!editor || !manual || !hardware || !tuning) return;
  editor.hidden = view !== 'editor';
  manual.hidden = view !== 'manual';
  hardware.hidden = view !== 'hardware';
  tuning.hidden = view !== 'tuning';
  if (view === 'editor') rerender();
}

function setView(v: 'editor' | 'manual' | 'hardware' | 'tuning'): void {
  view = v;
  renderView();
  masthead?.setActive(v); // the masthead owns the active-state markup; see MastheadHandle
}

function buildShell(root: HTMLElement): void {
  clear(root);
  root.removeAttribute('aria-busy');

  masthead = mountMasthead(root, {
    onView: setView,
    getView: () => view,
  });

  root.appendChild(el('div', { id: 'connbar-mount' }));

  const editor = el('main', { id: 'view-editor' },
    el('a', { id: 'main' }),
    el('div', { id: 'notices-mount', class: 'main-col', style: 'padding-bottom:0' }),
    el('div', { class: 'workspace' },
      el('div', { class: 'main-col' },
        el('div', { id: 'rack-mount' }),
        el('div', { id: 'modmatrix-mount' }),
        el('div', { id: 'files-mount' }),
      ),
      el('div', { class: 'side-col' },
        el('div', { id: 'presets-mount' }),
        // MIDI activity + Globals share one tabbed card. The live activity dot rides on the MIDI tab
        // so incoming MIDI is noticeable even when Globals is showing.
        el('section', { class: 'panel side-tabs', id: 'side-tabs' },
          el('div', { class: 'tabbar', role: 'tablist' },
            el('button', {
              type: 'button', class: 'tab is-active', role: 'tab', 'aria-selected': 'true',
              'data-tab': 'midi', onclick: () => switchSideTab('midi'),
            }, 'MIDI activity', el('span', { class: 'activity-led', id: 'tab-activity-led' })),
            el('button', {
              type: 'button', class: 'tab', role: 'tab', 'aria-selected': 'false',
              'data-tab': 'globals', onclick: () => switchSideTab('globals'),
            }, 'Globals'),
          ),
          el('div', { class: 'tab-pane', id: 'monitor-mount', 'data-tab': 'midi' }),
          el('div', { class: 'tab-pane', id: 'globals-mount', 'data-tab': 'globals', hidden: true }),
        ),
      ),
    ),
  );
  root.appendChild(editor);

  // The Module reference (LED colours + the two buttons) is hardware reference, not part of the
  // editing surface — it lived in the side column and made it very long. It's a tab now.
  const hardware = el('main', { id: 'view-hardware', hidden: true },
    el('div', { class: 'main-col' }, renderLedGuide()));
  root.appendChild(hardware);

  const tuning = el('main', { id: 'view-tuning', hidden: true },
    el('div', { class: 'main-col' }));
  root.appendChild(tuning);
  mountTuning(tuning.firstElementChild as HTMLElement, {
    send: (slot, cents) => device.writeMicrotonalTable(slot, cents),
    isConnected: () => device.getState().status === 'connected',
    deviceLabel: () => device.getState().status === 'connected' ? (device.kind === 'simulator' ? 'simulator' : 'module') : 'not connected',
    toast: (k, title, body) => store.toast(k, title, body),
  });

  const manual = el('main', { id: 'view-manual', hidden: true });
  root.appendChild(manual);
  mountManual(manual, { onBackToEditor: () => setView('editor') });

  root.appendChild(el('div', { id: 'toasts-mount', class: 'toasts', 'aria-live': 'polite' }));
  root.appendChild(
    el('footer', { class: 'colophon' },
      el('span', {}, 'Unofficial editor for the eowave Portail. Not affiliated with eowave.'),
      el('span', {}, 'MIT licensed.'),
      el('span', {}, 'by ', el('a', { href: 'https://www.spongefile.com', target: '_blank', rel: 'noopener noreferrer' }, 'spongefile')),
      el('span', { class: 'mono' }, `spec ${store.get().config.configVersion}`),
    ),
  );
}

/* ------------------------------------------------------------------ boot */

function initKeyboard(): void {
  document.addEventListener('keydown', (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); store.undo(); }
    else if (mod && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); store.redo(); }
  });
}

async function boot(): Promise<void> {
  const root = document.getElementById('app');
  if (!root) return;
  buildShell(root);
  store.subscribe((scope) => (scope === 'edit-region' ? rerenderEditRegion() : rerender()));
  document.addEventListener('portail:navigate', (e) => setView((e as CustomEvent).detail));
  // The rack lays the band differently in one vs two columns (see renderRack), so re-render when the
  // layout crosses that breakpoint — otherwise a resize/rotation leaves the band placed for the old
  // column count and the open card overlaps its neighbour.
  if (typeof matchMedia === 'function') matchMedia('(max-width: 720px)').addEventListener('change', () => rerender());
  wireDevice(device);
  initKeyboard();
  await device.start(); // simulator — no prompt
  rerender();

  // Keep the "verified N ago" pill honest as time passes (cheap — re-renders the bar only).
  setInterval(() => {
    const st = store.syncStatus();
    if (st.kind === 'in-sync') mountInto('connbar-mount', renderConnection(store, device, syncActions, progress));
  }, 30000);

  // Hint about hardware availability without forcing anything.
  if (!webMidiAvailable()) {
    store.toast('info', 'This browser can’t use Web MIDI',
      'Editing, import and export work fully. Use Chrome or Edge to talk to a module. Working against the simulator for now.');
  }
}

void boot();
