import { describe, it, expect } from 'vitest';
import { diffConfigs, emptyConfig, lineWithDefaults, meaningfulByteIndices } from '../src/model/model';

describe('send-verify compares only mode-meaningful bytes (hardware round-trip finding)', () => {
  it('meaningfulByteIndices is byte 0 plus the mode params; OFF is just [0]', () => {
    expect(meaningfulByteIndices('cv', 0)).toEqual([0]);                 // OFF: no params
    const note = meaningfulByteIndices('cv', 1);
    expect(note[0]).toBe(0);
    expect(note.length).toBeGreaterThan(1);
  });

  it('a difference in a PADDING byte does not flag the line; a MEANINGFUL byte does', () => {
    const a = emptyConfig('a');
    a.lines[0] = lineWithDefaults('cv', 1); // CV1 note
    const b = structuredClone(a);

    // pick a byte index the mode does NOT use (padding) and one it does (a param)
    const used = new Set(meaningfulByteIndices('cv', 1));
    const padding = [...Array(9).keys()].find((j) => !used.has(j))!;
    const param = meaningfulByteIndices('cv', 1)[1]!;

    b.lines[0]!.bytes[padding] = 42;   // padding differs — must be IGNORED
    expect(diffConfigs(a, b).lines).toEqual([]);

    b.lines[0]!.bytes[padding] = a.lines[0]!.bytes[padding]!; // reset
    b.lines[0]!.bytes[param] = (a.lines[0]!.bytes[param]! + 1); // a real value the module might clamp
    expect(diffConfigs(a, b).lines.length).toBe(1);            // meaningful difference IS caught
  });
});
