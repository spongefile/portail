// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { rangeStrip } from '../src/ui/range-strip';
import { riseFall } from '../src/ui/rise-fall';
import { renderParamGrid } from '../src/ui/params';
import { emptyConfig, lineWithDefaults } from '../src/model/model';

const ptr = (h: HTMLElement, t: string, x: number, y: number) =>
  h.dispatchEvent(new MouseEvent(t, { clientX: x, clientY: y, bubbles: true }));

// note mode = CV index 1 (note_low byte 7, note_high byte 8); gate mode = GATE index 2? — resolved
// below by defaults: lineWithDefaults('gate', …) for the mode whose params include rise/fall.
function noteStore(lo: number, hi: number): Store {
  const s = new Store(); const c = emptyConfig('x');
  c.lines[0] = lineWithDefaults('cv', 1);
  c.lines[0]!.bytes[7] = lo; c.lines[0]!.bytes[8] = hi;
  s.replaceConfig(c, 'read'); return s;
}
const mount = (h: HTMLElement) => { document.body.innerHTML=''; document.body.appendChild(h); return h; };

describe('note range strip', () => {
  it('two handles, live note names, span drawn', () => {
    const h = mount(rangeStrip(noteStore(24, 96), 0)!);
    expect(h.getAttribute('aria-hidden')).toBe('true');
    expect(h.querySelectorAll('.range-handle').length).toBe(2);
    expect(h.querySelectorAll('.range-span').length).toBe(1);
    expect(h.innerHTML).toContain('C0');  // 24 → C0 per note_menu
  });

  it('dragging low clamps AT high (one-note range reachable, low > high not draggable)', () => {
    const s = noteStore(24, 60);
    const h = mount(rangeStrip(s, 0)!);
    const xOf = (v: number) => 8 + (v / 127) * 284;
    ptr(h, 'pointerdown', xOf(24), 32);
    ptr(h, 'pointermove', xOf(120), 32);  // way past high
    ptr(h, 'pointerup', xOf(120), 32);
    expect(s.get().config.lines[0]!.bytes[7]).toBe(60); // clamped exactly to high
    expect(s.get().config.lines[0]!.bytes[8]).toBe(60); // high untouched
  });

  it('an inverted pair set via the FIELDS draws with the unverified hint (bytes untouched)', () => {
    const s = noteStore(90, 30);
    const h = mount(rangeStrip(s, 0)!);
    expect(h.innerHTML).toContain('module behaviour unverified');
    expect(s.get().config.lines[0]!.bytes[7]).toBe(90);
  });

  it('the note-filter FX keeps its plain fields — no strip in an FX grid', () => {
    const s = new Store(); const c = emptyConfig('x');
    c.lines[16] = lineWithDefaults('fx', 1); // FX slot with note filter (mode 1 = note filter)
    s.replaceConfig(c, 'read');
    const grid = renderParamGrid(s, 16);
    expect(grid.querySelector('.range-strip')).toBeNull();
  });
});

function gateStore(rise: number, fall: number): Store {
  const s = new Store(); const c = emptyConfig('x');
  c.lines[8] = lineWithDefaults('gate', 1); // Gate mode: rise byte 5, fall byte 6
  c.lines[8]!.bytes[5] = rise; c.lines[8]!.bytes[6] = fall;
  s.replaceConfig(c, 'read'); return s;
}

describe('gate rise/fall trapezoid', () => {
  it('OFF draws VERTICAL edges; the hold plateau is dashed and labelled, not a third stage', () => {
    const h = mount(riseFall(gateStore(0, 0), 8)!);
    const lines = [...h.querySelectorAll('polyline.env-line')].map((pl) =>
      pl.getAttribute('points')!.split(' ').map((p) => p.split(',').map(Number)));
    expect(lines.length).toBe(2);              // rise and fall edges, drawn solid and separate
    expect(lines[0]![0]![0]).toBe(lines[0]![1]![0]); // rise edge vertical at X0
    expect(lines[1]![0]![0]).toBe(lines[1]![1]![0]); // fall edge vertical at mid
    expect(h.innerHTML).toContain('>OFF<');    // the domain's own label string
    // the plateau is "however long you hold the note" — dashed, dim, and it says so
    expect(h.querySelector('.env-hold')).toBeTruthy();
    expect(h.innerHTML).toContain('note held');
  });

  it('the span is the domain’s 100 steps, not env_times’ 128: full-right drag writes 99', () => {
    const s = gateStore(0, 0);
    const h = mount(riseFall(s, 8)!);
    ptr(h, 'pointerdown', 6, 14);              // rise handle at hard left, top
    ptr(h, 'pointermove', 6 + 144, 14);        // hard right of the rise band
    ptr(h, 'pointerup', 6 + 144, 14);
    expect(s.get().config.lines[8]!.bytes[5]).toBe(99);
    s.undo();
    expect(s.get().config.lines[8]!.bytes[5]).toBe(0); // one undo entry
  });
});
