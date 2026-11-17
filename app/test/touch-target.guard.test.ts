import { describe, it, expect } from 'vitest';
// @ts-expect-error node builtin; no @types/node, resolved at runtime
import { readFileSync } from 'node:fs';

/**
 * Guard for the recurring trap: a component-scoped rule re-declares a touch target's height at higher
 * specificity than the coarse-pointer 44px floor, shrinking it below 44px on touch. Targets are
 * DERIVED from the @media (pointer: coarse) block; both height and min-height are audited (a `height`
 * floor is itself specificity-vulnerable). This guard has grown its own component, so heightPx has
 * its own tests below.
 */

/** The effective floor a rule body declares in px: min-height if present else height. null = none;
 *  throws on a unit it can't compare (calc/vh/%/pt/unitless-non-zero) rather than misparsing it. */
export function heightPx(body: string): number | null {
  const grab = (prop: string): string | null => {
    const m = new RegExp(`(?:^|[;{]|\\s)${prop}\\s*:\\s*([^;}]+)`).exec(body);
    return m ? m[1]!.trim() : null;
  };
  const raw = grab('min-height') ?? grab('height'); // the anchor also excludes line-/max-height
  if (raw === null) return null;
  if (/^(auto|inherit|initial|unset|revert)$/.test(raw)) return null;
  const n = /^([\d.]+)(px|rem|em)?$/.exec(raw);
  if (!n) throw new Error(`touch-target guard: unparseable height "${raw}"`); // calc(), vh, %, pt…
  const v = Number(n[1]);
  if (n[2] === 'rem' || n[2] === 'em') return v * 16;
  if (n[2] === 'px') return v;
  if (v === 0) return null;                          // unitless 0 — the flexbox idiom, not a floor
  throw new Error(`touch-target guard: unitless non-zero height "${raw}"`);
}

describe('heightPx', () => {
  it('reads px and rem, prefers min-height, ignores line-/max-height and 0', () => {
    expect(heightPx('min-height: 44px')).toBe(44);
    expect(heightPx('min-height: 2.5rem')).toBe(40);
    expect(heightPx('height: 30px; min-height: 44px')).toBe(44);   // min-height wins
    expect(heightPx('line-height: 1.2')).toBeNull();               // not a height
    expect(heightPx('max-height: 20px')).toBeNull();
    expect(heightPx('min-height: 0')).toBeNull();                  // flex idiom
    expect(heightPx('color: red')).toBeNull();
  });
  it('throws on units it cannot compare, instead of silently misparsing', () => {
    expect(() => heightPx('min-height: 50vh')).toThrow();
    expect(() => heightPx('min-height: 30pt')).toThrow();
    expect(() => heightPx('min-height: calc(44px - 2px)')).toThrow();
    expect(() => heightPx('min-height: 40%')).toThrow();
  });
});

const css: string = readFileSync('src/styles.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1]!.trim(), body: m[2]!, index: m.index! }));
import { CONTROL_TOUCH_TARGETS } from '../src/ui/controls';
const commaParts = (sel: string) => sel.split(',').map((s) => s.trim());
const trailingToken = (sel: string) => sel.trim().split(/\s+/).pop()!;

/** The trailing compound of a selector, splitting descendant AND combinators (> + ~), so
 *  '.foo>.seg-item' and '.a .radio-cell.is-on' both yield the right final compound. */
export function trailingCompound(sel: string): string {
  return sel.trim().split(/[\s>+~]+/).filter(Boolean).pop() ?? '';
}
/** Is this selector a touch-target context — i.e. does its trailing compound carry a floored token,
 *  as the whole compound or with a state/attribute appended ('.radio-cell.is-on', '.seg-item:hover')?
 *  Deliberately NOT substring (so '.radio-cell-label' is not caught). */
export function isTargetSelector(sel: string, tokens: Set<string>): boolean {
  const tc = trailingCompound(sel);
  for (const t of tokens) if (tc === t || tc.startsWith(t + '.') || tc.startsWith(t + ':')) return true;
  return false;
}

function coarseBounds(): [number, number][] {
  const out: [number, number][] = [];
  const re = /@media\s*\(\s*pointer\s*:\s*coarse\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(css))) {
    let i = css.indexOf('{', m.index), depth = 0;
    for (; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') { depth--; if (depth === 0) { out.push([m.index, i]); break; } }
    }
  }
  return out;
}

describe('isTargetSelector', () => {
  const tokens = new Set(['.radio-cell', '.seg-item', 'select.pfield-control']);
  const target = (s: string) => isTargetSelector(s, tokens);
  it('recognises compound and combinator selectors, not just whitespace-descendant ones', () => {
    expect(target('.tuning-x .radio-cell')).toBe(true);
    expect(target('.segmented.is-jack .seg-item')).toBe(true);
    expect(target('.tuning-x > .radio-cell')).toBe(true);
    expect(target('.radio-cell.is-on')).toBe(true);
    expect(target('.tuning-x .radio-cell.is-on')).toBe(true);
    expect(target('.seg-item:focus-visible')).toBe(true);
    expect(target('.foo>.seg-item')).toBe(true);
    expect(target('select.pfield-control')).toBe(true);
    expect(target('.foo select.pfield-control.is-x')).toBe(true);
  });
  it('does NOT match a different class that merely shares a prefix', () => {
    expect(target('.radio-cell-label')).toBe(false);
    expect(target('.seg-items')).toBe(false);
    expect(target('.some-panel')).toBe(false);
  });
});

describe('touch targets keep their 44px floor in every scope', () => {
  it('every context that re-declares a floored target restates >=44px under coarse pointer', () => {
    const coarse = coarseBounds();
    const inCoarse = (i: number) => coarse.some(([a, b]) => i > a && i < b);

    const flooredSelectors = new Set<string>();
    const targetTokens = new Set<string>();
    for (const r of rules) {
      if (!inCoarse(r.index)) continue;
      const h = heightPx(r.body);
      if (h !== null && h >= 44) for (const p of commaParts(r.selector)) { flooredSelectors.add(p); targetTokens.add(trailingToken(p)); }
    }
    expect(targetTokens.size).toBeGreaterThan(2); // tripwire: auditing more than radio-cell/seg-item

    const offenders: string[] = [];
    for (const r of rules) {
      if (inCoarse(r.index)) continue;
      // Evaluate each comma-part independently; a pseudo-element (::track/::thumb) styles a sub-part,
      // not the target's box, so drop those parts rather than the whole rule.
      const realParts = commaParts(r.selector).filter((p) => !p.includes('::'));
      const targetParts = realParts.filter((p) => isTargetSelector(p, targetTokens));
      if (!targetParts.length) continue;
      const h = heightPx(r.body);
      if (h === null || h >= 44) continue;
      for (const p of targetParts) if (!flooredSelectors.has(p)) offenders.push(p);
    }
    expect(offenders).toEqual([]);
  });
});

describe('every control the factory renders is floored on coarse pointer', () => {
  it('each CONTROL_TOUCH_TARGETS selector has a >=44px min-height under @media (pointer: coarse)', () => {
    const coarse = coarseBounds();
    const inCoarse = (i: number) => coarse.some(([a, b]) => i > a && i < b);
    const floored = new Set<string>();
    for (const r of rules) {
      if (!inCoarse(r.index)) continue;
      const h = heightPx(r.body);
      if (h !== null && h >= 44) for (const p of commaParts(r.selector)) floored.add(p);
    }
    const unfloored = CONTROL_TOUCH_TARGETS.filter((t) => !floored.has(t));
    expect(unfloored).toEqual([]); // a control here with no coarse floor is a sub-44 touch target
  });
});
