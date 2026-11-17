// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { renderModeTag } from '../src/ui/inspector';
import { emptyConfig, lineWithDefaults, lineLabel } from '../src/model/model';

function seeded(): Store {
  const s = new Store();
  const c = emptyConfig('seed');
  c.lines[0] = lineWithDefaults('cv', 1); // CV 1 note
  s.replaceConfig(c, 'read');
  return s;
}

describe('mode tag', () => {
  it('is a real <button> (not a <select>: a native select loses trusted clicks to the OS picker)', () => {
    const tag = renderModeTag(seeded(), 0);
    expect(tag.tagName).toBe('BUTTON');
    expect(tag.querySelector('select')).toBeNull();
    expect(tag.getAttribute('aria-haspopup')).toBe('listbox');
  });

  it('names the mode accessibly, shows icon + name, no ":" separator', () => {
    const tag = renderModeTag(seeded(), 0);
    expect(tag.getAttribute('aria-label')).toBe(`${lineLabel(0)} mode: Note`);
    expect(tag.querySelector('.mode-tag-ic')).toBeTruthy();
    expect(tag.querySelector('.mode-tag-name')!.textContent).toBe('Note');
    expect(tag.querySelector('.mode-tag-sep')).toBeNull();
  });

  it('opens the family-grouped menu on click', () => {
    document.body.innerHTML = '';
    const tag = renderModeTag(seeded(), 0);
    document.body.appendChild(tag);
    tag.click();
    const menu = document.querySelector('.mode-menu');
    expect(menu).toBeTruthy();
    expect(menu!.querySelectorAll('.mode-menu-item').length).toBe(15); // all CV modes
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  });
});
