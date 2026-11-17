import { describe, it, expect } from 'vitest';
import { microtonalTable, MICROTONAL_MAX_CENTS } from '../src/device/sysex';
import { parseScl, toScl } from '../src/model/scl';
import { TWELVE_TET } from '../src/model/tuning';

describe('microtonal codec', () => {
  it('encodes 12 values as 14-bit MSB/LSB to a slot', () => {
    const m = microtonalTable(3, TWELVE_TET);
    expect(m[0]).toBe(0xf0); expect(m[3]).toBe(0x24); expect(m[4]).toBe(3);
    expect(m.length).toBe(4 + 1 + 24 + 1); // F0 06 29 24, slot, 24 data, F7
    // value 1100 (B) → 14-bit = MSB (1100>>7)=8, LSB (1100&127)=76
    const lastMsb = m[4 + 1 + 22], lastLsb = m[4 + 1 + 23];
    expect((lastMsb! << 7) | lastLsb!).toBe(1100);
  });
  it('REJECTS an out-of-range slot (never clamps)', () => {
    expect(() => microtonalTable(8, TWELVE_TET)).toThrow(/0-7/);
    expect(() => microtonalTable(-1, TWELVE_TET)).toThrow(/0-7/);
  });
  it('rejects a wrong-length table', () => {
    expect(() => microtonalTable(0, [0, 100])).toThrow(/12 values/);
  });
  it('clamps values to the safe ceiling', () => {
    const m = microtonalTable(0, [0,0,0,0,0,0,0,0,0,0,0, 99999]);
    const msb = m[4+1+22], lsb = m[4+1+23];
    expect((msb!<<7)|lsb!).toBe(MICROTONAL_MAX_CENTS);
  });
});

describe('.scl import', () => {
  it('maps a 12-TET .scl to [0,100,..,1100], dropping the octave line', () => {
    const scl = `! test\n12-TET\n 12\n 100.0\n 200.0\n 300.0\n 400.0\n 500.0\n 600.0\n 700.0\n 800.0\n 900.0\n 1000.0\n 1100.0\n 1200.0\n`;
    const r = parseScl(scl);
    expect(r.cents).toEqual([...TWELVE_TET]);
  });
  it('parses ratios (3/2 → 701.955)', () => {
    const lines = ['1/1?', 'just', ' 12'];
    // build a scale where degree7 = 3/2
    const degs = ['16/15','9/8','6/5','5/4','4/3','45/32','3/2','8/5','5/3','9/5','15/8','2/1'];
    const scl = `! just\nJust intonation\n 12\n ` + degs.join('\n ') + '\n';
    const r = parseScl(scl);
    expect(r.cents[7]).toBeCloseTo(701.955, 1); // pc7 = degree7 = 3/2
    void lines;
  });
  it('rejects a non-12-note scale', () => {
    const scl = `! x\nfive\n 5\n 240.\n 480.\n 720.\n 960.\n 1200.\n`;
    expect(() => parseScl(scl)).toThrow(/12 pitch classes/);
  });
  it('rejects a non-octave period', () => {
    const scl = `! bp\nBohlen-Pierce-ish\n 12\n 100.\n 200.\n 300.\n 400.\n 500.\n 600.\n 700.\n 800.\n 900.\n 1000.\n 1100.\n 1901.955\n`;
    expect(() => parseScl(scl)).toThrow(/octave/);
  });
  it('round-trips through toScl', () => {
    const scl = toScl('My scale', TWELVE_TET);
    const r = parseScl(scl);
    expect(r.cents).toEqual([...TWELVE_TET]);
  });
});

describe('quarter-tone offset preset + editable root', () => {
  it('the 24-TET offset preset encodes with a 50-cent root', async () => {
    const { FACTORY_TUNINGS, isTwelveTet } = await import('../src/model/tuning');
    const { microtonalTable } = await import('../src/device/sysex');
    const off = FACTORY_TUNINGS.find((t) => t.id === 'factory-24tet-offset')!;
    expect(off.cents[0]).toBe(50);
    expect(isTwelveTet(off.cents)).toBe(false); // not misreported as standard
    const m = microtonalTable(0, off.cents);
    const rootMsb = m[5], rootLsb = m[6]; // first value after slot
    expect((rootMsb! << 7) | rootLsb!).toBe(50); // root C = 50 encodes fine
  });
  it('sanitizeCents no longer forces the root to 0', async () => {
    const { sanitizeCents } = await import('../src/model/tuning');
    expect(sanitizeCents([50,150,250,350,450,550,650,750,850,950,1050,1150])[0]).toBe(50);
  });
})
