// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { bjorklund, euclidRing } from '../src/ui/euclid-ring';
import { emptyConfig, lineWithDefaults } from '../src/model/model';

const pat = (n: number, f: number) => bjorklund(n, f).map((x) => (x ? 'x' : '.')).join('');

describe('bjorklund (standard necklace — firmware algorithm unverified, and the code says so)', () => {
  it('canonical patterns', () => {
    expect(pat(8, 3)).toBe('x..x..x.');   // tresillo
    expect(pat(5, 2)).toBe('x.x..');
    expect(pat(8, 5)).toBe('x.xx.xx.');
    expect(pat(9, 4)).toBe('x.x.x.x..');
    expect(pat(4, 4)).toBe('xxxx');
    expect(pat(4, 0)).toBe('....');
  });
});

// euclid is GATE mode index 13; bytes: 4 steps, 5 fills, 6 rotate (all label-off-by-one: byte 0 = 1)
function euclidStore(steps: number, fills: number, rotate: number): Store {
  const s = new Store();
  const c = emptyConfig('seed');
  c.lines[8] = lineWithDefaults('gate', 13);
  c.lines[8]!.bytes[4] = steps; c.lines[8]!.bytes[5] = fills; c.lines[8]!.bytes[6] = rotate;
  s.replaceConfig(c, 'read');
  return s;
}
const mount = (s: Store) => { const h = euclidRing(s, 8)!; document.body.innerHTML=''; document.body.appendChild(h); return h; };

describe('euclid ring', () => {
  it('N beads on the ring and N cells in the row, F filled, pointer-only', () => {
    const h = mount(euclidStore(7, 2, 0)); // N=8, F=3
    expect(h.getAttribute('aria-hidden')).toBe('true');
    expect(h.querySelectorAll('.euclid-bead').length).toBe(8);
    expect(h.querySelectorAll('.euclid-bead.is-on').length).toBe(3);
    expect(h.querySelectorAll('.euclid-cell').length).toBe(8);
    expect(h.querySelectorAll('.euclid-cell.is-on').length).toBe(3);
    expect(h.querySelectorAll('.euclid-marker').length).toBe(1);
  });

  it('fills > steps: the DRAWING clamps (all beads filled), the hint appears, bytes untouched', () => {
    const s = euclidStore(3, 10, 0); // N=4, fills claims 11
    const h = mount(s);
    expect(h.querySelectorAll('.euclid-bead.is-on').length).toBe(4); // capped at N
    expect(h.innerHTML).toContain('module behaviour unverified');
    expect(s.get().config.lines[8]!.bytes[5]).toBe(10);             // byte never clamped
  });

  it('no hint when fills fit', () => {
    const h = mount(euclidStore(7, 2, 0));
    expect(h.innerHTML).not.toContain('capped');
  });

  it('rotate ≥ steps wraps in the drawing only', () => {
    const s = euclidStore(3, 1, 63); // N=4, rot 63 → displays as 63 mod 4 = 3
    const h = mount(s);
    expect(h.querySelectorAll('.euclid-bead').length).toBe(4);      // renders, no crash
    expect(s.get().config.lines[8]!.bytes[6]).toBe(63);             // byte untouched
  });

  it('dragging the annulus writes rotate ONCE on release; bytes for steps/fills untouched', () => {
    const s = euclidStore(7, 2, 0); // N=8
    const before = s.get().config.lines[8]!.bytes.slice();
    const h = mount(s);
    const ptr = (t: string, x: number, y: number) => h.dispatchEvent(new MouseEvent(t, { clientX: x, clientY: y, bubbles: true }));
    // annulus point at 3 o'clock (CX+R, CY) → step N/4 = 2
    ptr('pointerdown', 150 + 44, 62);
    ptr('pointermove', 150 + 44, 62);
    expect(s.get().config.lines[8]!.bytes[6]).toBe(0);              // not committed mid-drag
    ptr('pointerup', 150 + 44, 62);
    const after = s.get().config.lines[8]!.bytes;
    expect(after[6]).toBe(2);                                        // rotate = the step under the pointer
    expect(after[4]).toBe(before[4]); expect(after[5]).toBe(before[5]);
    s.undo();
    expect(s.get().config.lines[8]!.bytes[6]).toBe(0);              // one undo entry
  });

  it('a click outside the annulus does nothing (beads promise nothing)', () => {
    const s = euclidStore(7, 2, 0);
    const h = mount(s);
    h.dispatchEvent(new MouseEvent('pointerdown', { clientX: 150, clientY: 62, bubbles: true })); // dead centre
    h.dispatchEvent(new MouseEvent('pointerup', { clientX: 150, clientY: 62, bubbles: true }));
    expect(s.get().config.lines[8]!.bytes[6]).toBe(0);
  });
});
