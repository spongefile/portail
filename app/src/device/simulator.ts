/**
 * A simulated Portail.
 *
 * This is not a stub that resolves promises — it keeps its own working memory and 8 preset slots,
 * parses the same SysEx we would send to hardware, and answers with the same SysEx the hardware is
 * believed to answer with. So every UI path (read, write, diff, preset save/load, MIDI learn,
 * partial-read handling) is genuinely exercised without a module attached.
 *
 * It also simulates the things that make the real transport risky, so we can test our handling:
 *   - a configurable per-message drop rate (the original editor's fire-and-hope sync, AUDIT §2.14)
 *   - realistic latency
 *   - no acknowledgement on writes, matching the real device
 */

import { Emitter } from './emitter';
import { describeMidi } from './midi-decode';
import {
  Cmd, decode, encodeLine, isPortailSysex, req, wireToMode, microtonalTable,
} from './sysex';
import type {
  ConnectionState, PortInfo, PortailDevice, PortailDeviceEvents, PresetWriteResult, ReadResult,
  TransferProgress,
} from './types';
import type { Family, PortailConfig } from '../model/types';
import { GLOBAL_BYTES, LINE_BYTES, LINE_COUNT } from '../model/types';
import { diffConfigs, emptyConfig, lineLabel, model } from '../model/model';

const SIM_PORT: PortInfo = {
  id: 'simulator',
  name: 'Portail Simulator',
  manufacturer: 'portail-editor (no hardware)',
  confirmed: true,
};

export interface SimulatorOptions {
  /** Fraction of inbound messages the simulated device silently ignores. 0 = perfect link. */
  dropRate?: number;
  /** Round-trip latency in ms. */
  latency?: number;
  firmware?: { major: number; minor: number; revision: string };
}

export class SimulatorDevice
  extends Emitter<PortailDeviceEvents>
  implements PortailDevice
{
  readonly kind = 'simulator' as const;

  private state: ConnectionState = { status: 'searching', ports: [SIM_PORT] };
  private working: PortailConfig = seedConfig();
  private tables: number[][] = Array.from({ length: 8 }, () => [0,100,200,300,400,500,600,700,800,900,1000,1100]);
  private presets: PortailConfig[];
  private currentPreset = 0;
  private learnArmed = false;
  private running = false;

  dropRate: number;
  latency: number;
  private firmware: { major: number; minor: number; revision: string };

  constructor(opts: SimulatorOptions = {}) {
    super();
    this.dropRate = opts.dropRate ?? 0;
    this.latency = opts.latency ?? 4;
    this.firmware = opts.firmware ?? { major: 0, minor: 9, revision: 's' };
    this.presets = Array.from({ length: model.device.preset_slots }, (_, i) =>
      i === 0 ? structuredClone(this.working) : emptyConfig(`Preset ${i + 1}`),
    );
  }

  /* ---------------------------------------------------------------- lifecycle */

  async start(): Promise<void> {
    this.running = true;
    this.setState({ status: 'searching', ports: [SIM_PORT] });
    await this.wait(this.latency);
    this.setState({
      status: 'connected',
      port: SIM_PORT,
      firmware: `${this.firmware.major}.${this.firmware.minor}${this.firmware.revision}`,
    });
  }

  stop(): void {
    this.running = false;
    this.clearListeners();
  }

  getState(): ConnectionState { return this.state; }
  listPorts(): PortInfo[] { return [SIM_PORT]; }

  async selectPort(): Promise<void> { await this.probe(); }

  async probe(): Promise<void> {
    const reply = await this.roundtrip(req.version());
    if (!reply) { this.setState({ status: 'lost', port: SIM_PORT, since: Date.now() }); return; }
    const r = decode(reply);
    this.setState({
      status: 'connected',
      port: SIM_PORT,
      firmware: r?.kind === 'version' ? r.text : null,
    });
  }

  /* ------------------------------------------------------------------- config */

  async readConfig(): Promise<ReadResult> {
    const config = emptyConfig(this.working.name);
    const missing: string[] = [];

    const total = LINE_COUNT + 1 + model.modMatrix.rows;
    let done = 0;
    const tick = (label: string) => {
      this.emit('progress', { phase: 'reading', done: ++done, total, label } as TransferProgress);
    };

    for (let i = 0; i < LINE_COUNT; i++) {
      const reply = await this.roundtrip(req.readLine(i));
      const r = reply ? decode(reply) : null;
      if (r?.kind === 'line') config.lines[r.line] = r.data;
      else missing.push(lineLabel(i));
      tick(lineLabel(i));
    }

    const gReply = await this.roundtrip(req.readGlobals());
    const g = gReply ? decode(gReply) : null;
    if (g?.kind === 'globals') config.globals = g.globals;
    else missing.push('globals');
    tick('globals');

    for (let r = 0; r < model.modMatrix.rows; r++) {
      const reply = await this.roundtrip(req.readMapping(r));
      const m = reply ? decode(reply) : null;
      if (m?.kind === 'mapping') config.modMatrix[m.row] = m.data;
      else missing.push(`mod row ${r + 1}`);
      tick(`mod row ${r + 1}`);
    }

    this.emit('progress', { phase: 'idle', done: total, total, label: '' });
    return { config, partial: missing.length > 0, missing };
  }

  async writeConfig(config: PortailConfig): Promise<void> {
    const total = LINE_COUNT + 1 + config.modMatrix.length;
    let done = 0;
    const tick = (label: string) =>
      this.emit('progress', { phase: 'sending', done: ++done, total, label } as TransferProgress);

    for (let i = 0; i < LINE_COUNT; i++) {
      await this.send(encodeLine(i, config.lines[i]!));
      tick(lineLabel(i));
    }
    await this.send(req.globals(config.globals));
    tick('globals');
    for (let r = 0; r < config.modMatrix.length; r++) {
      await this.send(req.mapping(r, config.modMatrix[r]!));
      tick(`mod row ${r + 1}`);
    }
    this.emit('progress', { phase: 'idle', done: total, total, label: '' });
  }

  async writeLine(line: number, config: PortailConfig): Promise<void> {
    await this.send(encodeLine(line, config.lines[line]!));
  }

  /* ------------------------------------------------------------------ presets */

  async savePreset(slot: number, config: PortailConfig): Promise<PresetWriteResult> {
    // Correct sequence (spec/protocol.md §0.5): recall the target so it becomes active, resend the
    // whole config from OUR copy (never trust what recall left in working memory), commit with 0x07,
    // then read back and compare.
    await this.send(req.loadPreset(slot));
    await this.writeConfig(config);
    await this.send(req.saveAll());
    const readback = await this.readConfig();
    const diff = diffConfigs(config, readback.config);
    const mismatches = [
      ...diff.lines.map((l) => l.label),
      ...(diff.globals ? ['globals'] : []),
      ...(diff.modMatrix ? ['mod matrix'] : []),
    ];
    return { ok: mismatches.length === 0 && !readback.partial, slot, mismatches, partial: readback.partial };
  }

  async writeMicrotonalTable(slot: number, cents: readonly number[]): Promise<void> {
    const msg = microtonalTable(slot, cents); // validates slot 0-7 + encodes (throws on bad input)
    await this.send(msg);
    this.tables[slot] = cents.slice(0, 12).map((c) => Math.max(0, Math.min(4383, Math.round(c))));
  }

  /** Test/demo: read back what was sent to a slot (the real module can't do this). */
  getTable(slot: number): number[] { return [...(this.tables[slot] ?? [])]; }

  async loadPreset(slot: number): Promise<void> {
    await this.send(req.loadPreset(slot));
  }

  async getCurrentPreset(): Promise<number | null> {
    const reply = await this.roundtrip(req.currentPreset());
    const r = reply ? decode(reply) : null;
    return r?.kind === 'preset' ? r.slot : null;
  }

  async setLearnMode(on: boolean): Promise<void> {
    await this.send(req.mapMode(on));
  }

  async sendRaw(messages: Uint8Array[]): Promise<void> {
    for (const m of messages) await this.send(m);
  }

  /* -------------------------------------------------- test/dev affordances --- */

  /** Injects an inbound MIDI message, so the activity monitor and MIDI learn can be demoed. */
  injectMidi(data: number[]): void {
    this.emit('activity', describeMidi(data, 'in'));
    const status = data[0] ?? 0;
    const type = status & 0xf0;
    if (this.learnArmed && (type === 0x90 || type === 0xb0) && (data[2] ?? 0) > 0) {
      this.learnArmed = false;
      this.emit('learn', {
        statusHigh: status >> 4,
        channel: status & 0x0f,
        number: data[1] ?? 0,
      });
    }
  }

  /** Replaces the simulated module's working memory — used to demo an out-of-sync device. */
  setWorkingMemory(config: PortailConfig): void {
    this.working = structuredClone(config);
  }

  /**
   * Simulates someone pressing the panel's ▲ button: recall the next preset into working memory.
   * This changes the module under the editor's feet, so the next re-read observes device-ahead /
   * conflict — the way the real hazard happens. Test/demo affordance only.
   */
  simulatePanelPresetChange(): void {
    const next = (this.currentPreset + 1) % this.presets.length;
    this.currentPreset = next;
    this.working = structuredClone(this.presets[next]!);
    this.emit('preset', next);
  }

  getWorkingMemory(): PortailConfig { return structuredClone(this.working); }

  /* ------------------------------------------------------------------ private */

  private setState(s: ConnectionState): void {
    this.state = s;
    this.emit('connection', s);
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  /** Emits activity for an outbound message, then applies it to the simulated firmware. */
  private async send(msg: Uint8Array): Promise<void> {
    if (!this.running) throw new Error('simulator is not started');
    this.emit('activity', describeMidi(msg, 'out'));
    await this.wait(this.latency);
    if (Math.random() < this.dropRate) return; // silently dropped, exactly like the real thing
    this.apply(msg);
  }

  /** Sends a message and returns the device's reply, or null if dropped. */
  private async roundtrip(msg: Uint8Array): Promise<Uint8Array | null> {
    if (!this.running) throw new Error('simulator is not started');
    this.emit('activity', describeMidi(msg, 'out'));
    await this.wait(this.latency);
    if (Math.random() < this.dropRate) return null;
    const reply = this.apply(msg);
    if (!reply) return null;
    await this.wait(this.latency);
    this.emit('activity', describeMidi(reply, 'in'));
    return reply;
  }

  /** The simulated firmware: interpret one inbound message, mutate state, maybe reply. */
  private apply(msg: Uint8Array): Uint8Array | null {
    if (!isPortailSysex(msg)) return null;
    const cmd = msg[3]!;
    const p = Array.from(msg.slice(4, -1));
    const f = (c: number, payload: number[]) =>
      Uint8Array.from([0xf0, 0x06, 0x29, c, ...payload, 0xf7]);

    switch (cmd) {
      case Cmd.READ_CV:   return this.replyLine('cv', p[0] ?? 0, Cmd.READ_CV);
      case Cmd.READ_GATE: return this.replyLine('gate', p[0] ?? 0, Cmd.READ_GATE);
      case Cmd.READ_FX:   return this.replyLine('fx', p[0] ?? 0, Cmd.READ_FX);

      case Cmd.WRITE_CV:   this.storeLine('cv', p); return null;
      case Cmd.WRITE_GATE: this.storeLine('gate', p); return null;
      case Cmd.WRITE_FX:   this.storeLine('fx', p); return null;

      case Cmd.READ_CLOCK:
        return f(Cmd.READ_CLOCK, this.working.globals.slice(0, GLOBAL_BYTES));
      case Cmd.SET_CLOCK:
        this.working.globals = p.slice(0, GLOBAL_BYTES);
        return null;
      case Cmd.SET_TEMPO:
        this.working.globals[2] = p[0] ?? 0;
        this.working.globals[3] = p[1] ?? 0;
        return null;
      case Cmd.SET_START:      this.working.globals[0] = p[0] ?? 0; return null;
      case Cmd.SET_SYNC:       this.working.globals[1] = p[0] ?? 0; return null;
      case Cmd.SET_MIDI_COPY:  this.working.globals[4] = p[0] ?? 0; return null;
      case Cmd.SET_RESET:      this.working.globals[5] = p[0] ?? 0; return null;
      case Cmd.GLOBAL_CC_CH:   this.working.globals[6] = p[0] ?? 0; return null;

      case Cmd.READ_MAPPING: {
        const row = p[0] ?? 0;
        const m = this.working.modMatrix[row];
        if (!m) return null;
        return f(Cmd.READ_MAPPING, [
          row, m.statusHigh, m.channel, m.number, m.targetLine, m.targetParam, m.valueMin, m.valueMax,
        ]);
      }
      case Cmd.SET_MAPPING: {
        const row = p[0] ?? 0;
        if (row < this.working.modMatrix.length) {
          this.working.modMatrix[row] = {
            statusHigh: p[2] ?? 0, channel: p[3] ?? 0, number: p[4] ?? 0,
            targetLine: p[5] ?? 127, targetParam: p[6] ?? 0,
            valueMin: p[7] ?? 0, valueMax: p[8] ?? 0,
          };
        }
        return null;
      }

      case Cmd.LOAD_PRESET: {
        const slot = p[0] ?? 0;
        if (slot < this.presets.length) {
          this.currentPreset = slot;
          this.working = structuredClone(this.presets[slot]!);
        }
        return null;
      }
      case Cmd.SAVE_ALL:
        this.presets[this.currentPreset] = structuredClone(this.working);
        return null;
      case Cmd.GET_PRESET:
        return f(Cmd.GET_PRESET, [this.currentPreset]);

      case Cmd.SET_MAP_MODE:
        this.learnArmed = (p[0] ?? 0) === 1;
        return null;

      case Cmd.GET_VERSION:
        return f(Cmd.GET_VERSION, [
          this.firmware.major, this.firmware.minor, this.firmware.revision.charCodeAt(0),
        ]);
      case Cmd.CHECK_CONNECTION:
        return f(Cmd.CHECK_CONNECTION, [1]);

      default:
        return null;
    }
  }

  private replyLine(family: Family, slot: number, cmd: number): Uint8Array {
    const base = family === 'cv' ? 0 : family === 'gate' ? 8 : 16;
    const line = this.working.lines[base + (slot & 7)]!;
    const bytes = new Array<number>(LINE_BYTES).fill(0);
    for (let i = 0; i < LINE_BYTES; i++) bytes[i] = line.bytes[i] ?? 0;
    const mode = model.families[family].find((m) => m.index === line.mode);
    bytes[0] = mode?.wire ?? line.mode;
    return Uint8Array.from([0xf0, 0x06, 0x29, cmd, slot & 7, ...bytes, 0xf7]);
  }

  private storeLine(family: Family, payload: number[]): void {
    const slot = (payload[0] ?? 0) & 7;
    const base = family === 'cv' ? 0 : family === 'gate' ? 8 : 16;
    const raw = payload.slice(1);
    const bytes = new Array<number>(LINE_BYTES).fill(0);
    for (let i = 0; i < LINE_BYTES; i++) bytes[i] = raw[i] ?? 0;
    let mode = 0;
    try { mode = wireToMode(family, bytes[0]!); } catch { mode = 0; }
    bytes[0] = mode;
    this.working.lines[base + slot] = { mode, bytes };
  }
}

/** A non-empty starting config so the simulator looks like a module someone has actually used. */
function seedConfig(): PortailConfig {
  const c = emptyConfig('Simulator working memory');
  const set = (line: number, mode: number, params: number[]) => {
    const bytes = new Array<number>(LINE_BYTES).fill(0);
    bytes[0] = mode;
    params.forEach((v, i) => { bytes[i + 1] = v; });
    c.lines[line] = { mode, bytes };
  };
  // CV 1-2: a poly pair. CV 3: velocity. CV 4: an LFO.
  set(0, 1, [0, 3, 1, 0, 0, 0, 0, 127]);
  set(1, 1, [0, 3, 1, 0, 0, 0, 0, 127]);
  set(2, 4, [0, 1, 1]);
  set(3, 9, [0, 4, 6, 0, 0]);
  // Gate 1-2 follow the poly pair; gate 3 is a clock.
  set(8, 1, [0, 1, 0, 0, 0, 0, 0]);
  set(9, 1, [0, 2, 0, 0, 0, 0, 0]);
  set(10, 8, [0, 0, 6, 5, 0, 0]);
  // FX 1: quantise CV 1 to a minor scale.
  set(16, 7, [0, 2, 0]);
  c.globals = [0, 0, 0, 120, 0, 0, 16, 0];
  return c;
}
