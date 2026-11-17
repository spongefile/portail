/**
 * The editor mode-family palette (DESIGN.md §6.2, decision 11).
 *
 * This is an EDITOR convention — it tints output-jack rings by the family of their current mode.
 * It is NOT the hardware LED colour language (that is `spec/model.json → led_colors`, surfaced only
 * by the Module LED guide, §6.6). The two colour systems are deliberately separate.
 *
 * This module is the app-side authority for the palette. If `spec/model.json` later gains a
 * `mode_families` block and a per-mode `family` field, the adapter passes them through and
 * `familyOfMode()` prefers the spec value; the colours below still belong to the app because they
 * are presentation, not a hardware fact.
 *
 * Hues borrow the user's Befaco/Banananuts patch-cable domains (green = pitch,
 * purple = CV, yellow = gate/trig); intensity splits families that share a hue.
 */

export type FamilyId = 'pitch' | 'expression' | 'modulation' | 'gate' | 'clock' | 'off';

export interface ModeFamily {
  id: FamilyId;
  label: string;
}

export const MODE_FAMILIES: Record<FamilyId, ModeFamily> = {
  pitch:      { id: 'pitch',      label: 'Pitch' },
  expression: { id: 'expression', label: 'Expression' },
  modulation: { id: 'modulation', label: 'Modulation' },
  gate:       { id: 'gate',       label: 'Gate / Trigger' },
  clock:      { id: 'clock',      label: 'Clock' },
  off:        { id: 'off',        label: 'Off' },
};

export const FAMILY_ORDER: FamilyId[] = ['pitch', 'expression', 'modulation', 'gate', 'clock', 'off'];

/**
 * Maps a mode `key` (as it appears in the model, across CV/gate families) to its editor family.
 * Keys come from spec/model.json → modes.{cv,gate,fx}[].key.
 */
const KEY_TO_FAMILY: Record<string, FamilyId> = {
  off: 'off',
  // Pitch
  note: 'pitch', arp: 'pitch', seq: 'pitch', gate_seq: 'pitch',
  // Expression
  vel: 'expression', aftertouch: 'expression', poly_after: 'expression',
  pitchbend: 'expression', cc: 'expression', cc_rec: 'expression',
  // Modulation
  lfo: 'modulation', env: 'modulation', 'random cv': 'modulation', random: 'modulation',
  // Gate / Trigger
  gate: 'gate', cvtrigger: 'gate', trigger: 'gate', euclid: 'gate',
  // Clock
  clock: 'clock',
};

/** Resolve a mode key to its family id. Unknown keys fall back to OFF (grey). */
export function familyOfKey(key: string): FamilyId {
  return KEY_TO_FAMILY[key] ?? 'off';
}

/**
 * The runtime tint for a family: a CSS variable. The hexes live in styles.css as --fam-<id> and are
 * the ONLY source of truth for what renders (the app is dark-only). There is deliberately no hex
 * copy in this module — a hand-maintained second copy silently drifted twice; if a non-CSS consumer
 * ever needs the values, generate them from styles.css/spec at build time like model.json.
 */
export function familyColor(id: FamilyId): string | null {
  return id === 'off' ? null : `var(--fam-${id})`;
}
