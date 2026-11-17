// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { gatedSlider } from '../src/ui/controls';

const opts = [{ value: 0, label: 'latch' }, ...Array.from({ length: 20 }, (_, i) => ({ value: i + 1, label: `${i + 1} ms` }))];

function build(value: number) {
  let committed = -99;
  const el = gatedSlider({ id: 'g', options: opts, value, defaultValue: 5, ariaLabel: 'Gate length',
    onLiveValue: () => {}, onCommit: (v) => { committed = v; } });
  return { el, get: () => committed };
}

describe('board 6 gated slider (length_menu latch vs timed)', () => {
  it('Latch shows only the segment (no duration slider)', () => {
    const { el } = build(0);
    expect(el.querySelector('[role="radiogroup"]')).toBeTruthy();
    expect(el.querySelector('.pslider')).toBeNull();
  });

  it('Timed shows the segment AND the slider', () => {
    const { el } = build(7);
    expect(el.querySelector('[role="radiogroup"]')).toBeTruthy();
    expect(el.querySelector('.pslider')).toBeTruthy();
  });

  it('Latch→Timed lands on a sane duration (not 0); Timed→Latch commits 0', () => {
    // from latch, pick the Timed segment → commits a non-zero default (10)
    const a = build(0);
    const timedRadio = [...a.el.querySelectorAll('[role="radio"]')].find((r) => r.getAttribute('aria-label') === 'Timed')!;
    (timedRadio as HTMLElement).click();
    expect(a.get()).toBe(10);

    // from timed, pick Latch → commits 0
    const b = build(7);
    const latchRadio = [...b.el.querySelectorAll('[role="radio"]')].find((r) => r.getAttribute('aria-label') === 'latch' || r.getAttribute('aria-label') === 'Latch')!;
    (latchRadio as HTMLElement).click();
    expect(b.get()).toBe(0);
  });
});
