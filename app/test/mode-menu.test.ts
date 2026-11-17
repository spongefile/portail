// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { openModeMenu } from '../src/ui/mode-menu';
import { modesFor } from '../src/model/model';
import { familyOfKey, MODE_FAMILIES } from '../src/model/families';

function open(family: 'cv' | 'gate', current = 0) {
  document.body.innerHTML = '<span id="tag" class="mode-tag"></span>';
  const tag = document.getElementById('tag')!;
  const picks: number[] = [];
  openModeMenu(tag, family, current, (v) => picks.push(v));
  return { tag, picks, menu: document.querySelector('.mode-menu')! };
}

describe('mode menu popover', () => {
  it('lists every mode exactly once, Off first and alone', () => {
    for (const fam of ['cv', 'gate'] as const) {
      const { menu } = open(fam);
      const items = [...menu.querySelectorAll('.mode-menu-item')];
      const modes = modesFor(fam);
      expect(items.length).toBe(modes.length);
      const label = (i: Element) => i.childNodes[i.childNodes.length - 1]!.textContent;
      const labels = items.map(label);
      expect(new Set(labels).size).toBe(modes.length);
      const firstGroup = menu.querySelector('.mode-menu-fam')!;
      expect(firstGroup.querySelectorAll('.mode-menu-item').length).toBe(1); // Off, unbadged
      expect(firstGroup.querySelector('.mode-menu-head')).toBeNull();
      document.body.innerHTML = '';
    }
  });

  it("groups in Tina's order: clock above gate, pitch above expression", () => {
    const { menu } = open('gate');
    const heads = [...menu.querySelectorAll('.mode-menu-head')].map((h) => h.textContent);
    const order = ['Clock', 'Gate / Trigger', 'Pitch', 'Expression', 'Modulation'].filter((l) => heads.includes(l));
    expect(heads).toEqual(order);
  });

  it('every item sits under the header of its own family', () => {
    const { menu } = open('gate');
    const modes = modesFor('gate');
    for (const fam of [...menu.querySelectorAll('.mode-menu-fam')].slice(1)) {
      const head = fam.querySelector('.mode-menu-head')!.textContent;
      for (const item of fam.querySelectorAll('.mode-menu-item')) {
        const m = modes.find((x) => x.display === item.childNodes[item.childNodes.length - 1]!.textContent)!;
        expect(MODE_FAMILIES[familyOfKey(m.key)].label).toBe(head);
      }
    }
  });

  it('CC recorder sits directly under MIDI CC', () => {
    const { menu } = open('cv');
    const labels = [...menu.querySelectorAll('.mode-menu-item')].map((i) => i.childNodes[i.childNodes.length - 1]!.textContent);
    expect(labels.indexOf('CC recorder')).toBe(labels.indexOf('MIDI CC') + 1);
  });

  it('marks the current mode and commits + closes on pick', () => {
    const { picks, menu } = open('gate', 1);
    const cur = menu.querySelectorAll('.mode-menu-item.is-cur');
    expect(cur.length).toBe(1);
    expect(cur[0]!.getAttribute('aria-selected')).toBe('true');
    (menu.querySelector('.mode-menu-item') as HTMLButtonElement).click();
    expect(picks.length).toBe(1);
    expect(document.querySelector('.mode-menu')).toBeNull(); // closed
  });

  it('Escape closes without committing; a second open replaces the first, never stacks', () => {
    const { tag, picks } = open('cv', 0);
    openModeMenu(tag, 'cv', 0, () => picks.push(-1));
    expect(document.querySelectorAll('.mode-menu').length).toBe(1);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.mode-menu')).toBeNull();
    expect(picks.length).toBe(0);
  });

  it('survives a rack re-render (the anchor being removed does not remove the menu)', () => {
    open('gate', 0);
    document.getElementById('tag')!.remove(); // simulates renderRack rebuilding the card mid-pick
    expect(document.querySelector('.mode-menu')).toBeTruthy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(document.querySelector('.mode-menu')).toBeNull();
  });
});
