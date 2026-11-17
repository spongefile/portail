/** Decodes raw MIDI bytes into something a human can read in the activity monitor. */

import type { MidiActivity } from './types';
import { isPortailSysex, decode as decodeSysex } from './sysex';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/** Matches the module's own numbering: note 0 = C-2, note 60 = C3. */
export function noteName(n: number): string {
  return `${NOTE_NAMES[n % 12]}${Math.floor(n / 12) - 2}`;
}

/** The handful of CCs worth naming inline; everything else shows as a number. */
const CC_NAMES: Record<number, string> = {
  1: 'mod wheel', 7: 'volume', 10: 'pan', 11: 'expression',
  64: 'sustain', 120: 'all sound off', 121: 'reset all', 123: 'all notes off',
};

export function describeMidi(data: Uint8Array | number[], direction: 'in' | 'out' = 'in'): MidiActivity {
  const d = Array.from(data as ArrayLike<number>);
  const at = performance.now();
  const status = d[0] ?? 0;
  const base = { at, direction, data: d };

  if (status === 0xf0) {
    if (isPortailSysex(d)) {
      const r = decodeSysex(d);
      const label = r ? sysexLabel(r) : `Portail SysEx cmd ${d[3]}`;
      return { ...base, kind: 'sysex', channel: null, summary: label };
    }
    return { ...base, kind: 'sysex', channel: null, summary: `SysEx, ${d.length} bytes` };
  }

  // System real-time
  switch (status) {
    case 0xf8: return { ...base, kind: 'clock', channel: null, summary: 'clock' };
    case 0xfa: return { ...base, kind: 'transport', channel: null, summary: 'start' };
    case 0xfb: return { ...base, kind: 'transport', channel: null, summary: 'continue' };
    case 0xfc: return { ...base, kind: 'transport', channel: null, summary: 'stop' };
    case 0xfe: return { ...base, kind: 'sense', channel: null, summary: 'active sensing' };
    case 0xff: return { ...base, kind: 'reset', channel: null, summary: 'system reset' };
  }

  const type = status & 0xf0;
  const ch = (status & 0x0f) + 1;
  const a = d[1] ?? 0;
  const b = d[2] ?? 0;

  switch (type) {
    case 0x80:
      return { ...base, kind: 'note-off', channel: ch, summary: `note off ${noteName(a)} vel ${b}` };
    case 0x90:
      return b === 0
        ? { ...base, kind: 'note-off', channel: ch, summary: `note off ${noteName(a)}` }
        : { ...base, kind: 'note-on', channel: ch, summary: `note on ${noteName(a)} vel ${b}` };
    case 0xa0:
      return { ...base, kind: 'poly-at', channel: ch, summary: `poly AT ${noteName(a)} ${b}` };
    case 0xb0: {
      const name = CC_NAMES[a];
      return { ...base, kind: 'cc', channel: ch, summary: `CC ${a}${name ? ` (${name})` : ''} = ${b}` };
    }
    case 0xc0:
      return { ...base, kind: 'program', channel: ch, summary: `program change ${a}` };
    case 0xd0:
      return { ...base, kind: 'aftertouch', channel: ch, summary: `aftertouch ${a}` };
    case 0xe0: {
      const value = ((b << 7) | a) - 8192;
      return { ...base, kind: 'pitchbend', channel: ch, summary: `pitch bend ${value > 0 ? '+' : ''}${value}` };
    }
    default:
      return {
        ...base, kind: 'other', channel: null,
        summary: d.map((x) => x.toString(16).padStart(2, '0')).join(' '),
      };
  }
}

function sysexLabel(r: NonNullable<ReturnType<typeof decodeSysex>>): string {
  switch (r.kind) {
    case 'line': return `${r.family.toUpperCase()} line ${(r.line & 7) + 1} config${r.short ? ' (short)' : ''}`;
    case 'globals': return 'global parameters';
    case 'mapping': return `mod matrix row ${r.row + 1}`;
    case 'version': return `firmware ${r.text}`;
    case 'preset': return `preset slot ${r.slot}`;
    case 'pong': return 'connection check';
    case 'unknown': return `Portail SysEx cmd ${r.cmd} (${r.payload.length} bytes)`;
  }
}
