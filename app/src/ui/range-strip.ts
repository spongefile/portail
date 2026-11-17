/**
 * Board 8 — the note range, drawn: ONE keyboard strip with two handles over the note_low/note_high
 * pair (both note_menu). Dragging clamps the handles against each other at equality — low = high is
 * a valid one-note range and stays reachable; low > high is NOT draggable into existence. The two
 * fields underneath remain (the keyboard/touch/screen-reader path over the same bytes), so the
 * inverted state is still *expressible* there; when it is, the strip draws the span between
 * min..max and says so with a dim hint — the firmware's behaviour for an inverted range is
 * unverified, and the drawing must not pretend to know.
 *
 * Same conventions as env-canvas.ts: host-level pointers, ≥20px screen-px hit test, preview per
 * rAF, ONE commit on release (only the dragged byte), pointercancel reverts. Pointer-only
 * (aria-hidden); the fields carry the keyboard.
 */

import { el } from './dom';
import type { Store } from '../state/store';
import { familyOfLine, modeByIndex, modeColor, labelFor } from '../model/model';

const VBW = 300, VBH = 64;
const X0 = 8, X1 = 292, W = X1 - X0;
const TY0 = 22, TY1 = 42; // track band

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

export function rangeStrip(store: Store, line: number): HTMLElement | null {
  const family = familyOfLine(line);
  const l = store.get().config.lines[line]!;
  const mode = modeByIndex(family, l.mode);
  if (!mode) return null;
  const pLo = mode.params.find((p) => p.id === 'note_low');
  const pHi = mode.params.find((p) => p.id === 'note_high');
  if (!pLo || !pHi || pLo.domain !== 'note_menu' || pHi.domain !== 'note_menu') return null;

  const tint = modeColor(family, l.mode) ?? 'var(--accent)';
  const MAX = Math.min(pLo.max, pLo.wireMax); // 127, derived not assumed
  const val = { lo: l.bytes[pLo.index] ?? pLo.default, hi: l.bytes[pHi.index] ?? pHi.default };

  const xOf = (v: number) => X0 + (v / MAX) * W;
  const vOf = (x: number) => Math.round(Math.min(MAX, Math.max(0, ((x - X0) / W) * MAX)));

  const host = el('div', { class: 'range-strip', 'aria-hidden': 'true' });

  const render = () => {
    const inverted = val.lo > val.hi;
    const a = Math.min(val.lo, val.hi), b = Math.max(val.lo, val.hi);
    // Octave gridlines + C labels (C-2 … C8): position IS the pitch axis, the labels anchor it.
    let grid = '';
    for (let v = 0; v <= MAX; v += 12) {
      const x = xOf(v);
      grid += `<line x1="${fmt(x)}" y1="${TY0}" x2="${fmt(x)}" y2="${TY1}" class="range-grid"/>`;
      if (v % 24 === 0) grid += `<text x="${fmt(x)}" y="${TY1 + 11}" text-anchor="middle" class="env-label">${labelFor(pLo, v)}</text>`;
    }
    const span = `<rect x="${fmt(xOf(a))}" y="${TY0}" width="${fmt(Math.max(1, xOf(b) - xOf(a)))}" height="${TY1 - TY0}" class="range-span"/>`;
    const handle = (v: number, id: string) =>
      `<rect x="${fmt(xOf(v) - 3.5)}" y="${TY0 - 4}" width="7" height="${TY1 - TY0 + 8}" rx="3" class="range-handle" data-h="${id}"/>`;
    const labels =
      `<text x="${fmt(xOf(val.lo))}" y="${TY0 - 8}" text-anchor="middle" class="env-label">${labelFor(pLo, val.lo)}</text>` +
      `<text x="${fmt(xOf(val.hi))}" y="${TY0 - 8}" text-anchor="middle" class="env-label">${labelFor(pHi, val.hi)}</text>`;
    const hint = inverted
      ? `<text x="${VBW / 2}" y="${VBH - 2}" text-anchor="middle" class="env-label">note low is above note high — module behaviour unverified</text>`
      : '';
    host.innerHTML =
      `<svg viewBox="0 0 ${VBW} ${VBH}" style="--fill: ${tint}" aria-hidden="true" focusable="false">` +
      `<rect x="${X0}" y="${TY0}" width="${W}" height="${TY1 - TY0}" class="range-track"/>` +
      grid + span + handle(val.lo, 'lo') + handle(val.hi, 'hi') + labels + hint +
      `</svg>`;
  };

  let drag: 'lo' | 'hi' | null = null;
  const toVB = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    const scale = r.width > 0 ? VBW / r.width : 1;
    return { x: (e.clientX - r.left) * scale, y: (e.clientY - r.top) * (r.height > 0 ? VBH / r.height : 1), scale };
  };

  host.addEventListener('pointerdown', (e) => {
    const { x, y, scale } = toVB(e);
    const th = 20 * scale;
    if (y < TY0 - th || y > TY1 + th) return;
    const dLo = Math.abs(x - xOf(val.lo)), dHi = Math.abs(x - xOf(val.hi));
    if (Math.min(dLo, dHi) > th) return;
    // Nearest handle wins; at a shared position, the drag DIRECTION decides on the first move.
    drag = dLo <= dHi ? 'lo' : 'hi';
    if (typeof host.setPointerCapture === 'function') { try { host.setPointerCapture(e.pointerId); } catch { /* jsdom */ } }
    e.preventDefault();
  });
  host.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const { x } = toVB(e);
    const v = vOf(x);
    // The clamp IS the constraint: low can rise to meet high (one-note range), never past it.
    if (drag === 'lo') val.lo = Math.min(v, val.hi);
    else val.hi = Math.max(v, val.lo);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(render); else render();
  });
  host.addEventListener('pointerup', () => {
    if (!drag) return;
    const p = drag === 'lo' ? pLo : pHi;
    const v = drag === 'lo' ? val.lo : val.hi;
    drag = null;
    store.setLineByte(line, p.index, v); // one byte, one undo entry
  });
  host.addEventListener('pointercancel', () => {
    drag = null;
    const cur = store.get().config.lines[line]!;
    val.lo = cur.bytes[pLo.index] ?? pLo.default; val.hi = cur.bytes[pHi.index] ?? pHi.default;
    render();
  });

  render();
  return host;
}
