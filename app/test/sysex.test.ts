import { describe, it, expect } from 'vitest';
import {
  ALLOWED_OPCODES, DENIED_OPCODES, Cmd,
  clamp7, isPortailSysex, modeToWire, wireToMode,
  encodeLine, decode, req, encodeConfig, requestConfig,
  toSyxBlob, fromSyxBlob, decodeConfigMessages,
  SYSEX_START, SYSEX_END, ADDR_MSB, ADDR_LSB,
} from '../src/device/sysex';
import { model, modesFor, lineWithDefaults, emptyConfig, bytesForFamily } from '../src/model/model';
import type { Family, Line } from '../src/model/types';

const families: Family[] = ['cv', 'gate', 'fx'];
const firstLine: Record<Family, number> = { cv: 0, gate: 8, fx: 16 };

/* ------------------------------------------------------------ invariant zero */

describe('invariant zero — the opcode allowlist', () => {
  // The single most important test in the project: the app can physically emit ONLY these opcodes.
  const expectedAllowlist = [
    0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x07, 0x08, 0x09, 0x0a, 0x0b,
    0x11, 0x12, 0x13, 0x17, 0x18, 0x19, 0x1a, 0x1d, 0x20, 0x22, 0x23, 0x24,
  ];

  it('the emittable set is EXACTLY the documented allowlist', () => {
    expect([...ALLOWED_OPCODES].sort((a, b) => a - b)).toEqual(expectedAllowlist);
  });

  it('every named-dangerous opcode is individually absent (belt and suspenders)', () => {
    for (const op of Object.keys(DENIED_OPCODES).map(Number)) {
      expect(ALLOWED_OPCODES.has(op), `0x${op.toString(16)} must not be emittable`).toBe(false);
    }
  });

  it('the memory-safety-defect opcodes can never be framed', () => {
    for (const op of [0x06, 0x16, 0x1f]) {
      expect(ALLOWED_OPCODES.has(op)).toBe(false);
    }
  });

  it('the microtonal writer (0x24) is allowed but REJECTS any slot outside 0-7', async () => {
    const { microtonalTable } = await import('../src/device/sysex');
    const { TWELVE_TET } = await import('../src/model/tuning');
    expect(ALLOWED_OPCODES.has(0x24)).toBe(true);            // deliberately allowed, validated path
    expect(() => microtonalTable(0, TWELVE_TET)).not.toThrow();
    for (const bad of [-1, 8, 9, 127, 0.5, NaN]) {
      expect(() => microtonalTable(bad, TWELVE_TET), `slot ${bad}`).toThrow();
    }
  });

  it('anything above 0x2c is denied', () => {
    for (const op of [0x2d, 0x30, 0x7f]) expect(ALLOWED_OPCODES.has(op)).toBe(false);
  });

  it('there is no factory-reset / initAll constructor on req', () => {
    expect((req as Record<string, unknown>)['initAll']).toBeUndefined();
    expect((Cmd as Record<string, unknown>)['INIT_ALL']).toBeUndefined();
  });

  it('SET_MAPPING only ever builds the per-slot form (14 bytes), never the 192-byte grid', () => {
    const msg = req.mapping(0, {
      statusHigh: 9, channel: 0, number: 60, targetLine: 0, targetParam: 2, valueMin: 0, valueMax: 5,
    });
    // Per-slot form: F0 06 29 12 + 9-byte payload + F7 = 14 bytes. The 192-byte legacy grid would
    // be ~197 bytes; we must never build that.
    expect(msg.length).toBe(14);
    expect(msg.length).toBeLessThan(20);
  });
});

/* --------------------------------------------------------------- framing */

describe('framing', () => {
  it('wraps with F0 06 29 … F7', () => {
    const m = req.version();
    expect([m[0], m[1], m[2], m[m.length - 1]]).toEqual([SYSEX_START, ADDR_MSB, ADDR_LSB, SYSEX_END]);
    expect(m[3]).toBe(Cmd.GET_VERSION);
  });

  it('isPortailSysex requires the full prefix and terminator', () => {
    expect(isPortailSysex([0xf0, 0x06, 0x29, 0x22, 0xf7])).toBe(true);
    expect(isPortailSysex([0xf0, 0x7e, 0x00, 0x06, 0xf7])).toBe(false); // identity req, not ours
    expect(isPortailSysex([0xf0, 0x06, 0x29, 0x22])).toBe(false);        // no terminator
  });

  it('clamp7 keeps bytes in 0..127', () => {
    expect(clamp7(200)).toBe(127);
    expect(clamp7(-5)).toBe(0);
    expect(clamp7(0x80)).toBe(127); // the illegal status-byte value is clamped
    expect(clamp7(NaN)).toBe(0);
  });
});

/* ---------------------------------------------------- per-family line width */

describe('per-family line width', () => {
  it('FX lines are 8 bytes; CV and Gate are 9', () => {
    expect(bytesForFamily('cv')).toBe(9);
    expect(bytesForFamily('gate')).toBe(9);
    expect(bytesForFamily('fx')).toBe(8);
  });

  it('an FX write message is 14 bytes total (F0 06 29 09 <slot> <8> F7)', () => {
    const fx = lineWithDefaults('fx', 7); // SCALE
    const msg = encodeLine(16, fx);
    expect(msg.length).toBe(14);
  });

  it('a CV write message is 15 bytes total (F0 06 29 03 <slot> <9> F7)', () => {
    const cv = lineWithDefaults('cv', 1); // NOTE
    const msg = encodeLine(0, cv);
    expect(msg.length).toBe(15);
  });

  it('an FX read reply of 14 bytes decodes', () => {
    // reply: F0 06 29 08 <slot> <8 bytes> F7
    const full = [0xf0, 0x06, 0x29, 0x08, 0, 7, 0, 2, 0, 0, 0, 0, 0, 0xf7];
    const r = decode(full);
    expect(r?.kind).toBe('line');
  });
});

/* ------------------------------------------------------- wire encoding quirks */

describe('post-FX wire encoding', () => {
  it('FX modes 9..15 travel as 32 + (index - 9)', () => {
    expect(modeToWire('fx', 9)).toBe(0x20);   // DELAY
    expect(modeToWire('fx', 15)).toBe(0x26);  // REPEATS
    expect(modeToWire('fx', 8)).toBe(8);      // MICROTONAL — not post-fx
  });
  it('round-trips back to the mode index', () => {
    for (let i = 0; i <= 15; i++) {
      expect(wireToMode('fx', modeToWire('fx', i))).toBe(i);
    }
  });
});

describe('gate mode-byte masking', () => {
  it('masks the high nibble on receive', () => {
    // GATE mode index 1; a reply with the high nibble set must still decode to 1.
    expect(wireToMode('gate', 0x1 | 0x30)).toBe(1);
  });
});

describe('FX target byte is masked & 7', () => {
  it('clamps an out-of-range target on encode', () => {
    const fx: Line = { mode: 7, bytes: [7, 0xf, 0, 0, 0, 0, 0, 0, 0] }; // target 0xf
    const msg = encodeLine(16, fx);
    // message: F0 06 29 09 <slot> <wire-mode> <target> ... ; target at index 6
    expect(msg[6]).toBe(0xf & 7); // == 7
  });
});

/* ----------------------------------------------------- full round-trip per mode */

describe('every mode round-trips through encode → decode', () => {
  for (const family of families) {
    for (const mode of modesFor(family)) {
      it(`${family}.${mode.key} (index ${mode.index})`, () => {
        const line = lineWithDefaults(family, mode.index);
        const written = encodeLine(firstLine[family], line);
        // Echo the same line body back as a read reply (read opcode, same payload).
        const readCmd = family === 'cv' ? Cmd.READ_CV : family === 'gate' ? Cmd.READ_GATE : Cmd.READ_FX;
        const reply = Uint8Array.from([0xf0, 0x06, 0x29, readCmd, ...written.slice(4, -1), 0xf7]);
        const decoded = decode(reply);
        expect(decoded?.kind).toBe('line');
        if (decoded?.kind === 'line') {
          expect(decoded.data.mode).toBe(mode.index);
          const width = bytesForFamily(family);
          for (let i = 0; i < width; i++) {
            expect(decoded.data.bytes[i]).toBe(line.bytes[i]);
          }
        }
      });
    }
  }
});

/* ------------------------------------------------------------ echo rejection */

describe('request/reply disambiguation by length', () => {
  it('a read request echoed back (1-byte payload) is not mistaken for a reply', () => {
    expect(decode(req.readLine(0))).toBeNull();      // CV read request echo
    expect(decode(req.readGlobals())).toBeNull();    // globals read request echo (no payload)
  });
  it('a genuine globals reply (8 bytes) decodes', () => {
    const reply = [0xf0, 0x06, 0x29, Cmd.READ_CLOCK, 0, 0, 0, 120, 0, 0, 16, 0, 0xf7];
    const r = decode(reply);
    expect(r?.kind).toBe('globals');
    if (r?.kind === 'globals') expect(r.globals[3]).toBe(120);
  });
});

/* ------------------------------------------------------- version / preset / pong */

describe('status replies', () => {
  it('decodes a version reply with ASCII revision', () => {
    const r = decode([0xf0, 0x06, 0x29, Cmd.GET_VERSION, 0, 9, 0x61, 0xf7]); // 0.9a
    expect(r).toMatchObject({ kind: 'version', major: 0, minor: 9, revision: 'a', text: '0.9a' });
  });
  it('decodes a preset reply', () => {
    const r = decode([0xf0, 0x06, 0x29, Cmd.GET_PRESET, 3, 0xf7]);
    expect(r).toMatchObject({ kind: 'preset', slot: 3 });
  });
  it('decodes a pong', () => {
    expect(decode([0xf0, 0x06, 0x29, Cmd.CHECK_CONNECTION, 1, 0xf7])?.kind).toBe('pong');
  });
});

/* ---------------------------------------------------------- malformed input */

describe('malformed input', () => {
  it('non-Portail SysEx returns null', () => {
    expect(decode([0xf0, 0x7d, 0x00, 0xf7])).toBeNull();
  });
  it('a truncated message returns null', () => {
    expect(decode([0xf0, 0x06, 0x29])).toBeNull();
  });
  it('an unknown but well-framed opcode decodes as "unknown"', () => {
    const r = decode([0xf0, 0x06, 0x29, 0x7f, 1, 2, 0xf7]);
    expect(r?.kind).toBe('unknown');
  });
});

/* ---------------------------------------------------------- whole config IO */

describe('whole-config transfer', () => {
  it('encodeConfig emits 24 lines + globals + 32 mod rows = 57 messages', () => {
    const msgs = encodeConfig(emptyConfig());
    expect(msgs.length).toBe(24 + 1 + model.modMatrix.rows);
  });
  it('requestConfig emits 24 line reads + globals + N mod reads', () => {
    const msgs = requestConfig(model.modMatrix.rows);
    expect(msgs.length).toBe(24 + 1 + model.modMatrix.rows);
  });
  it('syx blob round-trips through split', () => {
    const msgs = encodeConfig(emptyConfig());
    const blob = toSyxBlob(msgs);
    const back = fromSyxBlob(blob);
    expect(back.length).toBe(msgs.length);
    expect([...back[0]!]).toEqual([...msgs[0]!]);
  });
  it('decodeConfigMessages reconstructs a config from its own write messages', () => {
    const cfg = emptyConfig('rt');
    cfg.lines[0] = lineWithDefaults('cv', 1);      // NOTE
    cfg.lines[16] = lineWithDefaults('fx', 7);     // SCALE
    cfg.globals = [0, 0, 0, 120, 0, 0, 16, 0];
    const msgs = encodeConfig(cfg);
    const { config, applied } = decodeConfigMessages(msgs, emptyConfig());
    expect(applied).toBe(msgs.length);
    expect(config.lines[0]!.mode).toBe(1);
    expect(config.lines[16]!.mode).toBe(7);
    expect(config.globals[3]).toBe(120);
  });
});
