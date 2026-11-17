// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { renderParamGrid } from '../src/ui/params';
import { emptyConfig, lineWithDefaults } from '../src/model/model';

function seeded(): Store {
  const s = new Store();
  const c = emptyConfig('seed');
  c.lines[0] = lineWithDefaults('cv', 1); // CV 1 note (has params)
  s.replaceConfig(c, 'read');
  return s;
}

describe('#4 field anatomy', () => {
  it('each field is a .pfield with the value on the label row and no range/hint lines', () => {
    const grid = renderParamGrid(seeded(), 0);
    const fields = grid.querySelectorAll('.pfield');
    expect(fields.length).toBeGreaterThan(0);
    for (const f of fields) {
      // The head value is kept ONLY for the slider family (thumb is a position, not a value); other
      // controls show their own selection so the head value was redundant and is gone (Tina).
      const isSlider = !!f.querySelector('.pslider-input');
      expect(!!f.querySelector('.pfield-head .pfield-value')).toBe(isSlider);
      expect(f.querySelector('.field-meta')).toBeNull();                  // range/default line gone
      expect(f.querySelector('.field-hint')).toBeNull();                  // prose hint gone from layout
      expect(f.querySelector('.pfield-control')).toBeTruthy();            // control present
      expect(f.querySelector('.pfield-hint')).toBeTruthy();               // hint is an out-of-flow overlay
    }
  });

  it('hint has three reveal routes and the label is not a tab stop', () => {
    const grid = renderParamGrid(seeded(), 0);
    const field = grid.querySelector('.pfield')!;
    const hint = field.querySelector('.pfield-hint')!;
    const name = field.querySelector('.pfield-name')!;
    // route 3 (tap): label describes the overlay and toggles it, but is NOT a tab stop
    expect(name.getAttribute('aria-describedby')).toBe(hint.id);
    expect(name.getAttribute('tabindex')).toBe('-1');
    expect(field.classList.contains('hint-shown')).toBe(false);
    (name as HTMLElement).click();
    expect(field.classList.contains('hint-shown')).toBe(true); // tap reveals
    (name as HTMLElement).click();
    expect(field.classList.contains('hint-shown')).toBe(false); // tap again hides
  });


  it('the CONTROL (not just the label) is aria-describedby the hint overlay', () => {
    const grid = renderParamGrid(seeded(), 0);
    const field = grid.querySelector('.pfield')!;
    const hint = field.querySelector('.pfield-hint')!;
    // the focusable control carries the description (a slider input, a select, or a radiogroup)
    const described = field.querySelector('[aria-describedby="' + hint.id + '"]:not(.pfield-name)');
    expect(described).toBeTruthy();
  });


  it('Escape suppresses the hint without stealing focus (stays on the control, not body)', () => {
    document.body.innerHTML = '';
    document.body.appendChild(renderParamGrid(seeded(), 0));
    // focus the first focusable control in the grid (a slider input / radio / switch / trigger)
    const control = document.querySelector<HTMLElement>('.pslider-input, [role="radio"], [role="switch"], .note-trigger, select.pfield-control')!;
    control.focus();
    expect(document.activeElement).toBe(control);
    const field = control.closest('.pfield')!;
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(field.classList.contains('hint-suppressed')).toBe(true); // hint hidden
    expect(document.activeElement).toBe(control);                    // focus NOT dropped to body
  });


  it('a tap on the shown overlay dismisses it (absorbs its own click, not passed to the field below)', () => {
    document.body.innerHTML = '';
    document.body.appendChild(renderParamGrid(seeded(), 0));
    const field = document.querySelector('.pfield')!;
    const name = field.querySelector<HTMLElement>('.pfield-name')!;
    name.click();
    expect(field.classList.contains('hint-shown')).toBe(true);   // tap-revealed
    const hint = field.querySelector<HTMLElement>('.pfield-hint')!;
    hint.click();
    expect(field.classList.contains('hint-shown')).toBe(false);  // tap on overlay dismisses it
  });

});