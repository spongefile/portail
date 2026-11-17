/**
 * Guard for the invariant in memory `output-ui-family-colour`:
 * output-related UI takes the output's FAMILY colour (--jack/--src), never blue (--accent).
 * Blue is reserved for FX. Fails the build if any CSS rule whose selector targets an OUTPUT
 * element (.output-jack, or the MIDI source node .fx-chip.is-source) reaches for --accent.
 *
 * Reads styles.css from disk at runtime (not a Vite `?raw` import, which caches and can
 * false-pass after an edit).
 */
import { describe, it, expect } from 'vitest';
// @ts-expect-error node builtin; this project has no @types/node, resolved fine at runtime
import { readFileSync } from 'node:fs';

const css: string = readFileSync('src/styles.css', 'utf8');
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
  selector: m[1]!.trim(),
  body: m[2]!,
}));
const OUTPUT_SELECTOR = /\.output-jack|\.fx-chip\.is-source/;

describe('output UI never uses the FX blue (--accent)', () => {
  it('has no output/source selector referencing var(--accent)', () => {
    const offenders = rules.filter((r) => OUTPUT_SELECTOR.test(r.selector) && r.body.includes('--accent'));
    // If this fails: use var(--jack) or var(--src), not var(--accent). Blue is FX-only.
    expect(offenders.map((r) => r.selector)).toEqual([]);
  });
});
