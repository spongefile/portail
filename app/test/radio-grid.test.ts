// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { renderParamGrid } from '../src/ui/params';
import { emptyConfig, lineWithDefaults, modesFor } from '../src/model/model';
import { classifyDomain } from '../src/model/control-kind';

function channelCase() {
  for (const mode of modesFor('cv')) {
    const p = mode.params.find((p) => classifyDomain(p.domain).kind === 'channel-grid');
    if (p) return mode;
  }
  throw new Error('no channel param');
}

describe('board 6 channel grid', () => {
  it('is a compact menu button that opens the 4×4 grid as a popover, commits on pick', () => {
    document.body.innerHTML = '';
    const mode = channelCase();
    const s = new Store();
    const c = emptyConfig('seed');
    c.lines[0] = lineWithDefaults('cv', mode.index);
    s.replaceConfig(c, 'read');
    const grid = renderParamGrid(s, 0);
    document.body.appendChild(grid);

    // The channel field itself is a compact button, not an inline grid: no radiogroup and no
    // two-row field for it inside the param grid.
    const btn = grid.querySelector<HTMLButtonElement>('.field-menu-btn')!;
    expect(btn).toBeTruthy();
    expect(btn.getAttribute('aria-haspopup')).toBe('listbox');
    const chField = btn.closest('.pfield')!;
    expect(chField.querySelector('[role="radiogroup"]')).toBeNull();
    expect(chField.classList.contains('is-rowspan2')).toBe(false);

    const before = document.querySelectorAll('[role="radiogroup"]').length;
    btn.click();
    const groups = document.querySelectorAll('[role="radiogroup"]');
    expect(groups.length).toBe(before + 1); // the popover's grid appears
    const popover = document.querySelector('.mode-menu [role="radiogroup"]')!;
    const cells = popover.querySelectorAll('[role="radio"]');
    expect(cells.length).toBe(16);
    expect([...cells].filter((c) => c.getAttribute('aria-checked') === 'true').length).toBe(1);

    const p = mode.params.find((pp) => classifyDomain(pp.domain).kind === 'channel-grid')!;
    (cells[5] as HTMLElement).click();
    expect(s.get().config.lines[0]!.bytes[p.index]).toBe(5);
    expect(document.querySelector('.mode-menu')).toBeNull(); // popover closed on pick
  });
});
