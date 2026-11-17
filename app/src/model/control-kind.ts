/**
 * DESIGN board 6 — pick a param's control from its DOMAIN, never per-parameter (a per-param table
 * drifts from the spec). Keyed on the domain NAME over the ~73 domains in model.json; returns the
 * control kind AND whether the field needs to span two grid columns (chip rows that can't fit one).
 *
 * Rule for ordinal magnitudes: >6 stops → slider, ≤6 → segmented (a 4–5 stop slider is worse than
 * hitting the stop directly). Two domains must NOT be sliders even though they look numeric —
 * ch_menu (a channel is an address, not a magnitude) and the voltage ranges (each chip is a span
 * against a zero line, not an ordered magnitude).
 */

export type ControlKind =
  | 'slider'        // ordinal magnitude, >6 stops
  | 'gated-slider'  // a mode head (e.g. Latch) + a duration slider that appears when the mode is off
  | 'detented'      // musical-ratio slider with landmark stops
  | 'segmented'     // short nominal / small ordinal, hit directly
  | 'channel-grid'  // MIDI channel: inline 4×4, address not magnitude (spans 2 ROWS)
  | 'wave-chips'    // LFO waveform: draw each shape + label (spans 2 ROWS — a chip is taller than a slider)
  | 'division-grid'
  | 'table-grid'    // the 8 microtonal tables: 4×2 radio grid with the tuning library's names // clock divisions as base × feel (straight/triplet/dotted); spans 2 COLS and 2 ROWS
  | 'voltage-chips' // voltage spans drawn against a zero line (spans 2 COLS)
  | 'jack-chips'    // family-coloured output targets (spans 2 COLS)
  | 'keyboard'      // note picker, piano popover
  | 'toggle'        // two-state
  | 'dropdown';     // nominal with no order to exploit (the lone survivor)

export interface ControlChoice { kind: ControlKind; span: 1 | 2; }

/** Explicit domain → kind map. Anything unlisted falls back to a dropdown (safe, keyboard-native). */
const DOMAIN_KIND: Record<string, ControlKind> = {
  // Sliders — ordinal magnitude, >6 stops
  _100_menu: 'slider', _127_menu: 'slider', _128_menu: 'slider', _63_menu: 'slider',
  _64_menu: 'slider', _int63_menu: 'slider', bipolar_menu: 'slider', clock_speed_menu: 'slider',
  delay_ms: 'slider', env_times: 'slider', glide_times: 'slider', glide_times2: 'slider',
  ms_128_menu: 'slider', ocatves_menu: 'slider', off_100_menu: 'slider',
  off_127_menu: 'slider', pb_range_menu: 'slider', percent_menu: 'slider', rise_time: 'slider',
  semi_tone_range_menu: 'slider', transpose_menu: 'slider', vib_speed: 'slider',

  // Detented — musical-ratio sliders with landmark stops
  divisions_menu: 'detented',

  // Division grids — base × feel (straight/triplet/dotted); a slider puts 1/4 and 1/4T fifteen
  // stops apart, the grid puts them one cell apart (board 8, item 2)
  div_menu: 'division-grid', lfo_div_menu: 'division-grid',

  // Gated slider — a head that isn't a duration (Latch = hold until next event) split from the ms range.
  length_menu: 'gated-slider',

  // Segmented — short nominal, or ordinal ≤6 (oct_menu/range_oct_menu flipped here from slider)
  clock_type_menu: 'segmented', env_type_menu: 'segmented', group_menu: 'segmented',
  lfo_mode_menu: 'segmented', logic_menu: 'segmented',
  math_func_menu: 'segmented', note_in_dest_menu: 'segmented', note_in_rec_menu: 'segmented',
  oct_menu: 'segmented', range_oct_menu: 'segmented',
  source_menu: 'segmented', vel_dest_menu: 'segmented', fx_dest_prm: 'segmented', prm_menu: 'segmented',
  sync_menu: 'segmented', // internal / external are two named alternatives, not an on/off switch
  _1_8_menu: 'table-grid', // 8 table addresses: 4×2 grid naming each table's last-sent content

  // Channel — inline 4×4, spans two rows
  ch_menu: 'channel-grid', channels: 'channel-grid',

  // Picture chips (board 8): shape + word. Waves — noise vs random are near-synonyms as words,
  // obviously different as pictures. Direction — the double arrow is what "pendulum" fails to say.
  // Swing — the displaced off-beat IS the timing.
  lfo_type_menu: 'wave-chips', seq_dir_menu: 'wave-chips', swing_menu: 'wave-chips',

  // Voltage spans — each chip a span against zero
  range_cv_menu: 'voltage-chips', range_cv_note_menu: 'voltage-chips', range_gate_menu: 'voltage-chips',
  invert_range_cv_menu: 'voltage-chips', invert_range_gate_menu: 'voltage-chips',

  // Jack chips — family-coloured output targets
  fx_dest_menu_cv: 'jack-chips', fx_dest_menu_gate: 'jack-chips', dest_note_menu: 'jack-chips',
  dest_menu: 'jack-chips',

  // Keyboard — note pickers
  note_menu: 'keyboard', note_all_menu: 'keyboard', notenames: 'keyboard',

  // Toggles — two-state
  _0_1_menu: 'toggle', onoff_menu: 'toggle', clock_state_menu: 'toggle',
  glide_mode_menu: 'toggle', global_menu: 'toggle', seq_gate_type_menu: 'toggle',
  seq_type_menu: 'toggle', note_in_dest_gate: 'toggle',

  // Dropdown — nominal, no order to exploit
  tables_menu: 'dropdown',
};

/** Kinds that can't fit one grid column and take two. */
const SPAN2: ReadonlySet<ControlKind> = new Set<ControlKind>(['voltage-chips', 'jack-chips', 'division-grid', 'table-grid']);

export function classifyDomain(name: string): ControlChoice {
  const kind = DOMAIN_KIND[name] ?? 'dropdown';
  return { kind, span: SPAN2.has(kind) ? 2 : 1 };
}
