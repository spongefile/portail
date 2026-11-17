// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { renderRack } from '../src/ui/rack';
import { emptyConfig, lineWithDefaults } from '../src/model/model';

function rack(sel: number | null) {
  const s = new Store();
  const c = emptyConfig('seed');
  c.lines[0] = lineWithDefaults('cv', 1);   // CV 1 note
  c.lines[8] = lineWithDefaults('gate', 1); // GATE 1
  s.replaceConfig(c, 'read');
  s.setSelectedLine(sel);
  return renderRack(s);
}

describe('tab controls on the card (mode tag + ? + disclosure)', () => {
  it('a closed card is a <button> disclosure trigger with aria-expanded=false and a decorative glyph', () => {
    const el = rack(null);
    const card = el.querySelector('#jack-0')!;
    expect(card.tagName).toBe('BUTTON');
    expect(card.getAttribute('aria-expanded')).toBe('false');
    expect(card.querySelector(':scope > .jack-disclosure-glyph[aria-hidden="true"]')).toBeTruthy();
  });

  it('the open tab is a <div> holding the mode control and a real disclosure', () => {
    const el = rack(0);
    const tab = el.querySelector('#jack-0.is-tab')!;
    expect(tab.tagName).toBe('DIV'); // a <select> can't live in a <button>
    expect(tab.querySelector('.mode-tag-btn')).toBeTruthy(); // mode control is on the card
    expect(tab.querySelector('.jack-help')).toBeTruthy();       // ? on the card
    const disc = tab.querySelector('.jack-disclosure')!;
    expect(disc.tagName).toBe('BUTTON');
    expect(disc.getAttribute('aria-expanded')).toBe('true');
    expect(disc.getAttribute('aria-controls')).toBe('band-0'); // controls the real band region
    expect(el.querySelector('#band-0[role="region"]')).toBeTruthy();
    // band-head is gone — no mode tag inside the band
    expect(el.querySelector('#band-0 .mode-tag-btn')).toBeNull();
  });

  it('a GATE tab puts its controls on the card too (no jumping to the band-left)', () => {
    const el = rack(8);
    const tab = el.querySelector('#jack-8.is-tab')!;
    expect(tab.querySelector('.mode-tag-btn')).toBeTruthy();
    expect(tab.querySelector('.jack-disclosure')!.getAttribute('aria-controls')).toBe('band-8');
  });
});
