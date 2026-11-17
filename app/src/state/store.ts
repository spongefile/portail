/**
 * Editor state.
 *
 * Two ideas do the heavy lifting, both absent from the official editor:
 *
 *  1. `config` (what you are editing) and `deviceConfig` (our last known picture of the module)
 *     are separate values. Nothing is ever written to the module as a side effect of editing.
 *     `syncStatus` compares them so the UI can always answer "does the module match this?".
 *
 *  2. Every mutation goes through `commit()`, which pushes onto an undo stack and persists.
 *     Reloading the page restores exactly where you were.
 */

import type { Line, ModRow, PortailConfig } from '../model/types';
import { CONFIG_VERSION } from '../model/types';
import {
  cloneConfig, configsEqual, diffConfigs, emptyConfig, familyOfLine, lineWithDefaults,
  model, writeGlobal, globalById, modeByIndex, lineLabel,
} from '../model/model';
import { insertFxForOutput, removeFx, moveFxInChain, reorderFxInChain, fxTargetsCv, chainForOutput, outputModeWakesFx, fxWakeModeNames } from '../model/fx';

const STORAGE_KEY = 'portail-editor:v1';
const MAX_HISTORY = 200;

export type SyncStatus =
  /** Connected, but never read this session, so we cannot know. */
  | { kind: 'unknown' }
  /** editor == baseline == device. Carries the verify time so the pill shows the age. */
  | { kind: 'in-sync'; verifiedAt: number | null }
  /** editor != baseline, device == baseline. The editor has unsent changes. */
  | { kind: 'modified'; changedLines: number; globals: boolean; modMatrix: boolean }
  /** device != baseline, editor == baseline. The module changed under us. */
  | { kind: 'device-ahead'; changedLines: number }
  /** device != baseline AND editor != baseline. Both changed — needs resolution. */
  | { kind: 'conflict'; editorChanges: number; deviceChanges: number };

export interface Toast {
  id: number;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
  detail?: string;
}

export interface PresetSlotMeta {
  /** Editor-side name for a slot. The module itself stores no slot names. */
  name: string;
  /** Last time we backed this slot up, if ever. */
  backedUpAt: number | null;
}

export interface State {
  config: PortailConfig;
  /** Our last known picture of the module's working memory. null until a read succeeds. */
  deviceConfig: PortailConfig | null;
  /** Which slot the module says is loaded. */
  currentPreset: number | null;
  presetMeta: PresetSlotMeta[];
  /** Locally stored backups of each preset slot, from "Back up all slots". */
  presetBackups: (PortailConfig | null)[];
  selectedLine: number | null;
  /** Which FX chip in the selected output's chain is expanded for inline editing (fx line index), or null. Transient UI, not persisted. */
  expandedFx: number | null;
  /** Whether the MIDI-source node's params are open (the output's mode params). Transient. */
  sourceOpen: boolean;
  /** When we last had a confirmed full read of the module (ms epoch), for the honest sync pill. */
  verifiedAt: number | null;
  /**
   * The module's contents as seen by the most recent re-read, WHEN they differ from baseline
   * (deviceConfig). Non-null means we have observed the module drift from what we last reconciled —
   * the trigger for the device-ahead / conflict states. Cleared on reconcile.
   */
  driftDevice: PortailConfig | null;
}

interface Persisted {
  version: number;
  config: PortailConfig;
  presetMeta: PresetSlotMeta[];
  presetBackups: (PortailConfig | null)[];
  selectedLine: number | null;
}

export type RenderScope = 'all' | 'edit-region';
type Listener = (scope: RenderScope) => void;

export class Store {
  private state: State;
  private undoStack: PortailConfig[] = [];
  private redoStack: PortailConfig[] = [];
  private listeners = new Set<Listener>();
  private toasts: Toast[] = [];
  private toastSeq = 0;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.state = this.load();
  }

  /* ------------------------------------------------------------- subscription */

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  private notify(scope: RenderScope = 'all'): void {
    for (const fn of [...this.listeners]) {
      try { fn(scope); } catch (err) { console.error('store listener threw', err); }
    }
  }

  get(): Readonly<State> { return this.state; }
  getToasts(): readonly Toast[] { return this.toasts; }

  /* -------------------------------------------------------------- persistence */

  private load(): State {
    const fresh: State = {
      config: emptyConfig('Untitled'),
      deviceConfig: null,
      currentPreset: null,
      presetMeta: Array.from({ length: model.device.preset_slots }, (_, i) => ({
        name: `Preset ${i + 1}`, backedUpAt: null,
      })),
      presetBackups: Array.from({ length: model.device.preset_slots }, () => null),
      selectedLine: 0,
      expandedFx: null,
      sourceOpen: true,
      verifiedAt: null,
      driftDevice: null,
    };

    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return fresh;
      const p = JSON.parse(raw) as Persisted;
      if (p.version !== CONFIG_VERSION) return fresh;
      return {
        ...fresh,
        config: p.config ?? fresh.config,
        presetMeta: p.presetMeta ?? fresh.presetMeta,
        presetBackups: p.presetBackups ?? fresh.presetBackups,
        selectedLine: p.selectedLine ?? 0,
      };
    } catch (err) {
      console.warn('could not restore saved state; starting fresh', err);
      return fresh;
    }
  }

  /** Debounced so dragging a slider doesn't hammer localStorage. */
  private persist(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      const p: Persisted = {
        version: CONFIG_VERSION,
        config: this.state.config,
        presetMeta: this.state.presetMeta,
        presetBackups: this.state.presetBackups,
        selectedLine: this.state.selectedLine,
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
      } catch (err) {
        this.toast('warn', 'Could not save your work locally', String(err));
      }
    }, 250);
  }

  /* ------------------------------------------------------------------ history */

  /** Applies a change to the config, recording it for undo. */
  commit(label: string, mutate: (draft: PortailConfig) => void): void {
    const before = cloneConfig(this.state.config);
    const draft = cloneConfig(this.state.config);
    mutate(draft);
    if (configsEqual(before, draft) && before.name === draft.name) return; // no-op

    this.undoStack.push(before);
    if (this.undoStack.length > MAX_HISTORY) this.undoStack.shift();
    this.redoStack = [];
    this.state.config = draft;
    this.lastLabel = label;
    this.persist();
    this.notify();
  }

  private lastLabel = '';
  get lastChange(): string { return this.lastLabel; }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }

  undo(): void {
    const prev = this.undoStack.pop();
    if (!prev) return;
    this.redoStack.push(cloneConfig(this.state.config));
    this.state.config = prev;
    this.persist();
    this.notify();
    this.validateExpandedFx();
  }

  redo(): void {
    const next = this.redoStack.pop();
    if (!next) return;
    this.undoStack.push(cloneConfig(this.state.config));
    this.state.config = next;
    this.persist();
    this.notify();
    this.validateExpandedFx();
  }

  /* -------------------------------------------------------------- config edits */

  setLineMode(line: number, modeIndex: number): void {
    const family = familyOfLine(line);
    const fresh = lineWithDefaults(family, modeIndex);
    // An FX keeps the output it targets when you change its effect type (byte 1 = target); otherwise
    // lineWithDefaults would reset it to 0 and move the FX to output 1 (reviewer finding #1).
    if (family === 'fx') fresh.bytes[1] = this.state.config.lines[line]?.bytes[1] ?? 0;
    const affected = this.state.config.modMatrix.filter((m) => m.targetLine === line && m.targetParam > 0).length;
    // FX targeting an output go INERT when its mode stops producing their input signal. Match the
    // mod-row posture: keep them, don't rewrite, tell the user once (docs/fx/index.md:33).
    const isOutput = line < 16;
    const fxOnLine = isOutput ? chainForOutput(this.state.config, line).length : 0;
    const wasWaking = isOutput && outputModeWakesFx(this.state.config, line);

    this.commit(`set ${line} mode`, (c) => {
      c.lines[line] = fresh;
      // Mod rows pointing at this line now reference parameters that no longer exist. The official
      // editor deletes them silently (AUDIT §2.5); we neutralise the target but keep the MIDI
      // assignment so the user can repoint it, and we tell them.
      for (const m of c.modMatrix) {
        if (m.targetLine === line) { m.targetParam = 0; m.valueMin = 0; m.valueMax = 0; }
      }
    });

    if (affected > 0) {
      this.toast(
        'warn',
        `${affected} modulation row${affected === 1 ? '' : 's'} pointed at this output`,
        'Their MIDI assignments were kept but their target parameter was cleared, because the ' +
        'new mode has different parameters. Undo restores the previous mode and its rows.',
      );
    }

    if (fxOnLine > 0 && wasWaking && !outputModeWakesFx(this.state.config, line)) {
      const targetsCv = line < 8;
      const wake = fxWakeModeNames(targetsCv);
      const orList = wake.length <= 1 ? wake.join('') : `${wake.slice(0, -1).join(', ')} or ${wake[wake.length - 1]}`;
      const many = fxOnLine !== 1;
      this.toast(
        'warn',
        `${fxOnLine} FX on ${lineLabel(line)} ${many ? 'are' : 'is'} now inert`,
        `${many ? 'They process' : 'It processes'} ${targetsCv ? 'note' : 'gate'} data, which this mode ` +
        `doesn't produce, so ${many ? 'they do' : 'it does'} nothing. Kept in the chain (still using ` +
        `${many ? 'their slots' : 'a slot'}) — set this output to ${orList} to reactivate. Undo restores the previous mode.`,
      );
    }
  }

  setLineByte(line: number, byteIndex: number, value: number): void {
    this.commit(`set line ${line} byte ${byteIndex}`, (c) => {
      const l = c.lines[line]!;
      const bytes = l.bytes.slice();
      bytes[byteIndex] = value;
      c.lines[line] = { mode: l.mode, bytes };
    });
  }

  setLine(line: number, value: Line): void {
    this.commit(`replace line ${line}`, (c) => { c.lines[line] = structuredClone(value); });
  }

  setGlobal(id: string, value: number): void {
    const def = globalById(id);
    if (!def) return;
    this.commit(`set global ${id}`, (c) => { c.globals = writeGlobal(c.globals, def, value); });
  }

  setModRow(row: number, value: Partial<ModRow>): void {
    this.commit(`set mod row ${row}`, (c) => {
      c.modMatrix[row] = { ...c.modMatrix[row]!, ...value };
    });
  }

  clearModRow(row: number): void {
    this.commit(`clear mod row ${row}`, (c) => {
      c.modMatrix[row] = {
        statusHigh: 0, channel: 0, number: 0, targetLine: 127, targetParam: 0, valueMin: 0, valueMax: 0,
      };
    });
  }

  /* ------------------------------------------------------------------ FX chain */

  /** Append an FX to an output's chain (claims a free slot). Returns the new FX line, or null when full. */
  insertFx(outputLine: number, modeIndex?: number): number | null {
    let claimed: number | null = null;
    this.commit('insert FX', (c) => { claimed = insertFxForOutput(c, outputLine, modeIndex); });
    if (claimed === null) {
      this.toast('warn', 'All 8 FX slots are in use', 'Remove an effect from a chain to free a slot.');
    }
    return claimed;
  }

  removeFxSlot(fxLine: number): void {
    this.commit('remove FX', (c) => { removeFx(c, fxLine); });
    this.validateExpandedFx();
  }

  /** Drop expandedFx if it no longer points at a live FX (after remove/undo/redo). */
  private validateExpandedFx(): void {
    const x = this.state.expandedFx;
    if (x === null) return;
    const mode = modeByIndex('fx', this.state.config.lines[x]?.mode ?? 0);
    if (!mode || mode.key === 'off') { this.state.expandedFx = null; this.notify('edit-region'); }
  }

  moveFx(fxLine: number, dir: -1 | 1): void {
    let landed: number | null = null;
    this.commit('reorder FX', (c) => { landed = moveFxInChain(c, fxLine, dir); });
    this.followExpanded(fxLine, landed);
  }

  reorderFx(fxLine: number, newIndex: number): void {
    let landed: number | null = null;
    this.commit('reorder FX', (c) => { landed = reorderFxInChain(c, fxLine, newIndex); });
    this.followExpanded(fxLine, landed);
  }

  /** After a reorder swaps line contents between slots, keep the open editor on the SAME FX. */
  private followExpanded(movedFrom: number, landedAt: number | null): void {
    if (landedAt !== null && landedAt !== movedFrom && this.state.expandedFx === movedFrom) {
      this.state.expandedFx = landedAt;
      this.notify('edit-region');
    }
  }

  /** FIX 3 — retarget an FX to a different output, then follow it there with its editor open. */
  retargetFx(fxLine: number, newTargetIndex: number): void {
    const cv = fxTargetsCv(this.state.config.lines[fxLine]?.mode ?? 0);
    const newOutput = cv ? newTargetIndex : newTargetIndex + 8;
    const name = modeByIndex('fx', this.state.config.lines[fxLine]?.mode ?? 0)?.display ?? 'FX';
    this.setLineByte(fxLine, 1, newTargetIndex);   // move it
    this.setSelectedLine(newOutput);               // follow (clears expandedFx)...
    this.state.expandedFx = fxLine;                // ...then re-open its editor on the new output
    this.notify('edit-region');
    this.toast('info', `Moved ${name} → ${lineLabel(newOutput)}`);
  }

  setConfigName(name: string): void {
    this.commit('rename config', (c) => { c.name = name; });
  }

  /** Wholesale replacement — import, or a read from the module. */
  replaceConfig(config: PortailConfig, label: string): void {
    this.commit(label, (c) => {
      c.configVersion = CONFIG_VERSION;
      c.name = config.name;
      c.lines = structuredClone(config.lines);
      c.globals = config.globals.slice();
      c.modMatrix = structuredClone(config.modMatrix);
    });
  }

  /* ----------------------------------------------------------------- sync view */

  /**
   * Reconciles: records the module's contents as the new baseline, stamps the verify time, and
   * clears any observed drift. Call this whenever editor and module have been brought into agreement
   * (a full read, or a verified send).
   */
  setDeviceConfig(config: PortailConfig | null): void {
    this.state.deviceConfig = config ? cloneConfig(config) : null;
    this.state.verifiedAt = config ? Date.now() : null;
    this.state.driftDevice = null;
    this.notify();
  }

  verifiedAt(): number | null { return this.state.verifiedAt; }

  /**
   * Compare a fresh device read against the baseline WITHOUT reconciling. If it differs, record the
   * drift (→ device-ahead or conflict). If it matches, refresh the verify time (the module still
   * agrees). Returns the resulting sync status. This is how device-ahead / conflict are DISCOVERED —
   * only ever by an explicit re-read, never speculatively (DESIGN §3.3).
   */
  observeDeviceDrift(deviceNow: PortailConfig): SyncStatus {
    const baseline = this.state.deviceConfig;
    if (!baseline) { this.setDeviceConfig(deviceNow); return this.syncStatus(); }
    const d = diffConfigs(baseline, deviceNow);
    if (d.lines.length === 0 && !d.globals && !d.modMatrix) {
      this.state.driftDevice = null;
      this.state.verifiedAt = Date.now();
    } else {
      this.state.driftDevice = cloneConfig(deviceNow);
    }
    this.notify();
    return this.syncStatus();
  }

  /** Human-readable change lists for the conflict dialog: what the editor changed vs the module. */
  conflictChanges(): { editor: string[]; device: string[] } {
    const baseline = this.state.deviceConfig;
    const dev = this.state.driftDevice;
    if (!baseline) return { editor: [], device: [] };
    const label = (d: ReturnType<typeof diffConfigs>): string[] => {
      const out = d.lines.map((l) => l.label);
      if (d.globals) out.push('globals');
      if (d.modMatrix) out.push('mod matrix');
      return out;
    };
    return {
      editor: label(diffConfigs(baseline, this.state.config)),
      device: dev ? label(diffConfigs(baseline, dev)) : [],
    };
  }

  /** Conflict resolution: take the module's version into the editor (undoable). */
  takeModuleVersion(): void {
    const dev = this.state.driftDevice ?? this.state.deviceConfig;
    if (!dev) return;
    this.replaceConfig(dev, 'take module version');
    this.setDeviceConfig(dev);
  }

  syncStatus(): SyncStatus {
    const { config, deviceConfig, driftDevice } = this.state;
    if (!deviceConfig) return { kind: 'unknown' };
    const editorDiff = diffConfigs(deviceConfig, config);
    const editorChanged = editorDiff.lines.length > 0 || editorDiff.globals || editorDiff.modMatrix;

    if (driftDevice) {
      const devDiff = diffConfigs(deviceConfig, driftDevice);
      const deviceChanges = devDiff.lines.length + (devDiff.globals ? 1 : 0) + (devDiff.modMatrix ? 1 : 0);
      if (editorChanged) {
        const editorChanges = editorDiff.lines.length + (editorDiff.globals ? 1 : 0) + (editorDiff.modMatrix ? 1 : 0);
        return { kind: 'conflict', editorChanges, deviceChanges };
      }
      return { kind: 'device-ahead', changedLines: devDiff.lines.length };
    }

    if (!editorChanged) return { kind: 'in-sync', verifiedAt: this.state.verifiedAt };
    return { kind: 'modified', changedLines: editorDiff.lines.length, globals: editorDiff.globals, modMatrix: editorDiff.modMatrix };
  }

  diffAgainstDevice() {
    const { config, deviceConfig } = this.state;
    return deviceConfig ? diffConfigs(deviceConfig, config) : null;
  }

  /* --------------------------------------------------------------------- misc */

  setSelectedLine(line: number | null): void {
    if (line !== this.state.selectedLine) { this.state.expandedFx = null; this.state.sourceOpen = true; } // new output: params open by default, FX editor closed
    this.state.selectedLine = line;
    this.persist();
    this.notify('edit-region');
  }

  /** Toggle which FX chip is expanded for inline editing under the chain strip (J2). */
  setExpandedFx(fxLine: number | null): void {
    this.state.expandedFx = this.state.expandedFx === fxLine ? null : fxLine;
    if (this.state.expandedFx !== null) this.state.sourceOpen = false; // one node open at a time
    this.notify('edit-region');
  }

  toggleSource(): void {
    this.state.sourceOpen = !this.state.sourceOpen;
    if (this.state.sourceOpen) this.state.expandedFx = null; // one node open at a time
    this.notify('edit-region');
  }

  setCurrentPreset(slot: number | null): void {
    this.state.currentPreset = slot;
    this.notify();
  }

  setPresetName(slot: number, name: string): void {
    this.state.presetMeta[slot] = { ...this.state.presetMeta[slot]!, name };
    this.persist();
    this.notify();
  }

  setPresetBackup(slot: number, config: PortailConfig | null): void {
    this.state.presetBackups[slot] = config ? cloneConfig(config) : null;
    this.state.presetMeta[slot] = {
      ...this.state.presetMeta[slot]!,
      backedUpAt: config ? Date.now() : null,
    };
    this.persist();
    this.notify();
  }

  /* ------------------------------------------------------------------- toasts */

  toast(level: Toast['level'], message: string, detail?: string): void {
    const t: Toast = { id: ++this.toastSeq, level, message, ...(detail ? { detail } : {}) };
    this.toasts = [...this.toasts, t];
    this.notify();
    if (level !== 'error') {
      setTimeout(() => this.dismissToast(t.id), level === 'warn' ? 9000 : 5000);
    }
  }

  dismissToast(id: number): void {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }
}

export const store = new Store();
