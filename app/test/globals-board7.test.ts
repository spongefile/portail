// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { renderGlobals } from '../src/ui/inspector';
import { readGlobal, model } from '../src/model/model';
import { classifyDomain } from '../src/model/control-kind';

const gdef = (id: string) => model.globals.find((g: any) => g.id === id)!;

function mounted(): { s: Store; el: HTMLElement } {
  const s = new Store();
  document.body.innerHTML = '';
  const el = renderGlobals(s);
  document.body.appendChild(el);
  return { s, el };
}

describe('board 7 — globals get domain-driven controls', () => {
  it('sync_menu classifies as segmented, not toggle (internal/external are alternatives)', () => {
    expect(classifyDomain('sync_menu').kind).toBe('segmented');
  });

  it('renders the right control per global', () => {
    const { el } = mounted();
    expect(el.querySelector('#g-clock_running[role="switch"], [role="switch"]#g-clock_running')).toBeTruthy(); // toggle
    expect(el.querySelector('#g-tempo.pslider-input, .pslider-input#g-tempo')).toBeTruthy();                    // slider
    // clock source is a segmented radiogroup
    const seg = el.querySelector('.segmented[aria-label="Clock source"]');
    expect(seg?.getAttribute('role')).toBe('radiogroup');
    // global CC channel is a 16-cell grid on 1..16 (not 0..15)
    const grid = el.querySelector('.radio-grid[aria-label="Global CC channel"]')!;
    expect(grid.querySelectorAll('[role="radio"]').length).toBe(16);
    expect(grid.querySelector('#g-global_cc_channel-cell-1')).toBeTruthy();  // value 1 exists
    expect(grid.querySelector('#g-global_cc_channel-cell-0')).toBeNull();    // no 0-based channel
  });

  it('"Factory CC map" is the inverted label AND flips the correct WIRE byte', () => {
    const { s, el } = mounted();
    const g = gdef('disable_default_cc_map');
    // relabelled in the UI
    expect([...el.querySelectorAll('.pfield-name')].some((n) => n.textContent === 'Factory CC map')).toBe(true);

    // byte 0 = map ACTIVE → switch reads on
    expect(readGlobal(s.get().config.globals, g)).toBe(0);
    const sw = el.querySelector('#g-disable_default_cc_map[role="switch"]') as HTMLButtonElement;
    expect(sw.getAttribute('aria-checked')).toBe('true'); // on = active

    sw.click(); // turn the map OFF → byte must become 1 (disabled), not 0
    expect(readGlobal(s.get().config.globals, g)).toBe(1);

    // re-render and flip back → byte 0
    document.body.innerHTML = '';
    const el2 = renderGlobals(s); document.body.appendChild(el2);
    (el2.querySelector('#g-disable_default_cc_map[role="switch"]') as HTMLButtonElement).click();
    expect(readGlobal(s.get().config.globals, g)).toBe(0);
  });

  it('the Factory CC map tooltip speaks the NEW polarity, not the old "Turns off" doc', () => {
    const { el } = mounted();
    const field = [...el.querySelectorAll('.pfield')].find((f) => f.querySelector('.pfield-name')?.textContent === 'Factory CC map')!;
    const title = (field as HTMLElement).title;
    expect(title).not.toMatch(/turns off the factory/i); // the un-inverted spec doc
    expect(title.toLowerCase()).toContain('turn it off so only your own rows apply');
  });

});