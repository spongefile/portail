import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { chainForOutput } from '../src/model/fx';
import { emptyConfig, lineWithDefaults, modeByIndex, modesFor } from '../src/model/model';

function fxIndex(name: string): number {
  return modesFor('fx').find((x) => x.name === name)!.index;
}
function seeded(): Store {
  const s = new Store(); const c = emptyConfig('x');
  c.lines[4] = lineWithDefaults('cv', 1); // CV5 (line 4) NOTE
  s.replaceConfig(c, 'read'); s.setDeviceConfig(c); s.setSelectedLine(4);
  return s;
}

describe('FX editor interaction fixes', () => {
  it('#1 changing an FX effect keeps its target output', () => {
    const s = seeded();
    const fx = s.insertFx(4)!;               // FX on CV5 (target index 4)
    expect(s.get().config.lines[fx]!.bytes[1]).toBe(4);
    s.setLineMode(fx, fxIndex('SCALE'));     // change effect
    expect(s.get().config.lines[fx]!.bytes[1]).toBe(4); // still targets CV5, not 0
  });

  it('#2 reordering keeps the open editor on the SAME effect', () => {
    const s = seeded();
    const a = s.insertFx(4, fxIndex('SCALE'))!;
    s.insertFx(4, fxIndex("TRANSPOSE"));
    s.setExpandedFx(a);                       // editing SCALE
    const chainBefore = chainForOutput(s.get().config, 4).map(e=>e.key);
    s.reorderFx(a, 1);                        // move SCALE to the end
    const exp = s.get().expandedFx!;
    expect(modeByIndex('fx', s.get().config.lines[exp]!.mode)!.name).toBe('SCALE'); // follows identity
    expect(chainForOutput(s.get().config, 4).map(e=>e.key)).not.toEqual(chainBefore); // did reorder
  });

  it('#3 retargeting an FX follows it to the new output with editor open', () => {
    const s = seeded();
    s.get().config.lines[5] = lineWithDefaults('cv', 1); // CV6 exists (line 5)
    const fx = s.insertFx(4)!;
    s.setExpandedFx(fx);
    s.retargetFx(fx, 5); // move to CV6 (target index 5 = CV6/line5)
    expect(s.get().selectedLine).toBe(5);          // followed
    expect(s.get().expandedFx).toBe(fx);           // editor still open
    expect(chainForOutput(s.get().config, 5).some(e=>e.fxLine===fx)).toBe(true);
  });

  it('#5 removing the open FX clears expandedFx (no stale reopen)', () => {
    const s = seeded();
    const fx = s.insertFx(4)!;
    s.setExpandedFx(fx);
    s.removeFxSlot(fx);
    expect(s.get().expandedFx).toBeNull();
  });
});
