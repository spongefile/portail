import { describe, it, expect } from 'vitest';
import { emptyConfig, lineWithDefaults } from '../src/model/model';
import {
  chainForOutput, insertFxForOutput, removeFx, moveFxInChain, freeFxSlots, usedFxCount,
  validFxModesForOutput,
} from '../src/model/fx';

describe('FX chain building', () => {
  it('valid FX modes are family-specific (CV: note-domain, GATE: gate-domain)', () => {
    const cv = validFxModesForOutput(0).map((m) => m.index);
    const gate = validFxModesForOutput(8).map((m) => m.index);
    expect(cv).toContain(7);   // SCALE — CV
    expect(cv).not.toContain(9); // DELAY — gate only
    expect(gate).toContain(9);  // DELAY — GATE
    expect(gate).not.toContain(7);
  });

  it('can put 3 FX on one output, chained in slot order', () => {
    const c = emptyConfig();
    c.lines[0] = lineWithDefaults('cv', 1); // CV1 = NOTE
    const a = insertFxForOutput(c, 0, 7);   // SCALE
    const b = insertFxForOutput(c, 0, 3);   // RANDOM NOTE
    const d = insertFxForOutput(c, 0, 6);   // TRANSPOSE
    expect([a, b, d].every((x) => x !== null)).toBe(true);

    const chain = chainForOutput(c, 0);
    expect(chain).toHaveLength(3);
    // order == slot order, ascending
    expect(chain.map((e) => e.fxLine)).toEqual([...chain.map((e) => e.fxLine)].sort((x, y) => x - y));
    expect(chain.map((e) => e.name)).toEqual(['SCALE', 'RANDOM NOTE', 'TRANSPOSE']);
    expect(usedFxCount(c)).toBe(3);
  });

  it('reorder swaps chain order', () => {
    const c = emptyConfig();
    insertFxForOutput(c, 0, 7); // SCALE
    insertFxForOutput(c, 0, 6); // TRANSPOSE
    let chain = chainForOutput(c, 0);
    expect(chain.map((e) => e.name)).toEqual(['SCALE', 'TRANSPOSE']);
    // move the second (TRANSPOSE) earlier
    moveFxInChain(c, chain[1]!.fxLine, -1);
    chain = chainForOutput(c, 0);
    expect(chain.map((e) => e.name)).toEqual(['TRANSPOSE', 'SCALE']);
  });

  it('remove frees the slot', () => {
    const c = emptyConfig();
    const s = insertFxForOutput(c, 0, 7)!;
    expect(usedFxCount(c)).toBe(1);
    removeFx(c, s);
    expect(usedFxCount(c)).toBe(0);
    expect(chainForOutput(c, 0)).toHaveLength(0);
  });

  it('insert returns null when the 8-slot pool is full', () => {
    const c = emptyConfig();
    for (let i = 0; i < 8; i++) expect(insertFxForOutput(c, 0, 7)).not.toBeNull();
    expect(freeFxSlots(c)).toHaveLength(0);
    expect(insertFxForOutput(c, 0, 7)).toBeNull();
  });

  it('chains for different outputs stay independent', () => {
    const c = emptyConfig();
    insertFxForOutput(c, 0, 7);  // CV1
    insertFxForOutput(c, 8, 9);  // GATE1 (DELAY)
    expect(chainForOutput(c, 0)).toHaveLength(1);
    expect(chainForOutput(c, 8)).toHaveLength(1);
    expect(chainForOutput(c, 0)[0]!.name).toBe('SCALE');
    expect(chainForOutput(c, 8)[0]!.name).toBe('DELAY');
  });
});
