/**
 * Scala .scl import/export (https://www.huygens-fokker.org/scala/scl_format.html), mapped onto the
 * Portail's 12-pitch-class tuning table.
 *
 * Scala format: `!` lines are comments; the first non-comment line is a free-text description; the
 * second is the note count N; then N pitch lines. Degrees are listed 1..N with the 1/1 root IMPLICIT
 * (not listed), and the LAST degree is the period. The Portail hard-codes octave (1200-cent)
 * repetition, so only 12-note, octave-period scales map cleanly:
 *
 *   table = [0, deg1, deg2, …, deg11]   (deg12 is the 1200-cent period → the next C, not stored)
 */

const OCTAVE = 1200;
const PERIOD_EPS = 0.5; // cents

export interface SclResult {
  cents: number[]; // 12 values, table[0]=0
  name: string;
  warnings: string[];
}

/** Parse one Scala pitch token to cents. Throws on malformed input. */
function pitchToCents(tok: string): number {
  const t = tok.trim();
  if (t.includes('.')) {
    const v = parseFloat(t);
    if (!Number.isFinite(v)) throw new Error(`bad cents value "${tok}"`);
    return v;
  }
  // ratio: "a/b" or bare integer "a" (= a/1)
  const [aStr, bStr] = t.split('/');
  const a = parseInt(aStr!, 10);
  const b = bStr === undefined ? 1 : parseInt(bStr, 10);
  if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0 || b <= 0) {
    throw new Error(`bad ratio "${tok}"`);
  }
  return 1200 * Math.log2(a / b);
}

/**
 * Parse a .scl file. Throws (with a user-facing message) when the scale cannot be represented on the
 * Portail: not exactly 12 notes, or a non-octave period.
 */
export function parseScl(text: string): SclResult {
  const lines = text.split(/\r?\n/);
  const meaningful: string[] = [];
  for (const raw of lines) {
    if (raw.trimStart().startsWith('!')) continue; // comment
    meaningful.push(raw);
  }
  if (meaningful.length < 2) throw new Error('This does not look like a Scala .scl file.');

  const name = (meaningful[0] ?? '').trim() || 'Imported scale';
  const count = parseInt((meaningful[1] ?? '').trim(), 10);
  if (!Number.isInteger(count) || count <= 0) throw new Error('Could not read the note count.');

  const pitchLines = meaningful.slice(2).filter((l) => l.trim() !== '').slice(0, count);
  if (pitchLines.length < count) throw new Error(`Expected ${count} pitches but found ${pitchLines.length}.`);

  if (count !== 12) {
    throw new Error(
      `This scale has ${count} notes. The Portail's tables are exactly 12 pitch classes, so only ` +
      `12-note scales can be imported (a keyboard mapping for other sizes isn't supported).`,
    );
  }

  const degrees = pitchLines.map(pitchToCents);
  const period = degrees[11]!;
  if (Math.abs(period - OCTAVE) > PERIOD_EPS) {
    throw new Error(
      `This scale repeats at ${period.toFixed(1)} cents, not the octave (1200). The Portail always ` +
      `repeats at the octave, so non-octave scales (e.g. Bohlen–Pierce) can't be represented.`,
    );
  }

  const warnings: string[] = [];
  const cents = [0, ...degrees.slice(0, 11)]; // table[0]=0 root; table[1..11]=deg1..deg11
  // Sanity notes (non-blocking):
  for (let i = 1; i < 12; i++) {
    if (cents[i]! < cents[i - 1]!) { warnings.push('Some steps go down (non-ascending) — kept as written.'); break; }
  }
  if (cents.some((c) => c < 0 || c > OCTAVE)) {
    warnings.push('Some values fall outside one octave (0–1200 cents); they were kept but may sound unexpected.');
  }
  return { cents, name, warnings };
}

/** Serialize a tuning back to .scl text (12 degrees: the 11 classes then the 1200-cent octave). */
export function toScl(name: string, cents: readonly number[]): string {
  const degrees = [...cents.slice(1, 12), OCTAVE].map((c) => c.toFixed(5));
  return [
    `! ${name.replace(/\s+/g, '_')}.scl`,
    '!',
    name,
    ' 12',
    '!',
    ...degrees.map((d) => ` ${d}`),
    '',
  ].join('\n');
}
