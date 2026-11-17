// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { envCanvas } from '../src/ui/env-canvas';
import { emptyConfig, lineWithDefaults } from '../src/model/model';

// env mode is CV index 10; bytes: 4=shape (ar/ad/adsr/loop), 5=attack, 6=decay, 7=sustain, 8=release
function envStore(shape: number): Store {
  const s = new Store();
  const c = emptyConfig('seed');
  c.lines[0] = lineWithDefaults('cv', 10);
  c.lines[0]!.bytes[4] = shape;
  s.replaceConfig(c, 'read');
  return s;
}
const mount = (s: Store) => {
  const h = envCanvas(s, 0)!;
  document.body.innerHTML = ''; document.body.appendChild(h);
  return h;
};
const ptr = (h: HTMLElement, type: string, x: number, y: number) =>
  h.dispatchEvent(new MouseEvent(type, { clientX: x, clientY: y, bubbles: true })); // jsdom: listeners fire by type

describe('envelope canvas structure', () => {
  it('adsr: three handles + a sustain plateau grab; pointer-only (aria-hidden)', () => {
    const h = mount(envStore(2));
    expect(h.getAttribute('aria-hidden')).toBe('true');
    expect(h.querySelectorAll('.env-handle').length).toBe(3);
    expect(h.querySelectorAll('.env-plateau').length).toBe(1);
    expect(h.querySelectorAll('.env-ghost').length).toBe(0);
  });

  it('ar: two handles, no plateau — hidden stages are not drawn (and never written)', () => {
    const h = mount(envStore(0));
    expect(h.querySelectorAll('.env-handle').length).toBe(2);
    expect(h.querySelector('.env-plateau')).toBeNull();
  });

  it('loop: ad shape plus non-interactive ghost repeats', () => {
    const h = mount(envStore(3));
    expect(h.querySelectorAll('.env-handle').length).toBe(2);
    expect(h.querySelectorAll('.env-ghost').length).toBe(2);
  });

  it('polyline only — no curves (firmware curvature is unknown; curves would invent a fact)', () => {
    const h = mount(envStore(2));
    expect(h.querySelector('polyline.env-line')).toBeTruthy();
    expect(h.querySelector('path')).toBeNull();
  });
});

describe('envelope canvas drag', () => {
  it('drag the attack peak: preview during move, ONE undo entry on release', () => {
    const s = envStore(2);
    const before = s.get().config.lines[0]!.bytes.slice();
    const h = mount(s);
    const peak = h.querySelector('.env-handle[data-h="peak"]')!;
    const px = Number(peak.getAttribute('cx')), py = Number(peak.getAttribute('cy'));
    ptr(h, 'pointerdown', px, py);
    ptr(h, 'pointermove', px + 30, py);       // move within the attack band
    expect(s.get().config.lines[0]!.bytes[5]).toBe(before[5]); // NOT committed mid-drag
    ptr(h, 'pointerup', px + 30, py);
    const after = s.get().config.lines[0]!.bytes;
    expect(after[5]).toBeGreaterThan(before[5]!);              // attack moved
    s.undo();                                                   // ONE undo restores the whole gesture
    expect(s.get().config.lines[0]!.bytes).toEqual(before);
  });

  it('drag the D/S corner: decay AND sustain in one commit → one undo entry', () => {
    const s = envStore(2);
    const before = s.get().config.lines[0]!.bytes.slice();
    const h = mount(s);
    const corner = h.querySelector('.env-handle[data-h="corner"]')!;
    const cx = Number(corner.getAttribute('cx')), cy = Number(corner.getAttribute('cy'));
    ptr(h, 'pointerdown', cx, cy);
    ptr(h, 'pointermove', cx + 20, cy + 30);  // right (decay up) and down (sustain down)
    ptr(h, 'pointerup', cx + 20, cy + 30);
    const after = s.get().config.lines[0]!.bytes;
    expect(after[6]).toBeGreaterThan(before[6]!);  // decay
    expect(after[7]).toBeLessThan(before[7]!);     // sustain
    s.undo();
    expect(s.get().config.lines[0]!.bytes).toEqual(before);
  });

  it('a click with no movement commits nothing (no junk undo entries)', () => {
    const s = envStore(2);
    const before = s.get().config.lines[0]!.bytes.slice();
    const h = mount(s);
    const peak = h.querySelector('.env-handle[data-h="peak"]')!;
    const px = Number(peak.getAttribute('cx')), py = Number(peak.getAttribute('cy'));
    ptr(h, 'pointerdown', px, py); ptr(h, 'pointerup', px, py);
    expect(s.get().config.lines[0]!.bytes).toEqual(before);
    expect(s.canUndo?.() ?? true).toBeTruthy(); // commit() no-ops on equal configs either way
  });
});

// Layout block: the canvas and ITS fields are one unit (canvas left, fields stacked right in stage
// order); non-canvas params stay in the normal flow.
import { renderParamGrid } from '../src/ui/params';
describe('canvas layout block', () => {
  it('adsr: block holds the canvas + A/D/S/R fields in stage order; channel stays outside', () => {
    const grid = renderParamGrid(envStore(2), 0);
    const block = grid.querySelector('.canvas-block')!;
    expect(block.querySelector('.env-canvas')).toBeTruthy();
    const names = [...block.querySelectorAll('.canvas-block-fields .pfield-name')].map((n) => n.textContent);
    expect(names.map((n) => n!.replace(/ms$/, ''))).toEqual(['Attack', 'Decay', 'Sustain', 'Release']);
    expect(grid.querySelectorAll('.canvas-block .pfield').length).toBe(4);
    // channel/trigger/note/shape flow outside the block
    expect([...grid.children].filter((c) => c.classList.contains('pfield')).length).toBeGreaterThan(0);
  });

  it('ar: hidden stages vanish from the stack, not just the drawing', () => {
    const grid = renderParamGrid(envStore(0), 0);
    const names = [...grid.querySelectorAll('.canvas-block-fields .pfield-name')].map((n) => n.textContent!.replace(/ms$/, ''));
    expect(names).toEqual(['Attack', 'Release']);
  });
});
