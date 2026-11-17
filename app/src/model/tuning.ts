/**
 * Microtonal tuning tables (DESIGN: Tuning tab). A tuning is 12 cent offsets, one per pitch class
 * C..B, where the module expands each note as `note_cents = (note/12)*1200 + table[note%12]`
 * (spec/microtonal-tables.md). Pitch class 0 (C, the root) is 0 by convention; the octave (1200) is
 * added by the module, never stored in the table.
 *
 * The module cannot return a table, so these live entirely in the app (a local library) and are
 * *sent* to one of the module's 8 slots. See src/model/scl.ts for Scala import/export.
 */

export const PITCH_CLASS_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** Standard 12-tone equal temperament — the module's factory content for every slot. */
export const TWELVE_TET: readonly number[] = [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100];

/** Highest per-class cents the module can hold without overflowing at the top note (see codec). */
export const MAX_CENTS = 4383;

export interface Tuning {
  id: string;
  name: string;
  /** 12 cent values, one per pitch class C..B. cents[0] is the root (normally 0). */
  cents: number[];
  /** Optional explanatory note (shown in the editor for factory presets). */
  note?: string;
}

/** Factory presets, seeded into every library (stable ids so they're not duplicated). */
export const FACTORY_TUNINGS: readonly Tuning[] = [
  { id: 'factory-12tet', name: '12-TET (standard)', cents: [...TWELVE_TET] },
  {
    id: 'factory-24tet-offset',
    name: 'Quarter-tone (24-TET offset)',
    cents: [50, 150, 250, 350, 450, 550, 650, 750, 850, 950, 1050, 1150],
    note: 'Every pitch class raised a quarter-tone (50¢) — the upper half of the 24-TET grid. A single ' +
      'table can\'t hold all 24 quarter-tones, so pair this on one output with a plain 12-TET output: ' +
      'together they cover the full 24-TET set. Handy for quarter-tone material à la Angine de Poitrine.',
  },
];

export function isTwelveTet(cents: readonly number[]): boolean {
  return cents.length === 12 && cents.every((c, i) => Math.round(c) === TWELVE_TET[i]);
}

/** A fresh 12-TET tuning with the given name/id. */
export function newTuning(id: string, name = 'New tuning'): Tuning {
  return { id, name, cents: [...TWELVE_TET] };
}

/** Clamp/validate a tuning's 12 values into the module's safe range; returns a fixed copy. */
export function sanitizeCents(cents: readonly number[]): number[] {
  const out = new Array(12).fill(0);
  for (let i = 0; i < 12; i++) {
    const v = Number(cents[i]);
    out[i] = Number.isFinite(v) ? Math.max(0, Math.min(MAX_CENTS, Math.round(v))) : 0;
  }
  return out;
}
