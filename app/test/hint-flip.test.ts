// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { renderRack } from '../src/ui/rack';
import { emptyConfig, lineWithDefaults } from '../src/model/model';

// jsdom returns 0 for all rects, so the overhang condition (fr.bottom+3+need > limit) is trivially
// true whenever a container resolves — which lets us assert positionHint RUNS on focus and resolves
// the .rack-band as the container (the two things the flip-above depended on).
describe('hint flip-above wiring', () => {
  it('focusing a control inside the band runs positionHint and it resolves .rack-band', () => {
    const s = new Store();
    const c = emptyConfig('seed');
    c.lines[0] = lineWithDefaults('cv', 1);
    s.replaceConfig(c, 'read');
    s.setSelectedLine(0);
    document.body.innerHTML = '';
    document.body.appendChild(renderRack(s));
    const field = document.querySelector('.pfield')!;
    expect(field.closest('.rack-band, .panel-body')!.classList.contains('rack-band')).toBe(true);
    const control = field.querySelector<HTMLElement>('.pslider-input, [role="radio"], [role="switch"], .note-trigger, .field-menu-btn, select, button')!;
    control.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(field.classList.contains('hint-above')).toBe(true); // positionHint ran on focusin
  });
});
