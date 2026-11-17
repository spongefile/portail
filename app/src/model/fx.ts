/**
 * FX chain model (DESIGN.md §6.5). FX slots (lines 16-23) each target one output; all FX targeting
 * the same output form a chain, processed in FX-SLOT order (lower slot first). This derives, once,
 * the chain for every output so both the inspector strip and the dedicated signal-flow view are thin
 * projections of the same data.
 */

import type { PortailConfig } from './types';
import { LINE_BYTES } from './types';
import { lineWithDefaults, modeByIndex } from './model';

export interface FxChainEntry {
  /** FX line index 16-23. */
  fxLine: number;
  /** FX slot number 1-8. */
  fxSlot: number;
  /** mode index within the fx family. */
  mode: number;
  /** display name, e.g. "SCALE". */
  name: string;
  /** full human-readable name, e.g. "Random octave". */
  display: string;
  /** mode key, for icon lookup. */
  key: string;
  /** a short parameter summary, e.g. "minor". */
  summary: string;
  /** true when the target output's current mode doesn't produce the signal this FX processes,
   *  so the FX does nothing (docs/fx/index.md:33). Kept in the chain, shown dimmed. */
  inert: boolean;
}

export interface OutputChain {
  /** output line 0-15. */
  line: number;
  family: 'cv' | 'gate';
  /** 1-based output index within its family. */
  index: number;
  entries: FxChainEntry[];
}

/** Whether an FX mode targets the CV bank (vs the GATE bank), from its `dest` domain. */
export function fxTargetsCv(fxModeIndex: number): boolean {
  const mode = modeByIndex('fx', fxModeIndex);
  return (mode?.params[0]?.domain ?? '').includes('cv');
}

/*
 * FX are INERT unless their target output runs a mode that PRODUCES the signal they process
 * (docs/fx/index.md:33 — a known rule, not inferred): a Note FX (CV bank) needs its CV target in a
 * note-producing mode; a Gate FX (GATE bank) needs its GATE target in a gate-producing mode.
 * Derived from mode KEYS, never indices — the two banks reuse index numbers for different modes
 * (index 11 is seq in CV but gate_seq in gate; index 13 is arp vs euclid).
 */
const CV_FX_WAKE_KEYS = ['note', 'arp', 'seq', 'random cv'];
const GATE_FX_WAKE_KEYS = ['gate', 'trigger', 'env', 'gate_seq', 'random', 'euclid'];

function modeNameByKey(family: 'cv' | 'gate', key: string): string | null {
  for (let i = 0; i < 16; i++) { const m = modeByIndex(family, i); if (m && m.key === key) return m.display; }
  return null;
}

/** Display names of the modes that would wake a bank's FX (for the insert hint + the inert label). */
export function fxWakeModeNames(targetsCv: boolean): string[] {
  const fam = targetsCv ? 'cv' : 'gate';
  const keys = targetsCv ? CV_FX_WAKE_KEYS : GATE_FX_WAKE_KEYS;
  return keys.map((k) => modeNameByKey(fam, k)).filter((n): n is string => !!n);
}

/** The output line an FX targets (its target byte resolved into the CV/GATE bank). */
export function fxTargetLine(config: PortailConfig, fxLine: number): number {
  const l = config.lines[fxLine]!;
  const target = l.bytes[1] ?? 0;
  return fxTargetsCv(l.mode) ? target : target + 8;
}

/** Whether an output's CURRENT mode wakes same-bank FX (true → FX live; false → they're inert). */
export function outputModeWakesFx(config: PortailConfig, outputLine: number): boolean {
  const fam = outputLine < 8 ? 'cv' : 'gate';
  const m = modeByIndex(fam, config.lines[outputLine]!.mode);
  if (!m) return false;
  return (fam === 'cv' ? CV_FX_WAKE_KEYS : GATE_FX_WAKE_KEYS).includes(m.key);
}

/** True when an FX does nothing because its target output's mode doesn't produce its input signal. */
export function isFxInert(config: PortailConfig, fxLine: number): boolean {
  const l = config.lines[fxLine]!;
  const mode = modeByIndex('fx', l.mode);
  if (!mode || mode.key === 'off') return false;
  return !outputModeWakesFx(config, fxTargetLine(config, fxLine));
}

function fxSummary(config: PortailConfig, fxLine: number): string {
  const l = config.lines[fxLine]!;
  const mode = modeByIndex('fx', l.mode);
  if (!mode) return '';
  // Prefer the first non-target parameter as the identifying summary.
  const p = mode.params.find((x) => x.index >= 2);
  if (!p) return '';
  // Value label via the model; kept simple here to avoid a circular import.
  return p.label;
}

/** Chains for all 16 outputs, in output order. Outputs with no FX get an empty `entries`. */
export function chainsByOutput(config: PortailConfig): OutputChain[] {
  const chains: OutputChain[] = [];
  for (let line = 0; line < 16; line++) {
    const family = line < 8 ? 'cv' : 'gate';
    const bankIndex = line < 8 ? line : line - 8; // 0-7 within the bank
    const entries: FxChainEntry[] = [];
    for (let fxLine = 16; fxLine < 24; fxLine++) {
      const l = config.lines[fxLine]!;
      const mode = modeByIndex('fx', l.mode);
      if (!mode || mode.key === 'off') continue;
      const target = l.bytes[1] ?? 0;
      const targetsCv = fxTargetsCv(l.mode);
      if ((targetsCv && family === 'cv' && target === bankIndex) ||
          (!targetsCv && family === 'gate' && target === bankIndex)) {
        entries.push({
          fxLine,
          fxSlot: fxLine - 16 + 1,
          mode: l.mode,
          name: mode.name,
          display: mode.display,
          key: mode.key,
          summary: fxSummary(config, fxLine),
          inert: !outputModeWakesFx(config, line),
        });
      }
    }
    chains.push({ line, family, index: bankIndex + 1, entries });
  }
  return chains;
}

/** Just the chain for one output line. */
export function chainForOutput(config: PortailConfig, line: number): FxChainEntry[] {
  return chainsByOutput(config).find((c) => c.line === line)?.entries ?? [];
}

/* ------------------------------------------------------- chain mutation ops */
/*
 * All pure: they take a config and mutate it in place (callers pass a draft via store.commit).
 * FX are a SHARED pool of 8 slots (lines 16-23). Note-domain FX (mode 1-8) target CV outputs;
 * gate-domain FX (mode 9-15) target GATE outputs. Chain order == FX-slot order.
 */

/** FX modes that can target this output family (CV: note-domain 1-8; GATE: gate-domain 9-15). */
export function validFxModesForOutput(outputLine: number): { index: number; name: string; display: string; key: string; icon: string | null }[] {
  const wantCv = outputLine < 8;
  const out: { index: number; name: string; display: string; key: string; icon: string | null }[] = [];
  for (const m of modeByFamilyList()) {
    if (m.index === 0) continue;
    const targetsCv = fxTargetsCv(m.index);
    if (targetsCv === wantCv) out.push({ index: m.index, name: m.name, display: m.display, key: m.key, icon: m.icon ?? null });
  }
  return out;
}

function modeByFamilyList() {
  // small local helper to avoid importing modesFor (keeps this module lean)
  const arr: { index: number; name: string; display: string; key: string; icon: string | null }[] = [];
  for (let i = 0; i < 16; i++) {
    const m = modeByIndex('fx', i);
    if (m) arr.push({ index: m.index, name: m.name, display: m.display, key: m.key, icon: m.icon ?? null });
  }
  return arr;
}

/** The default FX mode to insert for an output: SCALE for CV, DELAY for GATE. */
function defaultFxMode(outputLine: number): number {
  return outputLine < 8 ? 7 /* SCALE */ : 9 /* DELAY */;
}

/** FX line indices (16-23) whose mode is OFF. */
export function freeFxSlots(config: PortailConfig): number[] {
  const free: number[] = [];
  for (let fx = 16; fx < 24; fx++) {
    const m = modeByIndex('fx', config.lines[fx]!.mode);
    if (!m || m.key === 'off') free.push(fx);
  }
  return free;
}

export function usedFxCount(config: PortailConfig): number {
  return 8 - freeFxSlots(config).length;
}

/**
 * Append a new FX to `outputLine`'s chain. Claims the lowest free slot that sorts AFTER the chain's
 * current members (so it processes last); if none is free above them, the lowest free slot overall.
 * Returns the claimed FX line, or null if the pool is full.
 */
export function insertFxForOutput(config: PortailConfig, outputLine: number, modeIndex?: number): number | null {
  const free = freeFxSlots(config);
  if (free.length === 0) return null;

  const chain = chainForOutput(config, outputLine);
  const lastSlotLine = chain.length ? chain[chain.length - 1]!.fxLine : 15;
  const slot = free.find((f) => f > lastSlotLine) ?? free[0]!;

  const mode = modeIndex ?? defaultFxMode(outputLine);
  const line = lineWithDefaults('fx', mode);
  // Point it at this output (target byte is index 1, the bank index 0-7).
  line.bytes[1] = outputLine < 8 ? outputLine : outputLine - 8;
  config.lines[slot] = line;
  return slot;
}

/** Turn an FX slot OFF, freeing it. */
export function removeFx(config: PortailConfig, fxLine: number): void {
  config.lines[fxLine] = { mode: 0, bytes: new Array<number>(LINE_BYTES).fill(0) };
}

/**
 * Move an FX earlier (dir -1) or later (dir +1) in its output's chain by swapping the whole line
 * contents of its slot with the adjacent chain member's slot. Order == slot order, and both members
 * target the same output, so swapping their contents reorders the chain without touching other
 * outputs. No-op at the ends.
 */
export function reorderFxInChain(config: PortailConfig, fxLine: number, newIndex: number): number | null {
  const mode = modeByIndex('fx', config.lines[fxLine]!.mode);
  if (!mode || mode.key === 'off') return null;
  const target = config.lines[fxLine]!.bytes[1] ?? 0;
  const outputLine = fxTargetsCv(config.lines[fxLine]!.mode) ? target : target + 8;
  const chain = chainForOutput(config, outputLine);
  const slots = chain.map((e) => e.fxLine);              // ascending fxLine == chain order
  const contents = chain.map((e) => config.lines[e.fxLine]!);
  const from = chain.findIndex((e) => e.fxLine === fxLine);
  if (from < 0) return null;
  const to = Math.max(0, Math.min(newIndex, contents.length - 1));
  if (to === from) return null;
  const moved = contents.splice(from, 1)[0]!;
  contents.splice(to, 0, moved);
  slots.forEach((slot, i) => { config.lines[slot] = contents[i]!; });
  return slots[to]!; // the moved FX now occupies this slot
}

export function moveFxInChain(config: PortailConfig, fxLine: number, dir: -1 | 1): number | null {
  // Find the output this FX targets, then its chain.
  const mode = modeByIndex('fx', config.lines[fxLine]!.mode);
  if (!mode || mode.key === 'off') return null;
  const target = config.lines[fxLine]!.bytes[1] ?? 0;
  const outputLine = fxTargetsCv(config.lines[fxLine]!.mode) ? target : target + 8;

  const chain = chainForOutput(config, outputLine);
  const pos = chain.findIndex((e) => e.fxLine === fxLine);
  const swapPos = pos + dir;
  if (pos < 0 || swapPos < 0 || swapPos >= chain.length) return null;

  const a = fxLine;
  const b = chain[swapPos]!.fxLine;
  const tmp = config.lines[a]!;
  config.lines[a] = config.lines[b]!;
  config.lines[b] = tmp;
  return b; // the moved FX's contents now live at slot b
}
