import { describe, it, expect } from 'vitest';
import { classifyDomain } from '../src/model/control-kind';
import modelJson from '../src/model/model.json';

describe('domain → control classifier (board 6)', () => {
  it('maps representative domains to the agreed kinds', () => {
    expect(classifyDomain('percent_menu').kind).toBe('slider');
    expect(classifyDomain('div_menu').kind).toBe('division-grid');      // board 8: base × feel grid
    expect(classifyDomain('lfo_div_menu').kind).toBe('division-grid');  // board 8: base × feel grid
    expect(classifyDomain('lfo_type_menu').kind).toBe('wave-chips');    // board 8: drawn shapes
    expect(classifyDomain('swing_menu').kind).toBe('wave-chips');    // board 8 stage 2
    expect(classifyDomain('seq_dir_menu').kind).toBe('wave-chips');  // board 8 stage 2
    expect(classifyDomain('oct_menu').kind).toBe('segmented');       // ≤6 ordinal flipped
    expect(classifyDomain('range_oct_menu').kind).toBe('segmented'); // ≤6 ordinal flipped
    expect(classifyDomain('ocatves_menu').kind).toBe('slider');      // n=9 stays slider
    expect(classifyDomain('ch_menu').kind).toBe('channel-grid');
    expect(classifyDomain('range_cv_menu').kind).toBe('voltage-chips');
    expect(classifyDomain('dest_note_menu').kind).toBe('jack-chips');
    expect(classifyDomain('note_menu').kind).toBe('keyboard');
    expect(classifyDomain('onoff_menu').kind).toBe('toggle');
    expect(classifyDomain('tables_menu').kind).toBe('dropdown');
  });

  it('chip kinds span two columns, others one', () => {
    expect(classifyDomain('fx_dest_menu_cv').span).toBe(2);
    expect(classifyDomain('range_gate_menu').span).toBe(2);
    expect(classifyDomain('percent_menu').span).toBe(1);
    expect(classifyDomain('ch_menu').span).toBe(1); // grid spans ROWS, not cols
    expect(classifyDomain('div_menu').span).toBe(2);      // 8-10 columns won't fit a 240px track
    expect(classifyDomain('lfo_type_menu').span).toBe(1); // seven chips wrap to two rows in one column
  });

  it('never throws for any domain a real param uses', () => {
    const m = modelJson as any;
    const used = new Set<string>();
    for (const fam of ['cv', 'gate', 'fx']) for (const mode of m.families[fam]) for (const p of mode.params) used.add(p.domain);
    for (const dom of used) expect(() => classifyDomain(dom)).not.toThrow();
    // tables_menu (24 scale names, no order to exploit) is the single surviving dropdown among params.
    const dropdowns = [...used].filter((d) => classifyDomain(d).kind === 'dropdown').sort();
    expect(dropdowns).toEqual(['tables_menu']);
  });
});
