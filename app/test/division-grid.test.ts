// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { divisionGrid, waveChipContent } from '../src/ui/controls';

// The harder of the two real domains: 32/1 and 16/1 exist straight-only, so the triplet and dotted
// rows start two columns in, and dotted also lacks 1/32 — the ragged corner.
const LFO_DIV = ['32/1','16/1','4/1','2/1','1/1','1/2','1/4','1/8','1/16','1/32',
  '4/1T','2/1T','1/1T','1/2T','1/4T','1/8T','1/16T','1/32T',
  '4/1.','2/1.','1/1.','1/2.','1/4.','1/8.','1/16.'];

function make(labels: string[], value = 0) {
  const g = divisionGrid({
    id: 'dv', options: labels.map((label, i) => ({ value: i, label })),
    value, ariaLabel: 'Division', onCommit: (v) => { committed = v; },
  });
  document.body.innerHTML = ''; document.body.appendChild(g);
  return g;
}
let committed = -1;

describe('division grid layout (parsed from labels, never hardcoded)', () => {
  it('lfo_div_menu: 10 columns, 3 feel rows, empties exactly where combinations are missing', () => {
    const g = make(LFO_DIV);
    const kids = [...g.children];
    // 3 rows × (1 header + 10 cells)
    expect(kids.length).toBe(3 * 11);
    const row = (r: number) => kids.slice(r * 11, r * 11 + 11);
    expect(row(0)[0]!.textContent).toBe('straight');
    expect(row(1)[0]!.textContent).toBe('triplet');
    expect(row(2)[0]!.textContent).toBe('dotted');
    const cellsOf = (r: number) => row(r).slice(1).map((c) => c.classList.contains('division-empty') ? null : c.textContent);
    expect(cellsOf(0)).toEqual(['32/1','16/1','4/1','2/1','1/1','1/2','1/4','1/8','1/16','1/32']);
    // triplet starts two columns in; dotted also misses the 1/32 corner
    expect(cellsOf(1)).toEqual([null,null,'4/1T','2/1T','1/1T','1/2T','1/4T','1/8T','1/16T','1/32T']);
    expect(cellsOf(2)).toEqual([null,null,'4/1.','2/1.','1/1.','1/2.','1/4.','1/8.','1/16.',null]);
  });

  it('div_menu shape: 8 columns and only the dotted 1/32 gap', () => {
    const DIV = LFO_DIV.filter((l) => !l.startsWith('32/1') && !l.startsWith('16/1'));
    const g = make(DIV);
    expect([...g.children].length).toBe(3 * 9);
    const empties = [...g.querySelectorAll('.division-empty')];
    expect(empties.length).toBe(1); // only 1/32-dotted missing
  });

  it('cells spell the feel for screen readers; straight cells stay bare', () => {
    const g = make(LFO_DIV);
    const byLabel = (t: string) => [...g.querySelectorAll('button')].find((b) => b.textContent === t)!;
    expect(byLabel('1/4T').getAttribute('aria-label')).toBe('1/4T (triplet)');
    expect(byLabel('1/4.').getAttribute('aria-label')).toBe('1/4. (dotted)');
    expect(byLabel('1/4').getAttribute('aria-label')).toBe('1/4');
  });

  it('arrows: down from 1/4 selects 1/4T (one cell, not fifteen stops); down from 32/1 scans past empties and stays', () => {
    const g = make(LFO_DIV, LFO_DIV.indexOf('1/4'));
    const key = (label: string, k: string) => {
      const b = [...g.querySelectorAll('button')].find((x) => x.textContent === label)!;
      b.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));
    };
    committed = -1; key('1/4', 'ArrowDown');
    expect(LFO_DIV[committed]).toBe('1/4T');
    committed = -1; key('32/1', 'ArrowDown'); // whole column below is empty → no move
    expect(committed).toBe(-1);
    committed = -1; key('1/4T', 'ArrowUp');
    expect(LFO_DIV[committed]).toBe('1/4');
  });
});

describe('wave chips', () => {
  it('known labels draw a shape AND keep the word; unknown labels degrade to the word', () => {
    const known = waveChipContent('noise') as HTMLElement;
    expect(known.querySelector('svg')).toBeTruthy();
    expect(known.textContent).toContain('noise');
    expect(known.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 34 20'); // NOT squeezed to 16×16
    const unknown = waveChipContent('someday-a-new-wave') as HTMLElement;
    expect(unknown.textContent).toBe('someday-a-new-wave');
  });
});

describe('direction + swing chips (stage 2)', () => {
  it('direction: all four labels draw arrows; unknown degrades to the word', async () => {
    const { dirChipContent } = await import('../src/ui/controls');
    for (const l of ['forward', 'backward', 'pendulum', 'random']) {
      const n = dirChipContent(l) as HTMLElement;
      expect(n.querySelector('svg'), l).toBeTruthy();
      expect(n.textContent).toContain(l);
    }
    expect((dirChipContent('sideways') as HTMLElement).querySelector('svg')).toBeNull();
  });

  it('swing: off-beats sit even at OFF and crowd the next on-beat at 90%; on-beats never move', async () => {
    const { swingChipContent } = await import('../src/ui/controls');
    const path = (l: string) => (swingChipContent(l) as HTMLElement).querySelector('path')!.getAttribute('d')!;
    const ON = 'M2 2 V14 M10 2 V14 M18 2 V14 M26 2 V14';
    expect(path('OFF')).toBe(`${ON} M6.0 6 V14 M22.0 6 V14`);   // even eighths
    expect(path('90%')).toBe(`${ON} M9.2 6 V14 M25.2 6 V14`);   // displaced toward the next beat
    expect(path('55%')).toContain('M6.4 6');                     // proportional, parsed from the label
    // a label that isn't OFF or a percentage degrades to the word
    expect((swingChipContent('weird') as HTMLElement).querySelector('svg')).toBeNull();
  });
});
