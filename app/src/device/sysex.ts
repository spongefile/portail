/**
 * SysEx encode/decode for the eowave Portail.
 *
 * Command bytes and payload layouts are transcribed from the official editor's source AND confirmed
 * against a disassembly of the firmware image — see spec/protocol.md (the canonical protocol) and
 * app/AUDIT.md §3. Anything still unconfirmed on live hardware is tagged UNVERIFIED.
 *
 * INVARIANT ZERO (DESIGN.md §Invariant zero, spec/protocol.md §0.9): this module can only ever
 * construct messages whose opcode is in ALLOWED_OPCODES. `frame()` throws on anything else, so the
 * dangerous/undocumented opcodes (factory reset 0x06, calibration, file transfer, the memory-safety
 * defects 0x16/0x1F/0x24, the 192-byte 0x12 form, everything undocumented) are UNREPRESENTABLE, not
 * merely unused. A unit test asserts the emittable set is exactly the allowlist and that each
 * named-dangerous opcode is absent. Mechanism detail is withheld from this public file — see
 * SECURITY.md.
 */

import type { Family, Line, ModRow, PortailConfig } from '../model/types';
import { GLOBAL_BYTES, LINE_BYTES, LINE_COUNT } from '../model/types';
import { bytesForFamily, familyOfLine, modeByIndex, modeByWire } from '../model/model';

export const SYSEX_START = 0xf0;
export const SYSEX_END = 0xf7;

/**
 * The device's SysEx address. NOTE: 0x06 is not an allocated MIDI manufacturer ID; it collides with
 * Moog Music's registered single-byte ID (spec/protocol.md §1.2). So a matching prefix is necessary
 * but NOT sufficient to conclude a message is a Portail's — always check opcode and length, and gate
 * every write behind a version handshake so we never write into someone's Moog.
 */
export const ADDR_MSB = 0x06;
export const ADDR_LSB = 0x29; // 41

/** The opcodes the app is permitted to construct and send. This IS the allowlist. */
export const Cmd = {
  READ_GATE: 0x00,
  WRITE_GATE: 0x01,
  READ_CV: 0x02,
  WRITE_CV: 0x03,
  LOAD_PRESET: 0x04,
  GET_PRESET: 0x05,
  SAVE_ALL: 0x07,
  READ_FX: 0x08,
  WRITE_FX: 0x09,
  SET_CLOCK: 0x0a,
  READ_CLOCK: 0x0b,
  SET_MIDI_COPY: 0x11,
  SET_MAPPING: 0x12, // 13-byte per-slot form ONLY (never the 192-byte legacy grid)
  READ_MAPPING: 0x13,
  SET_TEMPO: 0x17,
  SET_START: 0x18,
  SET_SYNC: 0x19,
  SET_RESET: 0x1a,
  SET_MAP_MODE: 0x1d,
  GLOBAL_CC_CH: 0x20,
  GET_VERSION: 0x22,
  CHECK_CONNECTION: 0x23,
  // 0x24 writes a microtonal tuning table. Allowed ONLY through microtonalTable(), which rejects any
  // slot outside 0-7 — the firmware indexes its buffers by the slot with no bound of its own, so the
  // app supplies the bound (spec/microtonal-tables.md; SECURITY.md). Slot is the only address input.
  WRITE_MICROTONAL: 0x24,
} as const;

export type CmdValue = (typeof Cmd)[keyof typeof Cmd];

/** The exact set of opcodes `frame()` will emit. Nothing outside this can be constructed. */
export const ALLOWED_OPCODES: ReadonlySet<number> = new Set(Object.values(Cmd));

/**
 * Opcodes that must NEVER be emittable. Kept for the belt-and-suspenders unit test (each is asserted
 * individually absent from ALLOWED_OPCODES), and to document why. spec/protocol.md §0.9.
 */
export const DENIED_OPCODES: Readonly<Record<number, string>> = {
  0x06: 'denied — factory reset (erases all 8 presets)',
  0x0c: 'denied — calibration',
  0x0d: 'denied — calibration (unimplemented in firmware)',
  0x0e: 'denied — file transfer',
  0x0f: 'denied — DAC calibration',
  0x10: 'denied — file view',
  0x14: 'denied — undocumented',
  0x15: 'denied — undocumented',
  0x16: 'denied — out-of-bounds RAM write (memory-safety defect; see SECURITY.md)',
  0x1b: 'denied — undocumented',
  0x1c: 'denied — undocumented',
  0x1e: 'denied — undocumented',
  0x1f: 'denied — out-of-bounds RAM read (memory-safety defect; see SECURITY.md)',
  0x25: 'denied — undocumented',
  0x26: 'undocumented',
  0x27: 'undocumented',
  0x28: 'undocumented',
  0x29: 'undocumented',
  0x2a: 'undocumented',
  0x2b: 'undocumented',
  0x2c: 'undocumented',
};

const READ_CMD: Record<Family, number> = { cv: Cmd.READ_CV, gate: Cmd.READ_GATE, fx: Cmd.READ_FX };
const WRITE_CMD: Record<Family, number> = { cv: Cmd.WRITE_CV, gate: Cmd.WRITE_GATE, fx: Cmd.WRITE_FX };

/* ------------------------------------------------------------------ helpers */

export class SysexError extends Error {}

/** Clamps to a legal SysEx data byte. Values outside 0..127 corrupt the message. */
export function clamp7(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(127, Math.round(v)));
}

/**
 * The ONLY message constructor. Enforces invariant zero: refuses any opcode not in the allowlist.
 * This is the un-bypassable gate — there is no other path from the app to `output.send`.
 */
function frame(cmd: number, payload: number[] = []): Uint8Array {
  if (!ALLOWED_OPCODES.has(cmd)) {
    throw new SysexError(
      `refused to build SysEx with opcode 0x${cmd.toString(16)} — not in the allowlist ` +
      `(invariant zero, spec/protocol.md §0.9)`,
    );
  }
  // The microtonal slot is the sole address input to the firmware's table buffers. REJECT out of
  // range (never clamp/modulo — that would write the wrong table). This makes an out-of-range 0x24
  // unrepresentable from every path, since frame() is the only constructor.
  if (cmd === Cmd.WRITE_MICROTONAL) {
    const slot = payload[0];
    if (!Number.isInteger(slot) || slot! < 0 || slot! > 7) {
      throw new SysexError(`microtonal table slot ${slot} out of range (0-7)`);
    }
  }
  return Uint8Array.from([SYSEX_START, ADDR_MSB, ADDR_LSB, cmd, ...payload.map(clamp7), SYSEX_END]);
}

/** 14-bit encode a value as [MSB(7), LSB(7)]. */
function to14(v: number): [number, number] {
  const n = Math.max(0, Math.min(16383, Math.round(v)));
  return [(n >> 7) & 0x7f, n & 0x7f];
}

/** Highest table value that can't overflow the firmware's 14-bit expansion at the top note. */
export const MICROTONAL_MAX_CENTS = 4383;

/**
 * Build the SysEx for one microtonal tuning table: 12 cent values (one per pitch class C..B),
 * to slot 0-7. Rejects a bad slot; clamps each value to a safe cents ceiling. See
 * spec/microtonal-tables.md for the format.
 */
export function microtonalTable(slot: number, cents: readonly number[]): Uint8Array {
  if (!Number.isInteger(slot) || slot < 0 || slot > 7) {
    throw new SysexError(`microtonal table slot ${slot} out of range (0-7)`);
  }
  if (cents.length !== 12) throw new SysexError(`a microtonal table needs exactly 12 values, got ${cents.length}`);
  const bytes: number[] = [];
  for (const c of cents) { const [m, l] = to14(Math.min(MICROTONAL_MAX_CENTS, Math.max(0, c))); bytes.push(m, l); }
  return frame(Cmd.WRITE_MICROTONAL, [slot, ...bytes]);
}

/** True when `data` is a well-formed SysEx message carrying this device's address prefix. */
export function isPortailSysex(data: Uint8Array | number[]): boolean {
  const d = data as ArrayLike<number>;
  return (
    d.length >= 5 &&
    d[0] === SYSEX_START &&
    d[1] === ADDR_MSB &&
    d[2] === ADDR_LSB &&
    d[d.length - 1] === SYSEX_END
  );
}

/* ---------------------------------------------------------- line encode/decode */

/**
 * The type byte written to the wire. FX modes 9-15 ("post FX") are transmitted as 32 + (index - 9),
 * i.e. with bit 5 set; every other family sends the mode index unchanged. spec/protocol.md §2.3.
 */
export function modeToWire(family: Family, modeIndex: number): number {
  const mode = modeByIndex(family, modeIndex);
  if (!mode) throw new SysexError(`unknown ${family} mode index ${modeIndex}`);
  return mode.wire;
}

/**
 * Inverse of `modeToWire`.
 *
 * Gate replies arrive with the high nibble set; the firmware/editor masks with 0x0F on receive. We
 * reproduce that. UNVERIFIED: what the high nibble carries (OQ-2) — we keep the raw byte nowhere, so
 * a gate round-trip currently cannot preserve it; flagged in the risk register.
 */
export function wireToMode(family: Family, wire: number): number {
  if (family === 'gate') {
    const masked = wire & 0x0f;
    const m = modeByWire('gate', masked);
    if (!m) throw new SysexError(`unknown gate wire type 0x${wire.toString(16)}`);
    return m.index;
  }
  if (family === 'fx' && wire >= 0x20) {
    const m = modeByWire('fx', wire);
    if (m) return m.index;
    // Tolerate an unrecognised post-FX byte the way the firmware decodes it: (raw & 0x1F) + 9.
    const guess = (wire & 0x1f) + 9;
    const g = modeByIndex('fx', guess);
    if (g) return g.index;
    throw new SysexError(`unknown fx wire type 0x${wire.toString(16)}`);
  }
  const m = modeByWire(family, wire);
  if (!m) throw new SysexError(`unknown ${family} wire type 0x${wire.toString(16)}`);
  return m.index;
}

/**
 * `F0 06 29 <write cmd> <slot 0-7> <line bytes> F7`.
 * Line width is per family: CV/Gate 9 bytes, FX 8 (spec/protocol.md §2.1). The FX target byte
 * (index 1) is masked & 7 to mirror the firmware, so a round-trip is faithful.
 */
export function encodeLine(line: number, data: Line): Uint8Array {
  const family = familyOfLine(line);
  const width = bytesForFamily(family);
  const bytes = new Array<number>(width).fill(0);
  bytes[0] = modeToWire(family, data.mode);
  for (let i = 1; i < width; i++) bytes[i] = clamp7(data.bytes[i] ?? 0);
  if (family === 'fx' && width > 1) bytes[1] = bytes[1]! & 7; // target 0-7
  return frame(WRITE_CMD[family], [line & 7, ...bytes]);
}

/** Parsed form of an inbound line reply. */
export interface LineReply {
  kind: 'line';
  line: number;
  family: Family;
  data: Line;
  /** Set when the reply carried fewer bytes than the family's width; the tail is zero-filled. */
  short: boolean;
}

function decodeLineReply(family: Family, payload: number[]): LineReply {
  const width = bytesForFamily(family);
  const slot = payload[0] ?? 0;
  const raw = payload.slice(1);
  // Line.bytes is kept at LINE_BYTES (9) for uniform diffing; FX simply leaves index 8 at 0.
  const bytes = new Array<number>(LINE_BYTES).fill(0);
  for (let i = 0; i < width; i++) bytes[i] = raw[i] ?? 0;
  const mode = wireToMode(family, bytes[0]!);
  bytes[0] = mode;
  if (family === 'fx' && width > 1) bytes[1] = bytes[1]! & 7;
  const base = family === 'cv' ? 0 : family === 'gate' ? 8 : 16;
  return {
    kind: 'line',
    line: base + (slot & 7),
    family,
    data: { mode, bytes },
    short: raw.length < width,
  };
}

/* ----------------------------------------------------------------- requests */

export const req = {
  readLine(line: number): Uint8Array {
    return frame(READ_CMD[familyOfLine(line)], [line & 7]);
  },
  readGlobals: (): Uint8Array => frame(Cmd.READ_CLOCK),
  readMapping: (row: number): Uint8Array => frame(Cmd.READ_MAPPING, [row]),
  version: (): Uint8Array => frame(Cmd.GET_VERSION),
  currentPreset: (): Uint8Array => frame(Cmd.GET_PRESET),
  ping: (): Uint8Array => frame(Cmd.CHECK_CONNECTION, [0]),

  /** Burns the module's current working memory into the currently active preset slot. */
  saveAll: (): Uint8Array => frame(Cmd.SAVE_ALL),
  loadPreset: (slot: number): Uint8Array => frame(Cmd.LOAD_PRESET, [slot]),
  /** Arms/disarms the module's own MIDI-learn mode. */
  mapMode: (on: boolean): Uint8Array => frame(Cmd.SET_MAP_MODE, [on ? 1 : 0]),

  globals(globals: number[]): Uint8Array {
    const g = new Array<number>(GLOBAL_BYTES).fill(0);
    for (let i = 0; i < GLOBAL_BYTES; i++) g[i] = clamp7(globals[i] ?? 0);
    return frame(Cmd.SET_CLOCK, g);
  },
  tempo: (bpm: number): Uint8Array => frame(Cmd.SET_TEMPO, [(bpm >> 7) & 0x7f, bpm & 0x7f]),
  start: (on: boolean): Uint8Array => frame(Cmd.SET_START, [on ? 1 : 0]),
  sync: (v: number): Uint8Array => frame(Cmd.SET_SYNC, [v]),
  midiCopy: (on: boolean): Uint8Array => frame(Cmd.SET_MIDI_COPY, [on ? 1 : 0]),
  resetOnContinue: (on: boolean): Uint8Array => frame(Cmd.SET_RESET, [on ? 1 : 0]),
  globalCcChannel: (ch: number): Uint8Array => frame(Cmd.GLOBAL_CC_CH, [ch]),

  /**
   * Mapping write — the 13-byte per-slot form. The firmware/editor pads a zero at payload[1] and
   * splits the MIDI status into nibbles, while the READ reply (0x13) returns them without the pad;
   * asymmetric but consistent. spec/protocol.md §3.3.5. The 192-byte legacy form is never built.
   */
  mapping(row: number, m: ModRow): Uint8Array {
    return frame(Cmd.SET_MAPPING, [
      row, 0, m.statusHigh, m.channel, m.number, m.targetLine, m.targetParam, m.valueMin, m.valueMax,
    ]);
  },
};

/* ------------------------------------------------------------------ decoding */

export interface GlobalsReply { kind: 'globals'; globals: number[] }
export interface MappingReply { kind: 'mapping'; row: number; data: ModRow }
export interface VersionReply { kind: 'version'; major: number; minor: number; revision: string; text: string }
export interface PresetReply { kind: 'preset'; slot: number }
export interface PongReply { kind: 'pong' }
export interface UnknownReply { kind: 'unknown'; cmd: number; payload: number[] }

export type Reply =
  | LineReply | GlobalsReply | MappingReply | VersionReply | PresetReply | PongReply | UnknownReply;

/**
 * Decodes an inbound SysEx message. Returns null when the message is not addressed to us.
 *
 * Request and reply share an opcode on this device, distinguished ONLY by payload length. A MIDI
 * loopback — or the module's own "MIDI out copy" global — can echo our requests back and look like
 * replies, so a too-short payload on a read opcode is treated as an echo, not a reply.
 */
export function decode(data: Uint8Array | number[]): Reply | null {
  const d = Array.from(data as ArrayLike<number>);
  if (!isPortailSysex(d)) return null;
  const cmd = d[3]!;
  const payload = d.slice(4, -1);

  switch (cmd) {
    case Cmd.READ_CV:
      return payload.length > 1 ? decodeLineReply('cv', payload) : null;
    case Cmd.READ_GATE:
      return payload.length > 1 ? decodeLineReply('gate', payload) : null;
    case Cmd.READ_FX:
      return payload.length > 1 ? decodeLineReply('fx', payload) : null;

    case Cmd.READ_CLOCK: {
      if (payload.length < GLOBAL_BYTES) return null; // our own request echoed back
      return { kind: 'globals', globals: payload.slice(0, GLOBAL_BYTES) };
    }

    case Cmd.READ_MAPPING: {
      if (payload.length < 8) return null;
      return {
        kind: 'mapping',
        row: payload[0]!,
        data: {
          statusHigh: payload[1]!,
          channel: payload[2]!,
          number: payload[3]!,
          targetLine: payload[4]!,
          targetParam: payload[5]!,
          valueMin: payload[6]!,
          valueMax: payload[7]!,
        },
      };
    }

    case Cmd.GET_VERSION: {
      if (payload.length < 3) return null;
      const major = payload[0]!;
      const minor = payload[1]!;
      const revision = String.fromCharCode(payload[2]!);
      return { kind: 'version', major, minor, revision, text: `${major}.${minor}${revision}` };
    }

    case Cmd.GET_PRESET:
      if (payload.length < 1) return null;
      return { kind: 'preset', slot: payload[0]! };

    case Cmd.CHECK_CONNECTION:
      return { kind: 'pong' };

    default:
      return { kind: 'unknown', cmd, payload };
  }
}

/* ------------------------------------------------------- whole-config transfer */

/** Every message needed to write a full config to the module, in order. */
export function encodeConfig(config: PortailConfig): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < LINE_COUNT; i++) out.push(encodeLine(i, config.lines[i]!));
  out.push(req.globals(config.globals));
  for (let r = 0; r < config.modMatrix.length; r++) out.push(req.mapping(r, config.modMatrix[r]!));
  return out;
}

/** Every message needed to read a full config back. */
export function requestConfig(rows: number): Uint8Array[] {
  const out: Uint8Array[] = [];
  for (let i = 0; i < LINE_COUNT; i++) out.push(req.readLine(i));
  out.push(req.readGlobals());
  for (let r = 0; r < rows; r++) out.push(req.readMapping(r));
  return out;
}

/* --------------------------------------------------------------- raw SysEx IO */

/** Concatenates messages into one .syx blob. */
export function toSyxBlob(messages: Uint8Array[]): Uint8Array {
  const total = messages.reduce((n, m) => n + m.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const m of messages) { out.set(m, o); o += m.length; }
  return out;
}

/** Splits a .syx blob back into individual F0..F7 messages, ignoring anything between them. */
export function fromSyxBlob(blob: Uint8Array): Uint8Array[] {
  const out: Uint8Array[] = [];
  let start = -1;
  for (let i = 0; i < blob.length; i++) {
    if (blob[i] === SYSEX_START) start = i;
    else if (blob[i] === SYSEX_END && start >= 0) { out.push(blob.slice(start, i + 1)); start = -1; }
  }
  return out;
}

/**
 * Rebuilds a config from a .syx blob of write messages (the inverse of `encodeConfig`).
 * This DECODES imported bytes into a config — it never relays them; the allowlist still governs what
 * the app would later send. Messages with denied/unknown opcodes are skipped.
 */
export function decodeConfigMessages(
  messages: Uint8Array[],
  base: PortailConfig,
): { config: PortailConfig; applied: number; skipped: number } {
  const config = structuredClone(base);
  let applied = 0;
  let skipped = 0;

  for (const msg of messages) {
    if (!isPortailSysex(msg)) { skipped++; continue; }
    const cmd = msg[3]!;
    const payload = Array.from(msg.slice(4, -1));
    try {
      if (cmd === Cmd.WRITE_CV || cmd === Cmd.WRITE_GATE || cmd === Cmd.WRITE_FX) {
        const family: Family = cmd === Cmd.WRITE_CV ? 'cv' : cmd === Cmd.WRITE_GATE ? 'gate' : 'fx';
        const r = decodeLineReply(family, payload);
        config.lines[r.line] = r.data;
        applied++;
      } else if (cmd === Cmd.SET_CLOCK && payload.length >= GLOBAL_BYTES) {
        config.globals = payload.slice(0, GLOBAL_BYTES);
        applied++;
      } else if (cmd === Cmd.SET_MAPPING && payload.length >= 9) {
        const row = payload[0]!;
        if (row < config.modMatrix.length) {
          config.modMatrix[row] = {
            statusHigh: payload[2]!, channel: payload[3]!, number: payload[4]!,
            targetLine: payload[5]!, targetParam: payload[6]!,
            valueMin: payload[7]!, valueMax: payload[8]!,
          };
          applied++;
        } else skipped++;
      } else skipped++;
    } catch {
      skipped++;
    }
  }
  return { config, applied, skipped };
}
