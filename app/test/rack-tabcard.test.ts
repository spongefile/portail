// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { renderRack } from '../src/ui/rack';
import { emptyConfig, lineWithDefaults } from '../src/model/model';

function store(sel: number | null): Store {
  const s = new Store();
  const c = emptyConfig('seed');
  c.lines[0] = lineWithDefaults('cv', 1);   // CV 1 note
  c.lines[8] = lineWithDefaults('gate', 1); // GATE 1
  s.replaceConfig(c, 'read');
  s.setSelectedLine(sel);
  return s;
}

describe('#3 tab-card rack', () => {
  it('nothing selected: 16 cards, no tab, no band, one grid', () => {
    const el = renderRack(store(null));
    expect(el.querySelectorAll('.rack-grid').length).toBe(1);
    expect(el.querySelectorAll('.output-jack').length).toBe(16);
    expect(el.querySelector('.output-jack.is-tab')).toBeNull();
    expect(el.querySelector('.rack-band')).toBeNull();
  });

  it('CV selected: its card is a tab, band is CV-cased and immediately follows the row', () => {
    const el = renderRack(store(0));
    const tab = el.querySelector('.output-jack.is-tab')!;
    expect(tab.id).toBe('jack-0');
    const band = el.querySelector('.rack-band')!;
    expect(band).toBeTruthy();
    expect(band.classList.contains('is-cv-tab')).toBe(true);
    expect(band.classList.contains('is-gate-tab')).toBe(false);
    // exactly one band
    expect(el.querySelectorAll('.rack-band').length).toBe(1);
  });

  it('GATE selected: band mirrors to the right column', () => {
    const el = renderRack(store(8));
    const band = el.querySelector('.rack-band')!;
    expect(band.classList.contains('is-gate-tab')).toBe(true);
  });

  it('column headers own their cards via aria-owns (survives row-major order)', () => {
    const el = renderRack(store(null));
    const heads = el.querySelectorAll('.rack-head-cell[role="group"]');
    expect(heads.length).toBe(2);
    expect(heads[0]!.getAttribute('aria-owns')).toBe('jack-0 jack-1 jack-2 jack-3 jack-4 jack-5 jack-6 jack-7');
    expect(heads[1]!.getAttribute('aria-owns')).toBe('jack-8 jack-9 jack-10 jack-11 jack-12 jack-13 jack-14 jack-15');
  });

  it('two columns: the band comes after BOTH cards of the row (grid spans 1/-1)', () => {
    // jsdom has no matchMedia, so renderRack takes the two-column path.
    const el = renderRack(store(0));
    const cards = [...el.querySelectorAll('.rack-grid > .output-jack, .rack-grid > .rack-band')];
    expect(cards[0]!.id).toBe('jack-0');   // open CV tab
    expect(cards[1]!.id).toBe('jack-8');   // paired GATE card
    expect(cards[2]!.id).toBe('band-0');   // band after the pair
  });

  it('one column: the band is the open tab immediate sibling, so the pair cannot overlap it', () => {
    const g = globalThis as unknown as { matchMedia?: (q: string) => object };
    const orig = g.matchMedia;
    g.matchMedia = (q: string) => ({ matches: /max-width:\s*720px/.test(q), media: q, addEventListener() {}, removeEventListener() {} });
    try {
      const el = renderRack(store(0));
      const band = el.querySelector('#band-0')!;
      expect(band.previousElementSibling!.id).toBe('jack-0');   // band directly after the open CV tab
      expect(band.nextElementSibling!.id).toBe('jack-8');       // GATE card follows the band, not squeezed above it
      const el2 = renderRack(store(8));
      expect(el2.querySelector('#band-8')!.previousElementSibling!.id).toBe('jack-8');
    } finally {
      if (orig === undefined) delete g.matchMedia;
      else g.matchMedia = orig;
    }
  });

});
