#!/usr/bin/env node
/**
 * Builds src/model/model.json — the feature model the whole editor is driven from.
 *
 * This is an ADAPTER, not a source of truth. `spec/model.json` (COORDINATOR-owned) is canonical
 * for every label, domain, range, default and unit. This script only:
 *   1. normalises the spec's snake_case shape into the shape the app consumes,
 *   2. attaches prose descriptions (below) for anything the spec has no `description` for,
 *   3. computes the 7-bit clamp ceiling for every parameter, and
 *   4. fails loudly if the spec is missing, so we can never silently ship an invented model.
 *
 * When the coordinator adds `description` fields to spec/model.json, those win automatically and
 * the corresponding entries here become dead weight to be deleted.
 *
 * Domain arrays are index-addressed: **the array index IS the byte sent over SysEx.**
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = resolve(HERE, '..');
const SPEC = resolve(APP, '..', 'spec', 'model.json');
const OUT = resolve(APP, 'src', 'model', 'model.json');

const MAX_SYSEX_DATA = 127; // a SysEx data byte is 0x00-0x7F

if (!existsSync(SPEC)) {
  console.error(
    `\n[build-model] FATAL: ${SPEC} not found.\n` +
    `The editor is driven entirely from the coordinator's canonical feature model and refuses to\n` +
    `invent one. Wait for spec/model.json to land, then re-run \`npm run sync-spec\`.\n`
  );
  process.exit(1);
}

const spec = JSON.parse(readFileSync(SPEC, 'utf8'));

/* ------------------------------------------------------------------- prose ---
 * Provisional descriptions, written against the spec's parameter ids. Keyed by:
 *   `<param id>`                     — applies wherever that id appears
 *   `<family>.<mode key>.<param id>` — overrides the generic entry
 *   `<family>.<mode key>`            — the mode itself
 * Rewritten from the official editor's about.js, which is mis-indexed and full of typos
 * (AUDIT.md §2.11). These are marked provisional in the UI until the manual confirms them.
 * ------------------------------------------------------------------------- */

const MODE_DOC = {
  'off': 'Slot disabled. The output rests at 0 V.',
  'cv.note': 'Pitch CV from incoming MIDI notes, with pitch bend, vibrato and glide.',
  'cv.cvtrigger': 'Fixed-length pulse fired by a chosen note, optionally scaled by velocity.',
  'cv.cc': 'CV that tracks a MIDI continuous controller.',
  'cv.vel': 'CV proportional to note velocity.',
  'cv.aftertouch': 'CV from channel (monophonic) aftertouch.',
  'cv.poly_after': 'CV from polyphonic aftertouch on one specific note.',
  'cv.pitchbend': 'CV from the pitch bend wheel.',
  'cv.clock': 'Clock, start/stop or reset pulses derived from the master clock. Set internal or external sync in Global.',
  'cv.lfo': 'Clock-synced LFO. A note on the selected channel can reset its phase.',
  'cv.env': 'Envelope generator triggered by MIDI notes or by another output.',
  'cv.seq': 'Step sequencer clocked from the master clock. Send CC#1 on the selected channel to set step levels while recording.',
  'cv.random cv': 'Random voltage generator, triggered by notes or by the clock.',
  'cv.arp': 'Arpeggiator over the currently held notes.',
  'cv.cc_rec': 'Records an incoming CC into a loop and plays it back.',
  'gate.gate': 'Gate that follows note on/off, with optional velocity-scaled level and slew.',
  'gate.trigger': 'Fixed-length pulse fired by a chosen note, optionally scaled by velocity.',
  'gate.cc': 'Gate-range output that tracks a MIDI continuous controller.',
  'gate.vel': 'Output level proportional to note velocity.',
  'gate.aftertouch': 'Output from channel (monophonic) aftertouch.',
  'gate.poly_after': 'Output from polyphonic aftertouch on one specific note.',
  'gate.pitchbend': 'Output from the pitch bend wheel.',
  'gate.clock': 'Clock, start/stop or reset pulses derived from the master clock.',
  'gate.lfo': 'Clock-synced LFO on a gate output.',
  'gate.env': 'Envelope generator triggered by MIDI notes or by another output.',
  'gate.gate_seq': 'Step sequencer producing gates or CC-derived levels.',
  'gate.random': 'Random gate generator with independent probability and level variation.',
  'gate.euclid': 'Euclidean rhythm generator — spreads N events over M steps as evenly as possible.',
  'fx.note filter': 'Drops notes outside a pitch range before they reach the target output.',
  'fx.random oct': 'Randomly shifts notes by whole octaves.',
  'fx.random fx': 'Randomly detunes notes by a number of semitones.',
  'fx.chance': 'Probability gate — randomly drops notes.',
  'fx.accumulate': 'Adds a growing offset to each successive note, then resets.',
  'fx.transpose': 'Fixed pitch offset in semitones and octaves.',
  'fx.scale': 'Quantises pitch to a musical scale.',
  'fx.microtonal': 'Applies one of the 8 user microtonal tables stored on the module.',
  'fx.delay': 'Delays events by a fixed time.',
  'fx.humanize': 'Randomly nudges event timing to loosen the feel.',
  'fx.logic': 'Combines two gate outputs with a boolean operation.',
  'fx.random vel': 'Randomises velocity.',
  'fx.random trig': 'Randomises trigger and gate length.',
  'fx.invert': 'Inverts the target output.',
  'fx.repeats': 'Retriggers each event several times — a ratchet.',
};

const PARAM_DOC = {
  // generic, by parameter id
  channel: 'MIDI channel this slot listens on.',
  cc_number: 'Which MIDI CC number to follow.',
  level_range: 'Voltage span of the output.',
  level_min: 'Output level at velocity 0, used when velocity sensitivity is on.',
  slew: 'Smoothing applied to the output. Higher is slower, and tames stepping on 7-bit sources.',
  division: 'Rate, as a division of the master clock. T = triplet, . = dotted.',
  length: 'Duration of each event.',
  gate_length: 'Length of each gate pulse.',
  swing: 'Delays every second event to shuffle the feel.',
  note: 'Which note this slot responds to. "all" responds to any note.',
  note_low: 'Notes below this are ignored.',
  note_high: 'Notes above this are ignored.',
  base_note: 'Centre note that values are generated around.',
  velocity_sensitive: 'Scale the output level by note velocity.',
  trigger_source: 'Take the source from incoming MIDI notes, or follow another output.',
  waveform: 'LFO shape.',
  rate: 'LFO rate, as a division of the master clock.',
  lfo_mode: 'continuous runs free; note reset restarts the phase on each note; gated runs only while a note is held.',
  envelope_shape: 'ar = attack/release, ad = attack/decay, adsr = full envelope, loop = retriggers itself.',
  attack: 'Time to rise to full level.',
  decay: 'Time to fall from the peak to the sustain level.',
  sustain: 'Level held while the note is down.',
  release: 'Time to fall to zero after note off.',
  direction: 'Playback direction.',
  glide: 'Portamento time. Higher is slower.',
  probability: 'Chance that any given event happens.',
  target: 'Which output this FX processes.',
  amount: 'Depth of the effect.',
  steps: 'Total number of steps in the pattern.',
  fills: 'How many of those steps fire.',
  rotate: 'Rotates the pattern forward by this many steps.',
  clock_event: 'Emit clock pulses, a start/stop level, or a reset pulse.',
  interval_range: 'How far values may stray from the centre.',
  octave_range: 'How many octaves the range spans.',
  seq_output: 'Whether steps produce note values or raw CC values.',
  note_action: 'What an incoming MIDI note does to the running sequence.',
  random_depth: 'How much the level varies between events.',
  hold: 'Keep running after the keys are released.',
  retrigger: 'Re-fire the gate on every new note, even during a held note.',
  rise: 'Slew on the rising edge.',
  fall: 'Slew on the falling edge.',
  // per-mode overrides
  'cv.note.voice_mode':
    'Voice allocation. mono takes one voice — newest, lowest or highest note wins. poly groups share incoming notes across every output set to the same group.',
  'cv.note.bend_range': 'How far the pitch bend wheel moves the pitch.',
  'cv.note.vibrato_rate': 'Vibrato rate. Depth is controlled live by CC#1 (mod wheel).',
  'cv.note.legato': 'legato glides only between overlapping notes; glide always glides.',
  'cv.clock.channel': 'No effect in CLOCK mode.',
  'gate.clock.channel': 'No effect in CLOCK mode.',
  'cv.cc_rec.note': 'Note that operates the recorder transport.',
  'cv.cc_rec.note_action': 'What that transport note does: clear, arm, start, or gate the recording.',
  'fx.accumulate.amount': 'Amount added per note. Negative values walk downward.',
  'fx.accumulate.reset_after': 'Reset the accumulator after this many notes.',
  'fx.logic.operand': 'The second input to the boolean operation.',
  'fx.logic.target': 'Gate output this FX writes its result to.',
  'fx.random vel.blend': 'Whether the random amount is added to, subtracted from, or replaces the velocity.',
  'fx.microtonal.table': 'One of the 8 user microtonal tables stored on the module. Table contents are not editable here.',
  'fx.scale.root': 'Tonic of the scale.',
  'fx.scale.scale': 'Which scale incoming pitches are snapped to.',
  'fx.transpose.semitones': 'Semitone offset applied to every note.',
  'fx.transpose.octaves': 'Octave offset applied to every note.',
  'fx.logic.operation': 'Boolean operation applied to the two gate inputs.',
  'fx.repeats.amount': 'Time between repeats.',
  'fx.repeats.repeats': 'How many repeats.',
  'fx.random trig.velocity_depth': 'How much velocity biases the length.',
  'fx.chance.velocity_probability': 'How much velocity biases that chance.',
};

const GLOBAL_DOC = {
  clock_running: 'Starts and stops the internal clock.',
  clock_source: 'Whether the module runs its own clock or follows incoming MIDI clock.',
  tempo: 'Internal clock tempo. Transmitted as two 7-bit bytes (MSB then LSB).',
  midi_thru: 'Echo incoming MIDI to the MIDI output.',
  reset_on_continue: 'Restart sequencers from step 1 when MIDI continue is received, instead of resuming where they stopped.',
  global_cc_channel: 'The channel the modulation matrix listens on for its CC assignments.',
  disable_default_cc_map: 'Turns off the factory CC map so only your own modulation matrix rows apply.',
};

const DOMAIN_DOC = {
  div_menu: 'Division of the master clock. T = triplet, . = dotted.',
  group_menu: 'mono = one voice. poly groups share notes across every output in the same group.',
  length_menu: '"latch" makes the output follow the note instead of firing a fixed-length pulse.',
  note_all_menu: '"all" responds to any note.',
  note_menu: 'MIDI note number 0-127, shown by name. Note 60 = C3.',
  ms_128_menu: 'NOTE: this domain has 129 entries; index 128 cannot be sent in a 7-bit SysEx byte and is clamped to 127.',
};

/* ------------------------------------------------------------------ adapt --- */

const docFor = (table, ...keys) => {
  for (const k of keys) if (k && table[k] !== undefined) return table[k];
  return null;
};

/** Domains: spec gives plain string arrays. Normalise to { labels, doc, overflows }. */
const domains = {};
for (const [name, labels] of Object.entries(spec.domains)) {
  domains[name] = {
    labels,
    count: labels.length,
    doc: DOMAIN_DOC[name] ?? null,
    /** true when the domain can produce an index a SysEx data byte cannot carry */
    overflows7bit: labels.length - 1 > MAX_SYSEX_DATA,
  };
}

const clampWarnings = [];

function adaptParam(family, modeKey, p) {
  const dom = domains[p.domain];
  const specMax = p.max ?? (dom ? dom.count - 1 : MAX_SYSEX_DATA);
  const wireMax = Math.min(specMax, MAX_SYSEX_DATA);
  if (wireMax < specMax) {
    clampWarnings.push(
      `${family}.${modeKey}.${p.id}: domain "${p.domain}" reaches index ${specMax}, clamped to ${wireMax} (7-bit SysEx limit).`
    );
  }
  return {
    index: p.index,
    id: p.id,
    label: p.label,
    legacyLabel: p.legacy_label ?? null,
    domain: p.domain,
    min: p.min ?? 0,
    max: specMax,
    wireMax,
    default: p.default ?? 0,
    unit: p.unit ?? null,
    doc: p.description ?? docFor(PARAM_DOC, `${family}.${modeKey}.${p.id}`, p.id),
    /* 'spec' = the canonical model states this prose. 'editor-derived' = we wrote it by reading
     * the official editor's source, and it has NOT been confirmed against the manual or hardware.
     * The UI marks the latter so nobody mistakes our reading for documentation. */
    docSource: p.description ? 'spec' : 'editor-derived',
  };
}

function adaptMode(family, m) {
  return {
    index: m.index,
    wire: m.wire ?? m.index,
    key: m.key,
    name: m.name,
    display: m.display ?? m.name, // full human-readable name (spec-canonical); falls back to the terse code
    domain: m.domain ?? null,
    doc: m.description ?? docFor(MODE_DOC, `${family}.${m.key}`, m.key),
    docSource: m.description ? 'spec' : 'editor-derived',
    // Passed through from spec when present (DESIGN §6.0-B icon, §6.2 family). When absent, the app
    // supplies fallbacks: an icon placeholder keyed off `key`, and the mode-family palette in
    // src/model/families.ts. Never invented here.
    icon: m.icon ?? null,
    family: m.family ?? null,
    params: (m.params ?? []).map((p) => adaptParam(family, m.key, p)),
  };
}

const families = {};
for (const family of ['cv', 'gate', 'fx']) {
  families[family] = spec.modes[family].map((m) => adaptMode(family, m));
}

/* Globals. The spec models tempo as two separate MSB/LSB bytes; the editor presents one BPM
 * control, so collapse them into a synthetic 14-bit parameter and keep the byte indices. */
const rawGlobals = spec.global_params;
const byId = Object.fromEntries(rawGlobals.map((g) => [g.id, g]));

const globals = [];
for (const g of rawGlobals) {
  if (g.id === 'tempo_lsb') continue; // folded into tempo_msb below
  if (g.id === 'tempo_msb') {
    globals.push({
      id: 'tempo',
      label: 'Tempo',
      kind: 'int14',
      msbIndex: byId.tempo_msb.index,
      lsbIndex: byId.tempo_lsb.index,
      min: spec.tempo?.min_bpm ?? 30,
      max: spec.tempo?.max_bpm ?? 250,
      default: 120,
      unit: 'BPM',
      doc: GLOBAL_DOC.tempo,
      docSource: 'editor-derived',
    });
    continue;
  }
  const dom = g.domain ? domains[g.domain] : null;
  globals.push({
    id: g.id,
    label: g.label,
    kind: dom ? 'enum' : 'int',
    index: g.index,
    domain: g.domain ?? null,
    min: g.min ?? (dom ? 0 : 0),
    max: g.max ?? (dom ? dom.count - 1 : MAX_SYSEX_DATA),
    default: g.default ?? 0,
    unit: g.unit ?? null,
    doc: g.description ?? GLOBAL_DOC[g.id] ?? null,
    docSource: g.description ? 'spec' : 'editor-derived',
  });
}
// The spec leaves global_cc_channel without an explicit range; it is a 1-16 MIDI channel.
const gcc = globals.find((g) => g.id === 'global_cc_channel');
if (gcc) { gcc.min = 1; gcc.max = 16; gcc.default = gcc.default || 16; gcc.unit = 'channel'; }

/* Layout, derived from spec.memory.lines rather than hardcoded. */
const layout = {};
for (const l of spec.memory.lines) {
  layout[l.family] = { firstLine: l.range[0], lastLine: l.range[1], count: l.range[1] - l.range[0] + 1 };
}

const model = {
  schemaVersion: 1,
  specVersion: spec.spec_version ?? null,
  provenance: 'adapted from spec/model.json by app/scripts/build-model.mjs',
  builtAt: new Date().toISOString(),
  source: spec.source ?? null,
  device: spec.device,
  memory: { lineBytes: spec.memory.line_bytes, lines: spec.memory.lines },
  layout,
  maxSysexData: MAX_SYSEX_DATA,
  domains,
  families,
  globals,
  modeFamilies: spec.mode_families ?? null,
  ledColors: spec.led_colors ?? null,
  modMatrix: {
    rows: spec.device.cc_map_slots,
    fields: spec.cc_map_slot.fields,
    destinations: [
      ...Array.from({ length: 8 }, (_, i) => ({ line: i, label: `CV ${i + 1}`, family: 'cv' })),
      ...Array.from({ length: 8 }, (_, i) => ({ line: i + 8, label: `GATE ${i + 1}`, family: 'gate' })),
      ...Array.from({ length: 8 }, (_, i) => ({ line: i + 16, label: `FX ${i + 1}`, family: 'fx' })),
      { line: 24, label: 'GLOBAL', family: 'global' },
    ],
  },
  validation: {
    ...(spec.validation ?? {}),
    clampWarnings,
  },
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(model, null, 2) + '\n');

console.log(`[build-model] spec/model.json v${model.specVersion} -> ${OUT}`);
console.log(
  `[build-model] ${families.cv.length} CV modes, ${families.gate.length} gate modes, ` +
  `${families.fx.length} FX modes, ${Object.keys(domains).length} domains, ${globals.length} globals.`
);
if (clampWarnings.length) {
  console.log(`[build-model] ${clampWarnings.length} parameter(s) clamped to 7-bit range:`);
  for (const w of clampWarnings) console.log(`               - ${w}`);
}
const undocumented = [];
for (const [fam, modes] of Object.entries(families))
  for (const m of modes) {
    if (!m.doc && m.key !== 'off') undocumented.push(`${fam}.${m.key}`);
    for (const p of m.params) if (!p.doc) undocumented.push(`${fam}.${m.key}.${p.id}`);
  }
if (undocumented.length) {
  console.log(`[build-model] ${undocumented.length} item(s) with no description: ${undocumented.slice(0, 8).join(', ')}${undocumented.length > 8 ? ' …' : ''}`);
}
