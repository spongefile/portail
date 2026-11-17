/**
 * WebMIDI transport.
 *
 * Design rules, all of them reactions to how the official editor fails (AUDIT.md §2.1-2.3, §2.14):
 *   - Never throw into a click handler. Every failure becomes an explicit ConnectionState.
 *   - Never assume a port is a Portail. Probe it and require a version reply.
 *   - Never fire-and-forget a bulk read. Track which lines answered and report what didn't.
 *   - Writes get no acknowledgement from this device, so after a bulk write we re-read and
 *     compare rather than claiming success we cannot verify.
 */

import { Emitter } from './emitter';
import { describeMidi } from './midi-decode';
import { Cmd, decode, encodeLine, isPortailSysex, req, microtonalTable } from './sysex';
import type {
  ConnectionState, PortInfo, PortailDevice, PortailDeviceEvents, PresetWriteResult, ReadResult,
  TransferProgress,
} from './types';
import type { PortailConfig } from '../model/types';
import { GLOBAL_BYTES, LINE_COUNT } from '../model/types';
import { diffConfigs, emptyConfig, lineLabel, model } from '../model/model';

/** How long to wait for any single reply before treating it as lost. */
const REPLY_TIMEOUT_MS = 400;
/** Gap between messages in a bulk transfer. The original used 5 ms with no basis; we go slower
 *  and, unlike it, we verify afterwards. */
const BULK_GAP_MS = 8;
/** How often to re-probe a connected device so "connected" stays truthful. */
const HEARTBEAT_MS = 3000;

type Pending = {
  match: (r: NonNullable<ReturnType<typeof decode>>) => boolean;
  resolve: (r: NonNullable<ReturnType<typeof decode>>) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class WebMidiDevice
  extends Emitter<PortailDeviceEvents>
  implements PortailDevice
{
  readonly kind = 'webmidi' as const;

  private access: MIDIAccess | null = null;
  private state: ConnectionState = { status: 'requesting' };
  private outputId: string | null = null;
  private pending: Pending[] = [];
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private learnArmed = false;
  private stopped = false;

  /* ---------------------------------------------------------------- lifecycle */

  async start(): Promise<void> {
    this.stopped = false;

    if (typeof navigator === 'undefined' || typeof navigator.requestMIDIAccess !== 'function') {
      this.setState({
        status: 'unsupported',
        reason:
          'This browser does not implement the Web MIDI API. Safari and Firefox do not support it. ' +
          'Use Chrome, Edge, or another Chromium-based browser to talk to the module. ' +
          'Everything else in this editor — editing, import/export, the simulator — still works here.',
      });
      return;
    }

    this.setState({ status: 'requesting' });
    try {
      this.access = await navigator.requestMIDIAccess({ sysex: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setState({
        status: 'denied',
        reason:
          `The browser refused MIDI access (${message}). ` +
          'SysEx access needs your explicit permission — reload and choose Allow, or check the ' +
          'site permissions for this page.',
      });
      return;
    }

    this.access.onstatechange = () => { if (!this.stopped) this.refreshPorts(); };
    this.attachInputs();
    this.setState({ status: 'searching', ports: this.listPorts() });
    await this.autoDetect();
  }

  stop(): void {
    this.stopped = true;
    if (this.heartbeat) { clearInterval(this.heartbeat); this.heartbeat = null; }
    for (const p of this.pending) clearTimeout(p.timer);
    this.pending = [];
    if (this.access) {
      for (const input of this.access.inputs.values()) input.onmidimessage = null;
      this.access.onstatechange = null;
    }
    this.clearListeners();
  }

  getState(): ConnectionState { return this.state; }

  listPorts(): PortInfo[] {
    if (!this.access) return [];
    return [...this.access.outputs.values()].map((o) => ({
      id: o.id,
      name: o.name ?? '(unnamed)',
      manufacturer: o.manufacturer || null,
      confirmed: o.id === this.outputId && this.state.status === 'connected',
    }));
  }

  async selectPort(id: string): Promise<void> {
    this.outputId = id;
    await this.probe();
  }

  /**
   * Try every output in turn, preferring ones whose name looks like a Portail, and keep the first
   * that answers a version request. No guessing from the name alone.
   */
  private async autoDetect(): Promise<void> {
    if (!this.access) return;
    const outputs = [...this.access.outputs.values()];
    if (outputs.length === 0) {
      this.setState({ status: 'searching', ports: [] });
      return;
    }
    const looksLikePortail = (n: string) => /portail|eowave/i.test(n);
    outputs.sort((a, b) => Number(looksLikePortail(b.name ?? '')) - Number(looksLikePortail(a.name ?? '')));

    for (const out of outputs) {
      if (this.stopped) return;
      this.outputId = out.id;
      const reply = await this.request(req.version(), (r) => r.kind === 'version');
      if (reply?.kind === 'version') {
        this.setState({
          status: 'connected',
          port: this.portInfo(out.id)!,
          firmware: reply.text,
        });
        this.startHeartbeat();
        void this.getCurrentPreset().then((slot) => {
          if (slot !== null) this.emit('preset', slot);
        });
        return;
      }
    }
    this.outputId = null;
    this.setState({ status: 'searching', ports: this.listPorts() });
  }

  async probe(): Promise<void> {
    const reply = await this.request(req.version(), (r) => r.kind === 'version');
    const port = this.outputId ? this.portInfo(this.outputId) : null;
    if (!port) { this.setState({ status: 'searching', ports: this.listPorts() }); return; }
    if (reply?.kind === 'version') {
      this.setState({ status: 'connected', port, firmware: reply.text });
      this.startHeartbeat();
    } else {
      this.setState({ status: 'lost', port, since: Date.now() });
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = setInterval(() => {
      if (this.stopped || this.state.status !== 'connected') return;
      void this.request(req.ping(), (r) => r.kind === 'pong').then((r) => {
        if (this.stopped) return;
        if (!r && this.state.status === 'connected') {
          this.setState({ status: 'lost', port: this.state.port, since: Date.now() });
        }
      });
    }, HEARTBEAT_MS);
  }

  private refreshPorts(): void {
    this.attachInputs();
    if (this.state.status === 'connected' && this.outputId && !this.portInfo(this.outputId)) {
      this.setState({ status: 'searching', ports: this.listPorts() });
      this.outputId = null;
      void this.autoDetect();
      return;
    }
    if (this.state.status === 'searching') {
      this.setState({ status: 'searching', ports: this.listPorts() });
      if (!this.outputId) void this.autoDetect();
    }
  }

  private attachInputs(): void {
    if (!this.access) return;
    for (const input of this.access.inputs.values()) {
      input.onmidimessage = (e: MIDIMessageEvent) => this.onMidi(e);
    }
  }

  private portInfo(id: string): PortInfo | null {
    if (!this.access) return null;
    const o = this.access.outputs.get(id);
    if (!o) return null;
    return {
      id: o.id,
      name: o.name ?? '(unnamed)',
      manufacturer: o.manufacturer || null,
      confirmed: true,
    };
  }

  /* -------------------------------------------------------------------- MIDI */

  private onMidi(e: MIDIMessageEvent): void {
    const data = e.data;
    if (!data) return;
    this.emit('activity', describeMidi(data, 'in'));

    const status = data[0] ?? 0;
    const type = status & 0xf0;
    if (this.learnArmed && (type === 0x90 || type === 0xb0) && (data[2] ?? 0) > 0) {
      this.learnArmed = false;
      this.emit('learn', { statusHigh: status >> 4, channel: status & 0x0f, number: data[1] ?? 0 });
    }

    if (!isPortailSysex(data)) return;
    const decoded = decode(data);
    if (!decoded) return;

    if (decoded.kind === 'preset') this.emit('preset', decoded.slot);

    for (let i = this.pending.length - 1; i >= 0; i--) {
      const p = this.pending[i]!;
      if (p.match(decoded)) {
        clearTimeout(p.timer);
        this.pending.splice(i, 1);
        p.resolve(decoded);
      }
    }
  }

  private output(): MIDIOutput | null {
    if (!this.access || !this.outputId) return null;
    return this.access.outputs.get(this.outputId) ?? null;
  }

  private post(msg: Uint8Array): boolean {
    const out = this.output();
    if (!out) return false;
    try {
      out.send(msg);
      this.emit('activity', describeMidi(msg, 'out'));
      return true;
    } catch (err) {
      this.setState({
        status: 'error',
        reason: `Sending MIDI failed: ${err instanceof Error ? err.message : String(err)}`,
      });
      return false;
    }
  }

  /** Sends and waits for a matching reply, or null on timeout. */
  private request(
    msg: Uint8Array,
    match: (r: NonNullable<ReturnType<typeof decode>>) => boolean,
    timeout = REPLY_TIMEOUT_MS,
  ): Promise<NonNullable<ReturnType<typeof decode>> | null> {
    return new Promise((resolve) => {
      if (!this.post(msg)) { resolve(null); return; }
      const entry: Pending = {
        match,
        resolve,
        timer: setTimeout(() => {
          const i = this.pending.indexOf(entry);
          if (i >= 0) this.pending.splice(i, 1);
          resolve(null);
        }, timeout),
      };
      this.pending.push(entry);
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
  }

  private requireConnection(): void {
    if (this.state.status !== 'connected') {
      throw new Error(
        `No Portail is connected (state: ${this.state.status}). Connect the module and press ` +
        `"Reconnect", or switch to the simulator.`,
      );
    }
  }

  /* ------------------------------------------------------------------- config */

  async readConfig(): Promise<ReadResult> {
    this.requireConnection();
    const config = emptyConfig('Read from module');
    const missing: string[] = [];
    const total = LINE_COUNT + 1 + model.modMatrix.rows;
    let done = 0;
    const tick = (label: string) =>
      this.emit('progress', { phase: 'reading', done: ++done, total, label } as TransferProgress);

    for (let i = 0; i < LINE_COUNT; i++) {
      const slot = i & 7;
      const r = await this.request(
        req.readLine(i),
        (x) => x.kind === 'line' && x.line === i && (x.line & 7) === slot,
      );
      if (r?.kind === 'line') config.lines[r.line] = r.data;
      else missing.push(lineLabel(i));
      tick(lineLabel(i));
    }

    const g = await this.request(req.readGlobals(), (x) => x.kind === 'globals');
    if (g?.kind === 'globals') config.globals = g.globals.slice(0, GLOBAL_BYTES);
    else missing.push('globals');
    tick('globals');

    for (let row = 0; row < model.modMatrix.rows; row++) {
      const r = await this.request(req.readMapping(row), (x) => x.kind === 'mapping' && x.row === row);
      if (r?.kind === 'mapping') config.modMatrix[r.row] = r.data;
      else missing.push(`mod row ${row + 1}`);
      tick(`mod row ${row + 1}`);
    }

    this.emit('progress', { phase: 'idle', done: total, total, label: '' });
    return { config, partial: missing.length > 0, missing };
  }

  async writeMicrotonalTable(slot: number, cents: readonly number[]): Promise<void> {
    this.post(microtonalTable(slot, cents)); // validates slot 0-7 before it can be posted
  }

  async writeConfig(config: PortailConfig): Promise<void> {
    this.requireConnection();
    const total = LINE_COUNT + 1 + config.modMatrix.length;
    let done = 0;
    const tick = (label: string) =>
      this.emit('progress', { phase: 'sending', done: ++done, total, label } as TransferProgress);

    for (let i = 0; i < LINE_COUNT; i++) {
      this.post(encodeLine(i, config.lines[i]!));
      tick(lineLabel(i));
      await this.wait(BULK_GAP_MS);
    }
    this.post(req.globals(config.globals));
    tick('globals');
    await this.wait(BULK_GAP_MS);

    for (let r = 0; r < config.modMatrix.length; r++) {
      this.post(req.mapping(r, config.modMatrix[r]!));
      tick(`mod row ${r + 1}`);
      await this.wait(BULK_GAP_MS);
    }
    this.emit('progress', { phase: 'idle', done: total, total, label: '' });
  }

  async writeLine(line: number, config: PortailConfig): Promise<void> {
    this.requireConnection();
    this.post(encodeLine(line, config.lines[line]!));
  }

  /* ------------------------------------------------------------------ presets */

  async savePreset(slot: number, config: PortailConfig): Promise<PresetWriteResult> {
    this.requireConnection();
    // Correct sequence (spec/protocol.md §0.5): recall target → resend full config from our copy →
    // commit 0x07 → read back and compare. Save always targets the active preset, so recall first.
    this.post(req.loadPreset(this.recallWire(slot)));
    await this.wait(BULK_GAP_MS);
    await this.writeConfig(config);
    this.post(req.saveAll());
    await this.wait(BULK_GAP_MS);
    const readback = await this.readConfig();
    const diff = diffConfigs(config, readback.config);
    const mismatches = [
      ...diff.lines.map((l) => l.label),
      ...(diff.globals ? ['globals'] : []),
      ...(diff.modMatrix ? ['mod matrix'] : []),
    ];
    return { ok: mismatches.length === 0 && !readback.partial, slot, mismatches, partial: readback.partial };
  }

  async loadPreset(slot: number): Promise<void> {
    this.requireConnection();
    this.post(req.loadPreset(this.recallWire(slot)));
    await this.wait(BULK_GAP_MS);
  }

  /**
   * The ONE place preset slot numbering is converted (DESIGN §8). The interface is 0-based (0-7);
   * the firmware recall payload is 1-based (1-8). Gated behind the OQ-1 hardware check until
   * confirmed on a real module.
   */
  private recallWire(slot: number): number {
    return slot + 1;
  }

  async getCurrentPreset(): Promise<number | null> {
    const r = await this.request(req.currentPreset(), (x) => x.kind === 'preset');
    return r?.kind === 'preset' ? r.slot : null;
  }

  async setLearnMode(on: boolean): Promise<void> {
    this.learnArmed = on;
    if (this.state.status === 'connected') this.post(req.mapMode(on));
  }

  async sendRaw(messages: Uint8Array[]): Promise<void> {
    this.requireConnection();
    for (const m of messages) {
      this.post(m);
      await this.wait(BULK_GAP_MS);
    }
  }

  private setState(s: ConnectionState): void {
    this.state = s;
    this.emit('connection', s);
  }
}

/** True when this browser can talk MIDI at all. Used to pick a default transport. */
export function webMidiAvailable(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function';
}

/** Cmd is re-exported so the debug panel can label raw traffic without another import. */
export { Cmd };
