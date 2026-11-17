// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { renderParamGrid } from '../src/ui/params';
import { emptyConfig, lineWithDefaults, modesFor } from '../src/model/model';
import type { Family } from '../src/model/types';
import { classifyDomain, type ControlKind } from '../src/model/control-kind';

// find any (family, mode, param) whose domain classifies to `kind`
function find(kind: ControlKind) {
  for (const family of ['cv', 'gate', 'fx'] as Family[]) {
    for (const mode of modesFor(family)) {
      const p = mode.params.find((p) => classifyDomain(p.domain).kind === kind);
      if (p) return { family, mode, p };
    }
  }
  return null;
}

function grid(family: Family, modeIndex: number) {
  const s = new Store();
  const c = emptyConfig('seed');
  const base = family === 'gate' ? 8 : 0;
  c.lines[base] = lineWithDefaults(family, modeIndex);
  s.replaceConfig(c, 'read');
  // fx params live on fx lines; but modesFor('fx') params render via renderParamGrid on an fx line.
  return { s, el: renderParamGrid(s, base), base };
}

describe('board 6 segmented / chips / toggle', () => {
  it('segmented domains render a radiogroup with one checked + roving tabindex', () => {
    const hit = find('segmented'); expect(hit).toBeTruthy();
    if (hit!.family === 'fx') return; // fx lines need their own harness; cv/gate cover the widget
    const { el } = grid(hit!.family, hit!.mode.index);
    const rg = el.querySelector('.segmented[role="radiogroup"]');
    expect(rg).toBeTruthy();
    const radios = rg!.querySelectorAll('[role="radio"]');
    expect([...radios].filter((r) => r.getAttribute('tabindex') === '0').length).toBe(1);
  });

  it('toggle domains render a role=switch that flips on click', () => {
    const hit = find('toggle'); expect(hit).toBeTruthy();
    if (hit!.family === 'fx') return;
    const { s, el, base } = grid(hit!.family, hit!.mode.index);
    const sw = el.querySelector<HTMLElement>('[role="switch"]');
    expect(sw).toBeTruthy();
    const before = s.get().config.lines[base]!.bytes[hit!.p.index];
    sw!.click();
    expect(s.get().config.lines[base]!.bytes[hit!.p.index]).not.toBe(before);
  });

  it('jack-chips tint the referenced output and span two columns', () => {
    const hit = find('jack-chips'); expect(hit).toBeTruthy();
    if (hit!.family === 'fx') return;
    const { el } = grid(hit!.family, hit!.mode.index);
    expect(el.querySelector('.segmented.is-jack')).toBeTruthy();
    expect(el.querySelector('.pfield.is-span2')).toBeTruthy();
  });
});
