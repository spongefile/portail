/** Loads the generated model and exposes typed lookups over it. */

import raw from './model.json';
import type {
  Domain, Family, GlobalDef, Line, Model, ModeDef, ParamDef, PortailConfig,
} from './types';
import { CONFIG_VERSION, GLOBAL_BYTES, LINE_BYTES, LINE_COUNT } from './types';

export const model = raw as unknown as Model;

export const FAMILIES: Family[] = ['cv', 'gate', 'fx'];

/** Which family a line index belongs to. Lines 0-7 CV, 8-15 gate, 16-23 FX. */
export function familyOfLine(line: number): Family {
  if (line < 8) return 'cv';
  if (line < 16) return 'gate';
  return 'fx';
}

/** 1-based label for a line within its family, e.g. line 9 -> "GATE 2". */
export function lineLabel(line: number): string {
  const fam = familyOfLine(line);
  const n = (line & 7) + 1;
  return `${fam === 'cv' ? 'CV' : fam === 'gate' ? 'GATE' : 'FX'} ${n}`;
}

export function modesFor(family: Family): ModeDef[] {
  return model.families[family];
}

export function modeByIndex(family: Family, index: number): ModeDef | undefined {
  return model.families[family].find((m) => m.index === index);
}

/** Reverse of the post-FX wire encoding. Returns undefined for bytes no mode claims. */
export function modeByWire(family: Family, wire: number): ModeDef | undefined {
  return model.families[family].find((m) => m.wire === wire);
}

export function domain(name: string): Domain | undefined {
  return model.domains[name];
}

/** Human-readable value for a parameter byte, e.g. 60 -> "C3". Falls back to the raw number. */
export function labelFor(param: ParamDef, value: number): string {
  const d = model.domains[param.domain];
  const label = d?.labels[value];
  // model.json label arrays are mixed string/number, so coerce — a numeric label must not leak out
  // as a number (callers do string ops like .trim(); see params.ts referencedJackColor).
  return String(label ?? value);
}

/** The parameter definition at a byte index within a line of a given mode. */
export function paramAt(family: Family, modeIndex: number, byteIndex: number): ParamDef | undefined {
  return modeByIndex(family, modeIndex)?.params.find((p) => p.index === byteIndex);
}

export function globalById(id: string): GlobalDef | undefined {
  return model.globals.find((g) => g.id === id);
}

/* ------------------------------------------------------------------ config -- */

export function emptyLine(): Line {
  return { mode: 0, bytes: new Array<number>(LINE_BYTES).fill(0) };
}

/** A line set to `modeIndex` with every parameter at its documented default. */
export function lineWithDefaults(family: Family, modeIndex: number): Line {
  const line = emptyLine();
  line.mode = modeIndex;
  line.bytes[0] = modeIndex;
  const mode = modeByIndex(family, modeIndex);
  if (mode) for (const p of mode.params) line.bytes[p.index] = p.default;
  return line;
}

export function defaultGlobals(): number[] {
  const g = new Array<number>(GLOBAL_BYTES).fill(0);
  for (const def of model.globals) {
    if (def.kind === 'int14') {
      g[def.msbIndex] = (def.default >> 7) & 0x7f;
      g[def.lsbIndex] = def.default & 0x7f;
    } else {
      g[def.index] = def.default;
    }
  }
  return g;
}

/** An all-OFF config — what a factory-fresh preset slot should look like. */
export function emptyConfig(name = 'Untitled'): PortailConfig {
  return {
    configVersion: CONFIG_VERSION,
    name,
    lines: Array.from({ length: LINE_COUNT }, () => emptyLine()),
    globals: defaultGlobals(),
    modMatrix: Array.from({ length: model.modMatrix.rows }, () => ({
      statusHigh: 0, channel: 0, number: 0, targetLine: 127, targetParam: 0, valueMin: 0, valueMax: 0,
    })),
  };
}

export function cloneConfig(c: PortailConfig): PortailConfig {
  return structuredClone(c);
}

/** Deep value equality, used to decide whether the editor is in sync with the module. */
export function configsEqual(a: PortailConfig, b: PortailConfig): boolean {
  return JSON.stringify(stripMeta(a)) === JSON.stringify(stripMeta(b));
}

/** Everything that is actually stored on the device — excludes editor-only metadata like `name`. */
function stripMeta(c: PortailConfig) {
  return { lines: c.lines, globals: c.globals, modMatrix: c.modMatrix };
}

/** Byte-level diff between two configs, for the sync review panel. */
export interface ConfigDiff {
  lines: { line: number; label: string; from: Line; to: Line }[];
  globals: boolean;
  modMatrix: boolean;
}

/**
 * The byte indices that MATTER for a line in a given mode: byte 0 (the mode) plus each of that
 * mode's parameters. The rest are padding the mode doesn't use. Derived from the model so it can't
 * drift from the spec.
 */
export function meaningfulByteIndices(family: Family, modeIndex: number): number[] {
  const mode = modeByIndex(family, modeIndex);
  return [0, ...(mode?.params.map((p) => p.index) ?? [])];
}

export function diffConfigs(from: PortailConfig, to: PortailConfig): ConfigDiff {
  const lines: ConfigDiff['lines'] = [];
  for (let i = 0; i < LINE_COUNT; i++) {
    const a = from.lines[i]!;
    const b = to.lines[i]!;
    // Compare only the bytes the current mode actually uses. Real hardware round-trips a line's
    // PADDING bytes differently from what an editor-built (not read-back) config holds, so an
    // all-bytes compare falsely flagged untouched lines as "didn't take" after a send. A clamped or
    // rejected value still lands in a MEANINGFUL byte, so genuine mismatches are still caught.
    const differs = a.mode !== b.mode
      || meaningfulByteIndices(familyOfLine(i), b.mode).some((j) => a.bytes[j] !== b.bytes[j]);
    if (differs) {
      lines.push({ line: i, label: lineLabel(i), from: a, to: b });
    }
  }
  return {
    lines,
    globals: from.globals.some((v, i) => v !== to.globals[i]),
    modMatrix: JSON.stringify(from.modMatrix) !== JSON.stringify(to.modMatrix),
  };
}

export function diffIsEmpty(d: ConfigDiff): boolean {
  return d.lines.length === 0 && !d.globals && !d.modMatrix;
}

/* ------------------------------------------------------------------ globals -- */

export function readGlobal(globals: number[], def: GlobalDef): number {
  if (def.kind === 'int14') {
    return ((globals[def.msbIndex] ?? 0) << 7) | ((globals[def.lsbIndex] ?? 0) & 0x7f);
  }
  return globals[def.index] ?? 0;
}

export function writeGlobal(globals: number[], def: GlobalDef, value: number): number[] {
  const next = globals.slice();
  const v = Math.max(def.min, Math.min(def.max, value));
  if (def.kind === 'int14') {
    next[def.msbIndex] = (v >> 7) & 0x7f;
    next[def.lsbIndex] = v & 0x7f;
  } else {
    next[def.index] = v & 0x7f;
  }
  return next;
}

/* ------------------------------------------------------ mode families / icons */

import { familyOfKey, familyColor, MODE_FAMILIES, type FamilyId } from './families';

/**
 * The editor mode-family id for a line's current mode. Prefers a spec-provided `family` on the mode;
 * falls back to the app's key→family map (families.ts). Editor convention, not hardware (DESIGN §6.2).
 */
export function familyOfMode(family: Family, modeIndex: number): FamilyId {
  const mode = modeByIndex(family, modeIndex);
  if (!mode) return 'off';
  if (mode.family && mode.family in MODE_FAMILIES) return mode.family as FamilyId;
  return familyOfKey(mode.key);
}

/** Ring tint for a line's current mode, or null when OFF/unlit. */
export function modeColor(family: Family, modeIndex: number): string | null {
  return familyColor(familyOfMode(family, modeIndex));
}

/** Placeholder-safe icon id for a mode: spec `icon` when present, else the mode `key`. */
export function iconForMode(family: Family, modeIndex: number): string {
  const mode = modeByIndex(family, modeIndex);
  return mode?.icon ?? mode?.key ?? 'off';
}

/* ---------------------------------------------------------- per-family width */

/**
 * Bytes in a line for this family. CV and Gate lines are 9 bytes; FX lines are 8
 * (confirmed from firmware — spec/protocol.md §2.1, DESIGN §4.2). The codec uses this to size
 * writes and validate reply lengths per family.
 */
export function bytesForFamily(family: Family): number {
  return family === 'fx' ? 8 : 9;
}
