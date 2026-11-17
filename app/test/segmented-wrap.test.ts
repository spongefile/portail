// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { renderParamGrid } from '../src/ui/params';
import { emptyConfig, lineWithDefaults, modesFor } from '../src/model/model';
import type { Family } from '../src/model/types';

describe('board 6 segmented wraps instead of clipping', () => {
  it('a long-label segmented domain wraps to two rows (is-wrap + is-rowspan2)', () => {
    // group_menu / vel_dest_menu are the long ones; find whichever mode carries one
    let found: { family: Family; modeIndex: number } | null = null;
    for (const family of ['cv', 'gate'] as Family[]) {
      for (const mode of modesFor(family)) {
        if (mode.params.some((p) => p.domain === 'group_menu' || p.domain === 'vel_dest_menu')) {
          found = { family, modeIndex: mode.index }; break;
        }
      }
      if (found) break;
    }
    expect(found).toBeTruthy();
    const s = new Store();
    const c = emptyConfig('seed');
    const base = found!.family === 'gate' ? 8 : 0;
    c.lines[base] = lineWithDefaults(found!.family, found!.modeIndex);
    s.replaceConfig(c, 'read');
    const grid = renderParamGrid(s, base);
    expect(grid.querySelector('.segmented.is-wrap')).toBeTruthy();
    // its field takes two grid rows so the wrap has room without breaking the 63px rhythm
    const wrapField = [...grid.querySelectorAll('.pfield')].find((f) => f.querySelector('.segmented.is-wrap'));
    expect(wrapField!.classList.contains('is-rowspan2')).toBe(true);
  });
});
