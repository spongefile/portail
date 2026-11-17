/** Shapes of the generated model.json (see scripts/build-model.mjs) and of a Portail config. */

export type Family = 'cv' | 'gate' | 'fx';

export interface Domain {
  labels: (string | number)[];
  count: number;
  doc: string | null;
  overflows7bit: boolean;
}

export interface ParamDef {
  index: number;
  id: string;
  label: string;
  legacyLabel: string | null;
  domain: string;
  min: number;
  /** Highest index the domain defines. */
  max: number;
  /** Highest index that actually fits in a 7-bit SysEx data byte. */
  wireMax: number;
  default: number;
  unit: string | null;
  doc: string | null;
  /** Where `doc` came from. 'editor-derived' text is our reading of the official editor's source
   *  and has not been confirmed against the manual or hardware; the UI marks it as unverified. */
  docSource: 'spec' | 'editor-derived';
}

export interface ModeDef {
  index: number;
  /** Byte written to the line's type field. Differs from `index` for post-FX (see AUDIT.md §1.2). */
  wire: number;
  key: string;
  /** Terse code the hardware shows, e.g. 'PB'. */
  name: string;
  /** Full human-readable name, e.g. 'Pitch bend' (spec-canonical `display`). */
  display: string;
  domain: string | null;
  doc: string | null;
  docSource: 'spec' | 'editor-derived';
  /** Icon id from spec when present; otherwise null and the app uses a placeholder keyed off `key`. */
  icon: string | null;
  /** Family id from spec's mode_families when present; otherwise null and the app resolves from `key`. */
  family: string | null;
  params: ParamDef[];
}

export interface GlobalEnumDef {
  id: string;
  label: string;
  kind: 'enum' | 'int';
  index: number;
  domain: string | null;
  min: number;
  max: number;
  default: number;
  unit: string | null;
  doc: string | null;
  docSource: 'spec' | 'editor-derived';
}

export interface GlobalInt14Def {
  id: string;
  label: string;
  kind: 'int14';
  msbIndex: number;
  lsbIndex: number;
  min: number;
  max: number;
  default: number;
  unit: string | null;
  doc: string | null;
  docSource: 'spec' | 'editor-derived';
}

export type GlobalDef = GlobalEnumDef | GlobalInt14Def;

export interface LineSpan {
  firstLine: number;
  lastLine: number;
  count: number;
}

export interface ModMatrixField {
  index: number;
  id: string;
  label: string;
  min?: number;
  max?: number;
  note?: string;
}

export interface Model {
  schemaVersion: number;
  specVersion: string | null;
  provenance: string;
  builtAt: string;
  source: unknown;
  device: {
    hp: number;
    cv_outputs: number;
    cv_resolution_bits: number;
    gate_outputs: number;
    gate_resolution_bits: number;
    fx_slots: number;
    cc_map_slots: number;
    preset_slots: number;
    mcu: string;
    cv_voltage_range: { min: number; max: number; unit: string };
    gate_voltage_range: { min: number; max: number; unit: string };
  };
  memory: { lineBytes: number; lines: { range: [number, number]; family: string; description: string }[] };
  layout: Record<string, LineSpan>;
  maxSysexData: number;
  domains: Record<string, Domain>;
  families: Record<Family, ModeDef[]>;
  globals: GlobalDef[];
  /** Firmware LED status palette (spec/model.json → led_colors), for the Module LED guide. */
  ledColors: unknown | null;
  /** Optional spec-provided family taxonomy; the app's families.ts is the fallback authority. */
  modeFamilies: unknown | null;
  modMatrix: {
    rows: number;
    fields: ModMatrixField[];
    destinations: { line: number; label: string; family: string }[];
  };
  validation: { seven_bit_violations?: string[]; note?: string; clampWarnings: string[] };
}

/* ------------------------------------------------------------------ config -- */

/** One of the 24 configurable slots. `bytes` is always 9 long; bytes[0] is the mode index. */
export interface Line {
  /** Mode *index* (not wire value). Post-FX wire encoding is applied at the codec boundary. */
  mode: number;
  /** Parameter bytes 1..8. Index 0 is unused and mirrors `mode`. */
  bytes: number[];
}

export interface ModRow {
  /** MIDI status nibble: 9 = note, 11 = CC. 0 = unassigned. */
  statusHigh: number;
  /** 0-15. */
  channel: number;
  /** CC or note number. */
  number: number;
  /** Target line 0-24, or 127 for unassigned. */
  targetLine: number;
  /** Target parameter index within the line. 0 = slot unused. */
  targetParam: number;
  valueMin: number;
  valueMax: number;
}

export interface PortailConfig {
  /** Bumped whenever the on-disk JSON shape changes incompatibly. */
  configVersion: number;
  /** Free-text, saved with the file, never sent to the module. */
  name: string;
  lines: Line[];
  /** 8 raw global bytes, exactly as line 24 is stored on the device. */
  globals: number[];
  modMatrix: ModRow[];
}

export const CONFIG_VERSION = 1;
export const LINE_COUNT = 24;
export const LINE_BYTES = 9;
export const GLOBAL_BYTES = 8;
