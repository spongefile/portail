/**
 * Board 8 stage 3 — the envelope, drawn. A schematic polyline over the SAME bytes the four value
 * fields write; the canvas is an ADDITIONAL pointer path, and the fields below stay the tappable /
 * keyboard / screen-reader path (the accepted touch model: handles are ~12px visual with a ≥20px
 * pointer hit radius, not 44px targets — the numbers do the rest).
 *
 * The X-axis is BANDED INDEX SPACE, not time. env_times is exponential (2.1 ms → 134 s over 128
 * steps); drawn to time scale, A=10 ms beside R=30 s is a vertical line next to the whole canvas.
 * Each stage owns a fixed horizontal band and its handle moves linearly in the INDEX within that
 * band — the schematic convention of hardware envelope editors. Two things fall out for free:
 * handles can never cross or reorder (disjoint bands ARE the stage-order constraint; there is no
 * crossing-prevention code to write), and dragging feels uniform across an exponential domain.
 *
 * Straight polylines on purpose: the firmware's actual segment curvature is UNKNOWN, and drawing
 * exponential curves would be inventing a fact. Do not "improve" this into a lie.
 *
 * Preview live, commit ONCE on pointerup — every commit is an undo entry, and a per-move commit
 * turns one drag into hundreds of Ctrl-Z steps. The D/S corner writes decay+sustain in a single
 * store.commit, so even the two-value drag is one undo step.
 */

import { el } from './dom';
import type { Store } from '../state/store';
import { familyOfLine, modeByIndex, modeColor, labelFor } from '../model/model';
import type { ParamDef } from '../model/types';

const VBW = 300, VBH = 112;
const X0 = 6, X1 = 294;      // inner width
const Y0 = 94, Y1 = 16;      // baseline / full level (room above for labels)
const W = X1 - X0;

type ShapeKey = 'ar' | 'ad' | 'adsr' | 'loop';
const SHAPES: readonly ShapeKey[] = ['ar', 'ad', 'adsr', 'loop']; // env_type_menu order

/** Fixed horizontal bands per shape, as fractions of the inner width. The sustain plateau band is
 *  FIXED width — sustain is a level, not a time, so its band never resizes. */
const BANDS: Record<ShapeKey, { a: [number, number]; d?: [number, number]; s?: [number, number]; r?: [number, number] }> = {
  adsr: { a: [0, 0.28], d: [0.28, 0.56], s: [0.56, 0.78], r: [0.78, 1] },
  ar: { a: [0, 0.5], r: [0.5, 1] },
  ad: { a: [0, 0.5], d: [0.5, 1] },
  loop: { a: [0, 0.5], d: [0.5, 1] },
};

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

/** The envelope canvas for `line`, or null when the mode isn't an envelope. Pointer-only by design
 *  (aria-hidden): the value fields below are the accessible path over the same bytes. */
export function envCanvas(store: Store, line: number): HTMLElement | null {
  const family = familyOfLine(line);
  const l = store.get().config.lines[line]!;
  const mode = modeByIndex(family, l.mode);
  if (!mode) return null;
  const byId = (id: string) => mode.params.find((p) => p.id === id);
  const pShape = byId('envelope_shape'), pA = byId('attack'), pD = byId('decay'), pS = byId('sustain'), pR = byId('release');
  if (!pShape || !pA || !pD || !pS || !pR) return null;

  const tint = modeColor(family, l.mode) ?? 'var(--accent)';
  const shape: ShapeKey = SHAPES[l.bytes[pShape.index] ?? pShape.default] ?? 'adsr';
  const bands = BANDS[shape];

  // Preview state — dragged live, committed once on release. Hidden stages keep their bytes:
  // switching adsr→ar just stops SHOWING decay/sustain, it never writes them (non-destructive,
  // same as the dropdowns behave).
  const val = {
    a: l.bytes[pA.index] ?? pA.default, d: l.bytes[pD.index] ?? pD.default,
    s: l.bytes[pS.index] ?? pS.default, r: l.bytes[pR.index] ?? pR.default,
  };

  const span = (p: ParamDef) => Math.max(1, Math.min(p.max, p.wireMax) - p.min);
  const xIn = (band: [number, number], p: ParamDef, v: number) =>
    X0 + (band[0] + ((v - p.min) / span(p)) * (band[1] - band[0])) * W;
  const vIn = (band: [number, number], p: ParamDef, x: number) => {
    const f = ((x - X0) / W - band[0]) / (band[1] - band[0]);
    return Math.round(p.min + Math.min(1, Math.max(0, f)) * span(p));
  };
  const yOfS = (s: number) => Y0 - (s / 100) * (Y0 - Y1);
  const sOfY = (y: number) => Math.round(Math.min(100, Math.max(0, ((Y0 - y) / (Y0 - Y1)) * 100)));

  interface Handle { id: 'peak' | 'corner' | 'end'; x: number; y: number; }
  const handles = (): Handle[] => {
    const hs: Handle[] = [{ id: 'peak', x: xIn(bands.a, pA, val.a), y: Y1 }];
    if (shape === 'adsr') {
      hs.push({ id: 'corner', x: xIn(bands.d!, pD, val.d), y: yOfS(val.s) });
      hs.push({ id: 'end', x: xIn(bands.r!, pR, val.r), y: Y0 });
    } else if (shape === 'ar') {
      hs.push({ id: 'end', x: xIn(bands.r!, pR, val.r), y: Y0 });
    } else {
      hs.push({ id: 'end', x: xIn(bands.d!, pD, val.d), y: Y0 }); // ad/loop: decay falls to zero
    }
    return hs;
  };

  const host = el('div', { class: 'env-canvas', 'aria-hidden': 'true' });

  const render = () => {
    const hs = handles();
    const peak = hs[0]!;
    let pts = `${X0},${Y0} ${fmt(peak.x)},${Y1}`;
    let plateauEndX = 0;
    if (shape === 'adsr') {
      const corner = hs[1]!, end = hs[2]!;
      plateauEndX = X0 + bands.s![1] * W;
      pts += ` ${fmt(corner.x)},${fmt(corner.y)} ${fmt(plateauEndX)},${fmt(corner.y)} ${fmt(end.x)},${Y0}`;
    } else {
      pts += ` ${fmt(hs[1]!.x)},${Y0}`;
    }

    // Loop: ghost repeats say "this repeats". Not interactive, reduced opacity, clipped by the svg.
    let ghosts = '';
    if (shape === 'loop') {
      const cycle = hs[1]!.x - X0;
      for (let k = 1; k <= 2; k++) ghosts += `<polyline points="${pts}" transform="translate(${fmt(cycle * k)},0)" class="env-ghost"/>`;
    }

    const endParam = shape === 'ar' ? pR : shape === 'adsr' ? pR : pD;
    const endVal = shape === 'ar' ? val.r : shape === 'adsr' ? val.r : val.d;
    const labels = [
      `<text x="${fmt(peak.x)}" y="${Y1 - 6}" text-anchor="middle" class="env-label">${labelFor(pA, val.a)}</text>`,
      shape === 'adsr'
        ? `<text x="${fmt(hs[1]!.x)}" y="${fmt(hs[1]!.y - 9)}" text-anchor="middle" class="env-label">${labelFor(pD, val.d)} · ${labelFor(pS, val.s)}%</text>`
        : '',
      `<text x="${fmt(hs[hs.length - 1]!.x)}" y="${Y0 + 13}" text-anchor="middle" class="env-label">${labelFor(endParam, endVal)}</text>`,
    ].join('');

    const plateau = shape === 'adsr'
      ? `<line x1="${fmt(hs[1]!.x)}" y1="${fmt(hs[1]!.y)}" x2="${fmt(plateauEndX)}" y2="${fmt(hs[1]!.y)}" class="env-plateau"/>`
      : '';
    const circles = hs.map((h) => `<circle cx="${fmt(h.x)}" cy="${fmt(h.y)}" r="6" class="env-handle" data-h="${h.id}"/>`).join('');

    host.innerHTML =
      `<svg viewBox="0 0 ${VBW} ${VBH}" style="--env: ${tint}" aria-hidden="true" focusable="false">` +
      `<line x1="${X0}" y1="${Y0}" x2="${X1}" y2="${Y0}" class="env-base"/>` +
      ghosts +
      `<polygon points="${pts} ${fmt(shape === 'adsr' ? handles()[2]!.x : handles()[1]!.x)},${Y0}" class="env-fill"/>` +
      `<polyline points="${pts}" class="env-line"/>` +
      plateau + circles + labels +
      `</svg>`;
  };

  /* ---------------- pointer interaction (on the host — innerHTML is rebuilt per frame) */
  let drag: 'peak' | 'corner' | 'end' | 'plateau' | null = null;
  const toVB = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    const scale = r.width > 0 ? VBW / r.width : 1;
    return { x: (e.clientX - r.left) * scale, y: (e.clientY - r.top) * (r.height > 0 ? VBH / r.height : 1), scale };
  };

  host.addEventListener('pointerdown', (e) => {
    const { x, y, scale } = toVB(e);
    const th = 20 * scale; // ≥20 SCREEN px hit radius, by distance test — not element size
    const hs = handles();
    let best: { h: typeof drag; d2: number } | null = null;
    for (const h of hs) {
      const d2 = (h.x - x) ** 2 + (h.y - y) ** 2;
      if (d2 <= th * th && (!best || d2 < best.d2)) best = { h: h.id, d2 };
    }
    // The plateau line is a bigger target for sustain only — and the D/S corner wins ties.
    if (!best && shape === 'adsr') {
      const corner = hs[1]!;
      const px2 = X0 + bands.s![1] * W;
      if (x >= corner.x - th && x <= px2 + th && Math.abs(y - corner.y) <= th) best = { h: 'plateau', d2: 0 };
    }
    if (!best) return;
    drag = best.h;
    if (typeof host.setPointerCapture === 'function') { try { host.setPointerCapture(e.pointerId); } catch { /* jsdom */ } }
    e.preventDefault();
  });

  host.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const { x, y } = toVB(e);
    if (drag === 'peak') val.a = vIn(bands.a, pA, x);
    else if (drag === 'corner') { val.d = vIn(bands.d!, pD, x); val.s = sOfY(y); }
    else if (drag === 'plateau') val.s = sOfY(y);
    else if (shape === 'ar' || shape === 'adsr') val.r = vIn(bands.r!, pR, x);
    else val.d = vIn(bands.d!, pD, x);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(render); else render();
  });

  host.addEventListener('pointerup', () => {
    if (!drag) return;
    drag = null;
    // ONE commit for the whole gesture → one undo entry (even when the corner moved two values).
    store.commit(`draw envelope on line ${line}`, (c) => {
      const lb = c.lines[line]!;
      const bytes = lb.bytes.slice();
      bytes[pA.index] = val.a; bytes[pD.index] = val.d; bytes[pS.index] = val.s; bytes[pR.index] = val.r;
      c.lines[line] = { mode: lb.mode, bytes };
    });
  });

  host.addEventListener('pointercancel', () => {
    // Cancelled gesture: revert the preview to the stored bytes, commit nothing.
    drag = null;
    const cur = store.get().config.lines[line]!;
    val.a = cur.bytes[pA.index] ?? pA.default; val.d = cur.bytes[pD.index] ?? pD.default;
    val.s = cur.bytes[pS.index] ?? pS.default; val.r = cur.bytes[pR.index] ?? pR.default;
    render();
  });

  render();
  return host;
}
