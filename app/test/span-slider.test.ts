// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { clampSpan, spanSlider } from '../src/ui/controls';

const opts = Array.from({ length: 8 }, (_, i) => ({ value: i, label: `v${i}` }));

describe('clampSpan keeps low <= high without swapping identity', () => {
  it('leaves an ordered pair alone', () => expect(clampSpan(2, 5, 'lo')).toEqual([2, 5]));
  it('pins low to high when the low thumb overtakes', () => expect(clampSpan(6, 5, 'lo')).toEqual([5, 5]));
  it('pins high to low when the high thumb underruns', () => expect(clampSpan(2, 1, 'hi')).toEqual([2, 2]));
});

describe('spanSlider DOM', () => {
  it('reports both option values on input and never lets low pass high', () => {
    let got: [number, number] | null = null;
    const el = spanSlider({ id: 's', options: opts, min: 1, max: 6, fill: '#abc',
      onChange: (lo, hi) => { got = [lo, hi]; } });
    const lo = el.querySelector<HTMLInputElement>('#s-lo')!;
    const hi = el.querySelector<HTMLInputElement>('#s-hi')!;
    expect(lo.value).toBe('1'); expect(hi.value).toBe('6');

    // drag low past high (7 > 6) — it should pin to 6
    lo.value = '7';
    lo.dispatchEvent(new Event('input'));
    expect(got).toEqual([6, 6]);
    expect(lo.value).toBe('6');
  });

  it('paints the fill with the family colour it was given', () => {
    const el = spanSlider({ id: 't', options: opts, min: 0, max: 3, fill: 'var(--fam-gate)', onChange: () => {} });
    expect((el as HTMLElement).style.getPropertyValue('--fill')).toBe('var(--fam-gate)');
  });
});
