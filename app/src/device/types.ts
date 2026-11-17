/** The transport boundary. Real SysEx and the simulator both live behind this. */

import type { PortailConfig } from '../model/types';

export type ConnectionState =
  /** WebMIDI not implemented by this browser. Terminal — nothing the user can do in-app. */
  | { status: 'unsupported'; reason: string }
  /** Waiting for the user to answer the browser's MIDI permission prompt. */
  | { status: 'requesting' }
  /** The user (or policy) refused MIDI access. */
  | { status: 'denied'; reason: string }
  /** MIDI is available; no Portail identified on any port yet. */
  | { status: 'searching'; ports: PortInfo[] }
  /** A port is selected and the module answered our probe. */
  | { status: 'connected'; port: PortInfo; firmware: string | null }
  /** A port is selected but the module stopped answering. */
  | { status: 'lost'; port: PortInfo; since: number }
  /** Something threw. */
  | { status: 'error'; reason: string };

export interface PortInfo {
  id: string;
  name: string;
  manufacturer: string | null;
  /** Set when this port's input has answered a Portail probe. */
  confirmed: boolean;
}

/** A decoded inbound MIDI event, for the activity monitor. */
export interface MidiActivity {
  at: number;
  direction: 'in' | 'out';
  /** 'note-on' | 'cc' | 'clock' | 'sysex' | … */
  kind: string;
  channel: number | null;
  summary: string;
  data: number[];
}

export interface TransferProgress {
  phase: 'idle' | 'sending' | 'reading';
  done: number;
  total: number;
  label: string;
}

/** Result of a full read; `partial` means some lines never answered. */
export interface ReadResult {
  config: PortailConfig;
  partial: boolean;
  missing: string[];
}

/** Result of the recall→resend→save→verify preset-write sequence. */
export interface PresetWriteResult {
  ok: boolean;
  slot: number;
  /** Lines/sections that did not read back equal to what we sent. Empty when ok. */
  mismatches: string[];
  /** True if the read-back step itself was partial (some lines never answered). */
  partial: boolean;
}

export interface PortailDeviceEvents {
  connection: (state: ConnectionState) => void;
  activity: (event: MidiActivity) => void;
  progress: (p: TransferProgress) => void;
  /** The module reported which preset slot is currently loaded. */
  preset: (slot: number) => void;
  /** MIDI-learn captured a message while a mod row was armed. */
  learn: (msg: { statusHigh: number; channel: number; number: number }) => void;
}

export interface PortailDevice {
  readonly kind: 'webmidi' | 'simulator';

  /** Begin: request MIDI access, enumerate ports, probe for a Portail. */
  start(): Promise<void>;
  stop(): void;

  getState(): ConnectionState;
  listPorts(): PortInfo[];
  /** Explicitly bind to a port (used when auto-detection can't decide). */
  selectPort(id: string): Promise<void>;

  /** Re-probe the selected port for version + presence. */
  probe(): Promise<void>;

  /** Read the entire config from the module. Never mutates editor state itself. */
  readConfig(): Promise<ReadResult>;
  /** Write an entire config to the module's working memory. Does NOT burn it to a preset. */
  writeConfig(config: PortailConfig): Promise<void>;
  /** Write a single line — used for live tweaking once the user has opted in. */
  writeLine(line: number, config: PortailConfig): Promise<void>;

  /**
   * Save `config` to preset `slot`. Because the firmware's save (0x07) always targets the ACTIVE
   * preset and there is no "save to slot N" opcode (spec/protocol.md §0.5), this performs the full
   * safe sequence: recall `slot` → resend the whole config from our own copy → 0x07 → read back and
   * compare. Destructive on the device; returns what actually landed.
   *
   * NOTE: callers MUST clear the OQ-1 preset-write gate before invoking this — see state/preset-gate.
   */
  savePreset(slot: number, config: PortailConfig): Promise<PresetWriteResult>;
  /** Tell the module to load a preset into working memory. Destructive on the device. */
  loadPreset(slot: number): Promise<void>;

  /** Send one microtonal tuning table (12 cent values) to slot 0-7. Throws on a bad slot. */
  writeMicrotonalTable(slot: number, cents: readonly number[]): Promise<void>;
  getCurrentPreset(): Promise<number | null>;

  /** Arm or disarm the module's MIDI-learn. */
  setLearnMode(on: boolean): Promise<void>;

  /** Raw escape hatch — send arbitrary SysEx, used by the .syx import path. */
  sendRaw(messages: Uint8Array[]): Promise<void>;

  on<K extends keyof PortailDeviceEvents>(event: K, fn: PortailDeviceEvents[K]): () => void;
}
