// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { renderModMatrix } from '../src/ui/modmatrix';
import { emptyConfig } from '../src/model/model';

function store(): Store {
  const s = new Store();
  s.replaceConfig(emptyConfig('seed'), 'read');
  return s;
}

describe('mod matrix shows only assigned rows (fixed-slot, no splice)', () => {
  it('a fresh config renders no rows, an empty-state hint, and an enabled Add button', () => {
    const s = store();
    const el = renderModMatrix(s, null, () => {});
    expect(el.querySelectorAll('.modrow').length).toBe(0);
    const add = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Add assignment'));
    expect(add).toBeTruthy();
    expect((add as HTMLButtonElement).disabled).toBe(false);
  });

  it('an assigned row appears at its fixed slot index; unassigned slots stay hidden', () => {
    const s = store();
    // assign slot 5 (a NOTE on CH1) — statusHigh 9 marks it assigned
    s.setModRow(5, { statusHigh: 9, channel: 0, number: 60, targetLine: 0, targetParam: 0 });
    const el = renderModMatrix(s, null, () => {});
    const rows = el.querySelectorAll('.modrow');
    expect(rows.length).toBe(1);
    expect(rows[0]!.querySelector('.modrow-index')!.textContent).toBe('6'); // 0-based slot 5 -> label 6
  });

  it('the armed row is shown even while still empty (the Add flow)', () => {
    const s = store();
    const el = renderModMatrix(s, 3, () => {}); // arm slot 3, nothing assigned yet
    const rows = el.querySelectorAll('.modrow');
    expect(rows.length).toBe(1);
    expect(rows[0]!.querySelector('.modrow-index')!.textContent).toBe('4');
    expect(rows[0]!.classList.contains('is-armed')).toBe(true);
  });
});
