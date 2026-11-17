// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { renderParamGrid } from '../src/ui/params';
import { emptyConfig, lineWithDefaults, modesFor } from '../src/model/model';

// FX lines live at index >= 16 (familyOfLine). Closes the gap the testing session flagged: it swept
// CV and GATE param fields but not FX-line ones. Same renderParamGrid path, so board 6 should hold.
describe('board 6 controls render on FX-line param fields', () => {
  it('every FX mode renders its param grid with 63px board-6 fields and no stray <select>', () => {
    for (const mode of modesFor('fx')) {
      if (mode.params.length === 0) continue;
      const s = new Store();
      const c = emptyConfig('seed');
      c.lines[0] = lineWithDefaults('cv', 1); // an output to host the FX chain
      s.replaceConfig(c, 'read');
      const fxLine = s.insertFx(0, mode.index);
      expect(fxLine).not.toBeNull();
      let grid!: HTMLElement;
      expect(() => { grid = renderParamGrid(s, fxLine!); }).not.toThrow();
      const fields = grid.querySelectorAll('.pfield');
      // Target is deliberately absent: the chain you opened implies it (changing it moved
        // the FX to another chain mid-edit). Every other param gets a field.
        expect(fields.length).toBe(mode.params.filter((p) => p.id !== 'target').length);
      // no parameter renders a raw <select> unless its domain is the lone dropdown (tables_menu)
      grid.querySelectorAll('select.pfield-control').forEach((sel) => {
        expect(sel.querySelectorAll('option').length).toBeGreaterThan(0);
      });
    }
  });
});
