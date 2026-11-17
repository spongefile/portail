// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { renderChainStrip } from '../src/ui/signalflow';
import { emptyConfig, lineWithDefaults } from '../src/model/model';

function seeded(): Store {
  const s = new Store();
  const c = emptyConfig('seed');
  c.lines[0] = lineWithDefaults('cv', 1); // CV1 NOTE
  s.replaceConfig(c, 'read'); s.setDeviceConfig(c);
  s.setSelectedLine(0);
  return s;
}

describe('signal-flow refactor (R1/R2/J2)', () => {
  it('inspector strip is editable and drops the endpoint jack + slot header (R2)', () => {
    const s = seeded();
    const fx = s.insertFx(0); // add one FX to CV1
    expect(fx).not.toBeNull();
    const strip = renderChainStrip(s, 0);
    expect(strip.querySelector('.fx-chip')).toBeTruthy();            // has the FX chip
    expect(strip.querySelector('.chain-insert')).toBeTruthy();       // has "+ insert FX"
    expect(strip.querySelector('.output-jack')).toBeNull();          // R2: no endpoint jack in the inspector strip
  });

  it('clicking a chip expands an inline FX editor, output stays selected (J2)', () => {
    const s = seeded();
    const fx = s.insertFx(0)!;
    s.setExpandedFx(fx);
    expect(s.get().selectedLine).toBe(0);                            // still the output, not the FX line
    const strip = renderChainStrip(s, 0);
    expect(strip.querySelector('.fx-inline-editor')).toBeTruthy();   // inline editor rendered
    s.setExpandedFx(fx);                                             // toggle closes it
    expect(s.get().expandedFx).toBeNull();
  });

});
