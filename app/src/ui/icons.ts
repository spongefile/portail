/**
 * Placeholder mode/FX icons (DESIGN.md §6.0-B).
 *
 * Stroke-based, 16px grid, one visual style, `stroke="currentColor"` so each inherits the tint of
 * its context (family colour on a jack, text colour in a dropdown). These glyphs are ported verbatim from the approved mockup artboards (still placeholder-tier,
 * keyed off the mode/FX `key`; when the sourced icon set arrives and the spec gains an `icon` field,
 * `iconForMode()` returns the real id and this map is swapped without touching callers.
 *
 * The name is always shown next to the icon, so a missing glyph degrades to the generic dot, never
 * to nothing.
 */

/** SVG inner markup (paths) per key, on a 16×16 viewBox, stroke = currentColor. */
const GLYPHS: Record<string, string> = {
  // --- generic / off
  off: '<circle cx="8" cy="8" r="2.5"/>',
  // --- pitch family
  note: '<circle cx="5" cy="12" r="2.1" fill="currentColor" stroke="none"/><path d="M7 12V3l6-1.5V9.5"/><circle cx="11.5" cy="9.7" r="2.1" fill="currentColor" stroke="none"/>',
  arp: '<path d="M2 12l3-4 3 3 3-6 3 4"/>',
  seq: '<path d="M2 10h3V6h3v6h3V4h3"/>',
  gate_seq: '<path d="M2 10h3V6h3v6h3V4h3"/>',
  // --- expression family
  vel: '<path d="M3 13V11M8 13V7.5M13 13V4"/>',
  aftertouch: '<path d="M8 3v8M5.2 8.4L8 11.2l2.8-2.8"/>',   // single down arrow
  poly_after: '<path d="M5 3.5v7M2.9 8.3L5 10.4l2.1-2.1M11 3.5v7M8.9 8.3L11 10.4l2.1-2.1"/>',   // two down arrows (aftertouch ×2)
  pitchbend: '<path d="M2 8q6-8 12 0"/>',
  cc: '<text x="8" y="11" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" stroke="none" letter-spacing="-0.4">CC</text>',
  cc_rec: '<text x="7" y="11.5" text-anchor="middle" font-size="7.5" font-weight="700" fill="currentColor" stroke="none" letter-spacing="-0.4">CC</text><circle cx="13" cy="4" r="1.6" fill="currentColor" stroke="none"/>',
  // --- modulation family
  lfo: '<path d="M1 8C2.5 3 5 3 6.5 8S11 13 12.5 8"/>',
  env: '<path d="M2 13L5.5 4l8.5 9"/>',   // simplified: sharp rise, long fall
  'random cv': '<rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/><circle cx="5.7" cy="5.7" r="1.15" fill="currentColor" stroke="none"/><circle cx="10.3" cy="5.7" r="1.15" fill="currentColor" stroke="none"/><circle cx="10.3" cy="10.3" r="1.15" fill="currentColor" stroke="none"/>',
  random: '<rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/><circle cx="5.7" cy="5.7" r="1.15" fill="currentColor" stroke="none"/><circle cx="10.3" cy="5.7" r="1.15" fill="currentColor" stroke="none"/><circle cx="5.7" cy="10.3" r="1.15" fill="currentColor" stroke="none"/><circle cx="10.3" cy="10.3" r="1.15" fill="currentColor" stroke="none"/>',
  // --- gate / trigger family
  gate: '<path d="M1 11h2V5h8v6h4"/>',        // wide pulse
  cvtrigger: '<path d="M1 11h5V5h2v6h6"/>',   // gate shape, narrow peak
  trigger: '<path d="M1 11h5V5h2v6h6"/>',     // gate shape, narrow peak
  euclid: '<circle cx="8" cy="8" r="5.2"/><circle cx="8" cy="2.8" r="2" fill="currentColor" stroke="none"/><circle cx="12.5" cy="10.6" r="2" fill="currentColor" stroke="none"/><circle cx="3.5" cy="10.6" r="2" fill="currentColor" stroke="none"/>',
  // --- clock family
  clock: '<circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/>',
  // --- FX (note-domain)
  'note filter': '<path d="M2 4h12l-4 5v4l-4-2V9z"/>',
  'random oct': '<rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/><circle cx="5.4" cy="10.6" r="1.15" fill="currentColor" stroke="none"/><circle cx="8" cy="8" r="1.15" fill="currentColor" stroke="none"/><circle cx="10.6" cy="5.4" r="1.15" fill="currentColor" stroke="none"/>',   // die, pips rising diagonally
  'random fx': '<rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/><ellipse cx="8" cy="8" rx="2.7" ry="1.9" transform="rotate(-14 8 8)"/>',   // die with a whole note inside (a tailed note is too cramped at 16px)
  chance: '<circle cx="4.6" cy="4.6" r="2"/><circle cx="11.4" cy="11.4" r="2"/><path d="M13 3L3 13"/>',
  accumulate: '<path d="M3 13L12.6 3.4M12.8 3.2H7.6M12.8 3.2v5.2"/>',   // arrow up-right (ratchets upward)
  transpose: '<path d="M4 11V4M4 4L2 6M4 4l2 2"/><path d="M12 5v7M12 12l-2-2M12 12l2-2"/>',
  scale: '<path d="M2 13h3V9.5h3V6h3V2.5h2"/>',
  microtonal: '<path d="M3 3v10M6 5v8M9 3v10M12 6v7"/>',
  // --- FX (gate-domain, post-fx)
  delay: '<path d="M3 4v8M8 6v6M13 8v4"/>',
  humanize: '<circle cx="8" cy="3.6" r="1.35"/><path d="M8 5V10M3 7.2H13M8 10L4.7 14M8 10L11.3 14"/>',   // stick figure (no enclosing circle)
  logic: '<path d="M4 3.5V12.5H7.5A4.5 4.5 0 0 0 7.5 3.5Z"/><path d="M1.5 5.8H4M1.5 10.2H4M12 8H14.5"/>',   // AND gate
  'random vel': '<rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/><path d="M8.6 5L6 8.4H7.7L7.3 11L10 7.4H8.2Z" fill="currentColor" stroke="currentColor" stroke-width=".7" stroke-linejoin="round"/>',   // die + bolt
  'random trig': '<rect x="2.5" y="2.5" width="11" height="11" rx="2.5"/><path d="M4.6 9.4H6.4V6.6H9.6V9.4H11.4" stroke-linejoin="round"/>',   // die + centred pulse
  invert: '<path d="M2 8H14"/><path d="M3.2 8V2.6H6.6V8"/><path d="M9.4 8V13.4H12.8V8"/>',   // mirrored gate (tall)
  repeats: '<path d="M10.9 3.9A5 5 0 1 1 5.1 3.9" stroke-linecap="round"/><path d="M7.1 2.5L6 5.1L4.3 2.7Z" fill="currentColor" stroke="currentColor" stroke-width=".6" stroke-linejoin="round"/>',   // loop + clean arrowhead
};

// The spec's `icon` ids (returned by iconForMode) don't all match the terse GLYPH keys above —
// alias them so nothing silently falls back to the generic dot.
const ICON_ALIAS: Record<string, string> = {
  'pitch-bend': 'pitchbend', 'cc-recorder': 'cc_rec', 'note-filter': 'note filter',
  'poly-aftertouch': 'poly_after', 'random-note': 'random fx', 'random-octave': 'random oct',
  'random-trig-length': 'random trig', 'random-velocity': 'random vel', 'sequencer': 'seq',
  'trig': 'trigger', 'envelope': 'env', 'arpeggiator': 'arp', 'euclidean': 'euclid',
};
for (const [id, src] of Object.entries(ICON_ALIAS)) { const g = GLYPHS[src]; if (g) GLYPHS[id] = g; }

// A hit's strength → a lightning bolt (the star said nothing; Tina 2026-09-07). velocity is the
// spec icon id for the VEL mode.
GLYPHS['velocity'] = '<path d="M9.2 1.5L3.6 9h3.3L6.6 14.5 12.4 7H9z" fill="currentColor" stroke="currentColor" stroke-width="1" stroke-linejoin="round"/>';

const GENERIC = '<circle cx="8" cy="8" r="2.5"/>';

/**
 * Returns an inline `<svg>` string for a mode/FX icon id.
 * @param id  the value from `iconForMode()` — a spec `icon` id or a mode `key`.
 * @param size pixel size (default 16).
 */
export function iconSvg(id: string, size = 16): string {
  const inner = GLYPHS[id] ?? GENERIC;
  return (
    `<svg class="mode-icon" width="${size}" height="${size}" viewBox="0 0 16 16" ` +
    `fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" ` +
    `stroke-linejoin="round" aria-hidden="true" focusable="false">${inner}</svg>`
  );
}

/** True if we have a real (non-generic) placeholder for this id — for coverage reporting. */
/** The rack output-card disclosure triangle, drawn (not the OS font's `◀`/`▼`, whose proportions
 *  varied by platform and read oversized live). Filled triangle on the same 16px grid as every other
 *  icon; the closed state is the SAME path rotated 90° in CSS, so open/closed can never disagree in
 *  weight or optical centre. Default 17px (Tina's size). Colour via currentColor from the host. */
export function disclosureTriangleSvg(open: boolean, size = 17): string {
  return (
    `<svg class="disclosure-tri${open ? '' : ' is-closed'}" width="${size}" height="${size}" ` +
    `viewBox="0 0 16 16" fill="currentColor" stroke="currentColor" stroke-width="1.6" ` +
    `stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M1.2 5.2 H14.8 L8 12 Z"/></svg>`
  );
}

export function hasIcon(id: string): boolean {
  return id in GLYPHS;
}
