/**
 * Board 8 — the Euclidean pattern, drawn (bead ring + linear row). The wire holds THREE numbers
 * (steps, fills, rotate); the pattern itself is computed. Beads are therefore DISPLAY-ONLY — there
 * is no per-step mask on the wire, so a bead toggle is not expressible and nothing here promises
 * one (no hover state, no cursor, nothing clickable about a bead). The ring's ONE writer is the
 * rotate drag; Steps/Fills/Rotate fields underneath stay the primary writers.
 *
 * HONESTY: the preview is standard Bjorklund (necklace form), rotated clockwise from 12 o'clock.
 * The firmware's algorithm is UNVERIFIED — real Euclidean implementations differ in rotation origin
 * and remainder distribution, and we have not confirmed which one the module computes, nor its
 * rotation direction, nor what it does when fills > steps. Do not present this drawing as ground
 * truth (the mode's UNVERIFIED tag covers it). Degenerate values clamp in the DRAWING, never in
 * the bytes: N = steps+1, F = min(fills+1, N), rot = rotate mod N.
 *
 * Same conventions as env-canvas.ts: per-consumer function, host-level pointer handlers (innerHTML
 * is rebuilt per frame), manual ≥20px screen-px hit test, preview per rAF, ONE commit on pointerup,
 * pointercancel reverts from the store. Pointer-only (aria-hidden); fields carry the keyboard.
 */

import { el } from './dom';
import type { Store } from '../state/store';
import { familyOfLine, modeByIndex, modeColor } from '../model/model';

/** Standard Bjorklund / Euclidean necklace: F fills distributed as evenly as possible over N steps,
 *  pattern starting on a fill. E(8,3) → x..x..x. */
export function bjorklund(steps: number, fills: number): boolean[] {
  if (steps <= 0) return [];
  if (fills <= 0) return new Array<boolean>(steps).fill(false);
  if (fills >= steps) return new Array<boolean>(steps).fill(true);
  let a: number[][] = Array.from({ length: fills }, () => [1]);
  let b: number[][] = Array.from({ length: steps - fills }, () => [0]);
  while (b.length > 1) {
    const n = Math.min(a.length, b.length);
    const merged: number[][] = [];
    for (let i = 0; i < n; i++) merged.push([...a[i]!, ...b[i]!]);
    const rest = a.length > n ? a.slice(n) : b.slice(n);
    a = merged; b = rest;
  }
  return [...a, ...b].flat().map((x) => x === 1);
}

const VBW = 300, VBH = 168;
const CX = 150, CY = 62, R = 44;      // ring
const ROW_Y = 128;                    // linear row baseline

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();

/** The ring canvas for a Euclidean line, or null when the mode isn't one. */
export function euclidRing(store: Store, line: number): HTMLElement | null {
  const family = familyOfLine(line);
  const l = store.get().config.lines[line]!;
  const mode = modeByIndex(family, l.mode);
  if (!mode) return null;
  const byId = (id: string) => mode.params.find((p) => p.id === id);
  const pSteps = byId('steps'), pFills = byId('fills'), pRot = byId('rotate');
  if (!pSteps || !pFills || !pRot) return null;

  const tint = modeColor(family, l.mode) ?? 'var(--accent)';
  const N = (l.bytes[pSteps.index] ?? pSteps.default) + 1;           // byte 0 means 1 step
  const fillsTrue = (l.bytes[pFills.index] ?? pFills.default) + 1;
  const F = Math.min(fillsTrue, N);                                   // drawing clamps, bytes don't
  const clamped = fillsTrue > N;
  let rot = ((l.bytes[pRot.index] ?? pRot.default) % N + N) % N;      // preview state (drag writes this)

  const pattern = bjorklund(N, F);
  // Clockwise from 12 o'clock; +1 rotate = one step clockwise. Direction UNVERIFIED on hardware.
  const beadOn = (k: number) => pattern[((k - rot) % N + N) % N]!;
  const angle = (k: number) => (-90 + (k / N) * 360) * (Math.PI / 180);
  // Bead radius scales with N so they never overlap: adjacent centres are 2*pi*R/N apart, so the
  // radius must be at most half that. Use ~0.82 of the half-spacing to leave a small gap; clamp to
  // [1.6, 7] (fat at N=4, ~2px dots at N=64). The old 276/N set radius ~= full spacing → overlap.
  const beadR = Math.max(1.6, Math.min(7, (Math.PI * R * 0.82) / N));

  const host = el('div', { class: 'euclid-ring', 'aria-hidden': 'true' });

  const render = () => {
    const beads = Array.from({ length: N }, (_, k) => {
      const x = CX + R * Math.cos(angle(k)), y = CY + R * Math.sin(angle(k));
      return beadOn(k)
        ? `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(beadR)}" class="euclid-bead is-on"/>`
        : `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(beadR)}" class="euclid-bead"/>`;
    }).join('');
    // Marker: a wedge OUTSIDE the ring at the rotation origin (where pattern index 0 sits) — the
    // one draggable thing on the ring, and not a bead.
    const ma = angle(rot);
    const m1 = R + beadR + 3, m2 = R + beadR + 11, spread = 0.09;
    const marker = `<path d="M${fmt(CX + m2 * Math.cos(ma - spread))} ${fmt(CY + m2 * Math.sin(ma - spread))} ` +
      `L${fmt(CX + m1 * Math.cos(ma))} ${fmt(CY + m1 * Math.sin(ma))} ` +
      `L${fmt(CX + m2 * Math.cos(ma + spread))} ${fmt(CY + m2 * Math.sin(ma + spread))} Z" class="euclid-marker"/>`;
    // Linear row beneath: density read, never interactive.
    const side = Math.min(13, (VBW - 24) / N - 2);
    const rowW = N * (side + 2) - 2;
    const rx0 = CX - rowW / 2;
    const row = Array.from({ length: N }, (_, k) => {
      const x = rx0 + k * (side + 2);
      return `<rect x="${fmt(x)}" y="${fmt(ROW_Y - side)}" width="${fmt(side)}" height="${fmt(side)}" class="euclid-cell${beadOn(k) ? ' is-on' : ''}"/>`;
    }).join('');
    const hint = clamped
      ? `<text x="${CX}" y="${VBH - 8}" text-anchor="middle" class="env-label">fills capped at steps on the ring — module behaviour unverified</text>`
      : '';
    host.innerHTML =
      `<svg viewBox="0 0 ${VBW} ${VBH}" style="--fill: ${tint}" aria-hidden="true" focusable="false">` +
      `<circle cx="${CX}" cy="${CY}" r="${R}" class="euclid-track"/>` +
      beads + marker + row + hint +
      `</svg>`;
  };

  /* ------------- rotate drag: the annulus is the hit zone; single setLineByte on release */
  let dragging = false;
  const toVB = (e: PointerEvent) => {
    const r = host.getBoundingClientRect();
    const scale = r.width > 0 ? VBW / r.width : 1;
    return { x: (e.clientX - r.left) * scale, y: (e.clientY - r.top) * (r.height > 0 ? VBH / r.height : 1), scale };
  };
  const stepAt = (x: number, y: number) => {
    const deg = (Math.atan2(y - CY, x - CX) * 180) / Math.PI; // -180..180, -90 = 12 o'clock
    return ((Math.round(((deg + 90) / 360) * N) % N) + N) % N;
  };

  host.addEventListener('pointerdown', (e) => {
    const { x, y, scale } = toVB(e);
    const dist = Math.hypot(x - CX, y - CY);
    const band = 20 * scale;
    if (dist < R - band || dist > R + band + 12) return; // the annulus (marker included), nothing else
    dragging = true;
    rot = stepAt(x, y);
    if (typeof host.setPointerCapture === 'function') { try { host.setPointerCapture(e.pointerId); } catch { /* jsdom */ } }
    e.preventDefault();
    render();
  });
  host.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const { x, y } = toVB(e);
    rot = stepAt(x, y);
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(render); else render();
  });
  host.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    // Write the displayed absolute step; rotate byte tops out at its own domain, not at N.
    store.setLineByte(line, pRot.index, Math.min(rot, Math.min(pRot.max, pRot.wireMax)));
  });
  host.addEventListener('pointercancel', () => {
    dragging = false;
    const cur = store.get().config.lines[line]!;
    rot = (((cur.bytes[pRot.index] ?? pRot.default) % N) + N) % N;
    render();
  });

  render();
  return host;
}
