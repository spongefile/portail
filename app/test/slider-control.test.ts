// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { renderParamGrid } from '../src/ui/params';
import { emptyConfig, lineWithDefaults, modesFor } from '../src/model/model';
import { classifyDomain } from '../src/model/control-kind';

// find a cv mode with at least one slider-domain param
function sliderCase() {
  for (const mode of modesFor('cv')) {
    const p = mode.params.find((p) => classifyDomain(p.domain).kind === 'slider');
    if (p) return { mode, p };
  }
  throw new Error('no slider param found');
}

describe('board 6 slider dispatch', () => {
  it('a slider-domain param renders a .pslider and commits on release, not per input', () => {
    const { mode, p } = sliderCase();
    const s = new Store();
    const c = emptyConfig('seed');
    c.lines[0] = lineWithDefaults('cv', mode.index);
    s.replaceConfig(c, 'read');
    const grid = renderParamGrid(s, 0);
    const slider = grid.querySelector<HTMLInputElement>('.pslider-input');
    expect(slider).toBeTruthy();
    expect(slider!.getAttribute('aria-label')).toBe(p.label);
    expect(slider!.getAttribute('aria-valuetext')).toBeTruthy(); // single-source value text

    const before = s.get().config.lines[0]!.bytes[p.index];
    const cur = Number(slider!.value);
    const target = cur === 0 ? Number(slider!.max) : 0; // guaranteed different index
    // input alone must NOT commit (avoids mid-drag re-render)
    slider!.value = String(target);
    slider!.dispatchEvent(new Event('input'));
    expect(s.get().config.lines[0]!.bytes[p.index]).toBe(before);
    // change (release) commits the new value
    slider!.dispatchEvent(new Event('change'));
    expect(s.get().config.lines[0]!.bytes[p.index]).not.toBe(before);
  });

  it('the default notch is hidden when the value equals the default, shown otherwise', () => {
    const { mode, p } = sliderCase();
    const build = (v: number) => {
      const s = new Store();
      const c = emptyConfig('seed');
      c.lines[0] = lineWithDefaults('cv', mode.index);
      c.lines[0]!.bytes[p.index] = v;
      s.replaceConfig(c, 'read');
      return renderParamGrid(s, 0).querySelector('.pslider')!;
    };
    // at default → no notch
    expect(build(p.default).querySelector('.pslider-notch')).toBeNull();
    // off default → notch present
    const off = p.default === p.min ? Math.min(p.wireMax, p.max) : p.min;
    expect(build(off).querySelector('.pslider-notch')).toBeTruthy();
  });

});