/**
 * Board 8 — gate rise/fall, drawn: the envelope canvas's `ar` variant over the rise_time domain.
 * Two banded handles (rise left half, fall right half), banded INDEX space as everywhere else.
 * Domain differences from env_times, both honoured here:
 *   - index 0 is OFF, not a time: the handle sits at the hard left of its band, the label reads
 *     "OFF" (the domain's own string), and the drawn edge is VERTICAL — instant, the honest picture
 *     of no slew — not a 1px slope.
 *   - it is 100 steps, not 128: the span is derived from the param (min/max/wireMax), never
 *     inherited from another domain.
 * Straight lines for the same reason as the ADSR: the firmware's slew curvature is unknown.
 * Fields stay underneath as the keyboard/touch/screen-reader path; ONE commit per gesture.
 */

import { el } from './dom';
import type { Store } from '../state/store';
import { familyOfLine, modeByIndex, modeColor, labelFor } from '../model/model';
import type { ParamDef } from '../model/types';

const VBW = 300, VBH = 92;
const X0 = 6, X1 = 294, W = X1 - X0;
const Y0 = 74, Y1 = 14;

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

export function riseFall(store: Store, line: number): HTMLElement | null {
  const family = familyOfLine(line);
  const l = store.get().config.lines[line]!;
  const mode = modeByIndex(family, l.mode);
  if (!mode) return null;
  const pRise = mode.params.find((p) => p.id === 'rise');
  const pFall = mode.params.find((p) => p.id === 'fall');
  if (!pRise || !pFall || pRise.domain !== 'rise_time' || pFall.domain !== 'rise_time') return null;

  const tint = modeColor(family, l.mode) ?? 'var(--accent)';
  const val = { rise: l.bytes[pRise.index] ?? pRise.default, fall: l.bytes[pFall.index] ?? pFall.default };

  const span = (p: ParamDef) => Math.max(1, Math.min(p.max, p.wireMax) - p.min); // 99: derived, not assumed
  const riseX = () => X0 + ((val.rise - pRise.min) / span(pRise)) * (W / 2);       // band [0, .5]
  const fallX = () => X0 + W / 2 + ((val.fall - pFall.min) / span(pFall)) * (W / 2); // band [.5, 1]
  const vIn = (p: ParamDef, x: number, b0: number) =>
    Math.round(p.min + Math.min(1, Math.max(0, (x - X0 - b0 * W) / (W / 2))) * span(p));

  const host = el('div', { class: 'env-canvas rise-fall', 'aria-hidden': 'true' });

  const render = () => {
    const rx = riseX(), fx = fallX(), mid = X0 + W / 2;
    // OFF ⇒ rx === X0 (vertical rise) / fx === mid (vertical fall) — the geometry says "instant".
    const pts = `${X0},${Y0} ${fmt(rx)},${Y1} ${fmt(mid)},${Y1} ${fmt(fx)},${Y0}`;
    // The plateau is NOT a stage: it is "however long you hold the note", so it must not wear the
    // same confident solid line as the two draggable edges (Tina read it as a third parameter).
    // Dim + dashed + labelled, the engineering-drawing convention for arbitrary duration.
    host.innerHTML =
      `<svg viewBox="0 0 ${VBW} ${VBH}" style="--env: ${tint}" aria-hidden="true" focusable="false">` +
      `<line x1="${X0}" y1="${Y0}" x2="${X1}" y2="${Y0}" class="env-base"/>` +
      `<polygon points="${pts} ${X0},${Y0}" class="env-fill"/>` +
      `<polyline points="${X0},${Y0} ${fmt(rx)},${Y1}" class="env-line"/>` +
      `<line x1="${fmt(rx)}" y1="${Y1}" x2="${fmt(mid)}" y2="${Y1}" class="env-hold"/>` +
      `<text x="${fmt((rx + mid) / 2)}" y="${Y1 - 6}" text-anchor="middle" class="env-label">note held</text>` +
      `<polyline points="${fmt(mid)},${Y1} ${fmt(fx)},${Y0}" class="env-line"/>` +
      `<circle cx="${fmt(rx)}" cy="${Y1}" r="6" class="env-handle" data-h="rise"/>` +
      `<circle cx="${fmt(fx)}" cy="${Y0}" r="6" class="env-handle" data-h="fall"/>` +
      `<text x="${fmt(Math.max(rx, 18))}" y="${VBH - 4}" text-anchor="middle" class="env-label">${labelFor(pRise, val.rise)}</text>` +   // below the baseline (the top row belongs to "note held"); clamped so OFF at the hard left can't clip
      `<text x="${fmt(Math.min(fx, VBW - 18))}" y="${Y0 + 13}" text-anchor="middle" class="env-label">${labelFor(pFall, val.fall)}</text>` +
      `</svg>`;
  };

  let drag: 'rise' | 'fall' | null = null;
  const toVB = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    const scale = r.width > 0 ? VBW / r.width : 1;
    return { x: (e.clientX - r.left) * scale, y: (e.clientY - r.top) * (r.height > 0 ? VBH / r.height : 1), scale };
  };

  host.addEventListener('pointerdown', (e) => {
    const { x, y, scale } = toVB(e);
    const th = 20 * scale;
    const dr = Math.hypot(x - riseX(), y - Y1), df = Math.hypot(x - fallX(), y - Y0);
    if (Math.min(dr, df) > th) return;
    drag = dr <= df ? 'rise' : 'fall';
    if (typeof host.setPointerCapture === 'function') { try { host.setPointerCapture(e.pointerId); } catch { /* jsdom */ } }
    e.preventDefault();
  });
  host.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const { x } = toVB(e);
    if (drag === 'rise') val.rise = vIn(pRise, x, 0);
    else val.fall = vIn(pFall, x, 0.5);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(render); else render();
  });
  host.addEventListener('pointerup', () => {
    if (!drag) return;
    const p = drag === 'rise' ? pRise : pFall;
    const v = drag === 'rise' ? val.rise : val.fall;
    drag = null;
    store.setLineByte(line, p.index, v); // one byte, one undo entry
  });
  host.addEventListener('pointercancel', () => {
    drag = null;
    const cur = store.get().config.lines[line]!;
    val.rise = cur.bytes[pRise.index] ?? pRise.default; val.fall = cur.bytes[pFall.index] ?? pFall.default;
    render();
  });

  render();
  return host;
}
