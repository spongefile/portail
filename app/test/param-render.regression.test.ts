// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { renderParamGrid } from '../src/ui/params';
import { emptyConfig, lineWithDefaults, modesFor, labelFor } from '../src/model/model';
import type { Family } from '../src/model/types';

/**
 * Regression for the labelFor/referencedJackColor crash: model.json label arrays are mixed
 * string/number, and a numeric label leaking out as a number blew up valueLabel.trim() in
 * referencedJackColor — crashing the whole rack (and with it presets/globals/mod-matrix), so #2
 * looked broken. Expand one output per mode and sweep every value; all must render and be strings.
 */
describe('labelFor never returns a non-string; every mode renders its param grid', () => {
  it('labelFor is a string for every value of every parameter (cv/gate/fx)', () => {
    for (const family of ['cv', 'gate', 'fx'] as Family[]) {
      for (const mode of modesFor(family)) {
        for (const p of mode.params) {
          const hi = Math.min(p.wireMax, p.max);
          for (let v = p.min; v <= hi; v++) {
            expect(typeof labelFor(p, v)).toBe('string');
          }
        }
      }
    }
  });

  it('renders the param grid for every CV and gate output mode without throwing', () => {
    for (const [family, base] of [['cv', 0], ['gate', 8]] as const) {
      for (const mode of modesFor(family)) {
        const s = new Store();
        const c = emptyConfig('seed');
        c.lines[base] = lineWithDefaults(family, mode.index);
        s.replaceConfig(c, 'read');
        expect(() => renderParamGrid(s, base)).not.toThrow();
      }
    }
  });
});
