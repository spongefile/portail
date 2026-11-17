/**
 * Portable config files.
 *
 * The official editor writes headerless semicolon-separated integers to `output.txt` with no
 * version, no validation and no device identity (AUDIT.md §2.15). We write human-diffable JSON
 * with a schema version and validate everything on the way in, so a bad file is refused with a
 * reason instead of silently corrupting the editor.
 */

import type { Line, ModRow, PortailConfig } from '../model/types';
import { CONFIG_VERSION, GLOBAL_BYTES, LINE_BYTES, LINE_COUNT } from '../model/types';
import { emptyConfig, familyOfLine, model, modeByIndex } from '../model/model';

export const FILE_KIND = 'eowave-portail-config';

/**
 * The on-disk shape. Deliberately verbose: modes and parameters are written as names as well as
 * numbers so a patch file is readable and diffable in a text editor or a pull request.
 */
export interface ConfigFile {
  kind: typeof FILE_KIND;
  configVersion: number;
  /** Version of spec/model.json this was authored against. */
  specVersion: string | null;
  name: string;
  savedAt: string;
  generator: string;
  lines: {
    line: number;
    label: string;
    mode: string;
    modeIndex: number;
    params: Record<string, number>;
    /** Raw 9 bytes, authoritative on import. The named params are for humans. */
    bytes: number[];
  }[];
  globals: number[];
  modMatrix: ModRow[];
}

export function toFile(config: PortailConfig): ConfigFile {
  return {
    kind: FILE_KIND,
    configVersion: CONFIG_VERSION,
    specVersion: model.specVersion,
    name: config.name,
    savedAt: new Date().toISOString(),
    generator: 'portail-editor (unofficial)',
    lines: config.lines.map((l, i) => {
      const family = familyOfLine(i);
      const mode = modeByIndex(family, l.mode);
      const params: Record<string, number> = {};
      if (mode) for (const p of mode.params) params[p.id] = l.bytes[p.index] ?? 0;
      return {
        line: i,
        label: `${family.toUpperCase()} ${(i & 7) + 1}`,
        mode: mode?.name ?? `unknown(${l.mode})`,
        modeIndex: l.mode,
        params,
        bytes: l.bytes.slice(0, LINE_BYTES),
      };
    }),
    globals: config.globals.slice(0, GLOBAL_BYTES),
    modMatrix: config.modMatrix,
  };
}

export class ImportError extends Error {}

function asInt(v: unknown, what: string, max = 127): number {
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0 || n > max) {
    throw new ImportError(`${what} must be an integer 0-${max}, got ${JSON.stringify(v)}`);
  }
  return n;
}

/** Parses and validates a config file. Throws ImportError with a human-readable reason. */
export function fromFile(text: string): PortailConfig {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new ImportError(`That file is not valid JSON (${err instanceof Error ? err.message : String(err)}).`);
  }
  if (typeof raw !== 'object' || raw === null) throw new ImportError('That file does not contain a JSON object.');
  const f = raw as Partial<ConfigFile>;

  if (f.kind !== FILE_KIND) {
    throw new ImportError(
      `That is not a Portail config file (expected "kind": "${FILE_KIND}", found ${JSON.stringify(f.kind ?? null)}).`,
    );
  }
  if (f.configVersion !== CONFIG_VERSION) {
    throw new ImportError(
      `This file uses config version ${f.configVersion}, but this editor understands version ` +
      `${CONFIG_VERSION}. Update the editor, or export the patch again from the version that wrote it.`,
    );
  }
  if (!Array.isArray(f.lines) || f.lines.length !== LINE_COUNT) {
    throw new ImportError(`Expected exactly ${LINE_COUNT} lines, found ${Array.isArray(f.lines) ? f.lines.length : 'none'}.`);
  }

  const config = emptyConfig(typeof f.name === 'string' ? f.name : 'Imported');

  f.lines.forEach((entry, i) => {
    if (!entry || !Array.isArray(entry.bytes)) throw new ImportError(`Line ${i} has no byte array.`);
    if (entry.bytes.length !== LINE_BYTES) {
      throw new ImportError(`Line ${i} has ${entry.bytes.length} bytes, expected ${LINE_BYTES}.`);
    }
    const bytes = entry.bytes.map((b, j) => asInt(b, `Line ${i} byte ${j}`));
    const family = familyOfLine(i);
    const modeIndex = asInt(entry.modeIndex ?? bytes[0], `Line ${i} mode`);
    if (!modeByIndex(family, modeIndex)) {
      throw new ImportError(
        `Line ${i} (${family.toUpperCase()} ${(i & 7) + 1}) uses mode ${modeIndex}, which this ` +
        `editor does not know. The file may come from newer firmware.`,
      );
    }
    bytes[0] = modeIndex;
    config.lines[i] = { mode: modeIndex, bytes } satisfies Line;
  });

  if (!Array.isArray(f.globals) || f.globals.length !== GLOBAL_BYTES) {
    throw new ImportError(`Expected ${GLOBAL_BYTES} global bytes, found ${Array.isArray(f.globals) ? f.globals.length : 'none'}.`);
  }
  config.globals = f.globals.map((g, i) => asInt(g, `Global byte ${i}`));

  if (Array.isArray(f.modMatrix)) {
    if (f.modMatrix.length > model.modMatrix.rows) {
      throw new ImportError(`File has ${f.modMatrix.length} modulation rows; the module has ${model.modMatrix.rows}.`);
    }
    f.modMatrix.forEach((m, i) => {
      config.modMatrix[i] = {
        statusHigh: asInt(m?.statusHigh, `Mod row ${i} status`, 15),
        channel: asInt(m?.channel, `Mod row ${i} channel`, 15),
        number: asInt(m?.number, `Mod row ${i} number`),
        targetLine: asInt(m?.targetLine, `Mod row ${i} target line`),
        targetParam: asInt(m?.targetParam, `Mod row ${i} target parameter`),
        valueMin: asInt(m?.valueMin, `Mod row ${i} min`),
        valueMax: asInt(m?.valueMax, `Mod row ${i} max`),
      } satisfies ModRow;
    });
  }

  return config;
}

/* -------------------------------------------------------- legacy .txt import */

/**
 * Reads the official editor's `output.txt`: 24 lines of 9 semicolon-separated values, then one
 * line of 8 global values, then 32 lines of 6 modulation values. There is no header to check, so
 * we validate the shape carefully and refuse anything that doesn't match.
 */
export function fromLegacyText(text: string): PortailConfig {
  const rows = text.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  if (rows.length < LINE_COUNT + 1) {
    throw new ImportError(
      `That does not look like an official editor export: expected at least ${LINE_COUNT + 1} ` +
      `rows, found ${rows.length}.`,
    );
  }

  const cells = rows.map((r) => r.split(';').map((c) => c.trim()));
  const config = emptyConfig('Imported from official editor');

  for (let i = 0; i < LINE_COUNT; i++) {
    const row = cells[i]!;
    if (row.length < LINE_BYTES) {
      throw new ImportError(`Row ${i + 1} has ${row.length} values, expected ${LINE_BYTES}.`);
    }
    const bytes = row.slice(0, LINE_BYTES).map((v, j) => asInt(v, `Row ${i + 1} value ${j + 1}`, 255));
    const family = familyOfLine(i);
    // The original writes the FX type byte in its wire form (post-FX types as 32+). Decode it.
    let modeIndex = bytes[0]!;
    if (family === 'fx' && modeIndex > 0x1f) modeIndex = (modeIndex & 0x1f) + 9;
    if (family === 'gate') modeIndex &= 0x0f;
    if (!modeByIndex(family, modeIndex)) {
      throw new ImportError(`Row ${i + 1} has mode ${bytes[0]}, which is not valid for ${family.toUpperCase()}.`);
    }
    bytes[0] = modeIndex;
    config.lines[i] = { mode: modeIndex, bytes };
  }

  const globalRow = cells[LINE_COUNT];
  if (globalRow && globalRow.length >= GLOBAL_BYTES) {
    config.globals = globalRow.slice(0, GLOBAL_BYTES).map((v, i) => asInt(v, `Global value ${i + 1}`));
  }

  for (let r = 0; r < model.modMatrix.rows; r++) {
    const row = cells[LINE_COUNT + 1 + r];
    if (!row || row.length < 6) break;
    const status = asInt(row[0], `Mod row ${r + 1} status`, 255);
    config.modMatrix[r] = {
      statusHigh: status >> 4,
      channel: status & 0x0f,
      number: asInt(row[1], `Mod row ${r + 1} number`),
      // The original stores -1 for "no destination"; we use 127.
      targetLine: Number(row[2]) < 0 ? 127 : asInt(row[2], `Mod row ${r + 1} destination`),
      targetParam: asInt(row[3], `Mod row ${r + 1} parameter`),
      valueMin: asInt(row[4], `Mod row ${r + 1} min`),
      valueMax: Number(row[5]) < 0 ? 0 : asInt(row[5], `Mod row ${r + 1} max`),
    };
  }

  return config;
}

/* -------------------------------------------------------------- file helpers */

export function download(filename: string, data: string | Uint8Array, mime: string): void {
  const blob = data instanceof Uint8Array
    ? new Blob([data as unknown as BlobPart], { type: mime })
    : new Blob([data], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Turns a patch name into something safe for a filename. */
export function safeFilename(name: string): string {
  const base = name.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return base.length > 0 ? base : 'portail-patch';
}
