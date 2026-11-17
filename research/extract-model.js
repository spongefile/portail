#!/usr/bin/env node
/*
 * extract-model.js
 *
 * Derives spec/model.json directly from the ORIGINAL eowave editor's own
 * JavaScript tables (research/original-editor/js/*.js), so the canonical
 * feature model provably matches the shipping device firmware's expectations
 * rather than being hand-transcribed.
 *
 * Run:  node research/extract-model.js
 * Out:  spec/model.json
 *
 * Everything emitted by this script is "[confirmed from source]" in spec terms.
 * Human-authored semantics (descriptions, canonical renames, units) live in
 * the CANON table below and are marked as such in model.md.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const JS = path.join(ROOT, 'research', 'original-editor', 'js');

// --- Minimal DOM stub so the original code can be evaluated verbatim ---------
function stubEl() {
  const el = {
    innerHTML: '', value: '', checked: false, textContent: '', selectedIndex: 0,
    style: {}, classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild() {}, addEventListener() {}, setAttribute() {}, removeChild() {},
    click() {}, disabled: false, readOnly: false, id: '', type: '', href: '',
  };
  return el;
}
const sandbox = {
  console: { log() {}, error() {}, warn() {} },
  document: {
    getElementById: stubEl,
    querySelector: stubEl,
    querySelectorAll: () => [],
    createElement: stubEl,
    createTextNode: () => ({}),
    addEventListener() {},
    body: stubEl(),
  },
  navigator: { requestMIDIAccess: () => ({ then() {} }), vibrate() {} },
  window: {},
  Math, parseInt, parseFloat, Array, JSON, String, Number, isNaN,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// `mem` and `port` live in the inline <script> of index.html, not in the .js
// files; declare them so notes.js:init() can run.
vm.runInContext('var mem = []; var port = null; var midi = null;', sandbox);

// Order matters: notes.js declares the value menus that menu.js references.
for (const f of ['notes.js', 'menu.js', 'about.js', 'midi.js']) {
  vm.runInContext(fs.readFileSync(path.join(JS, f), 'utf8'), sandbox, { filename: f });
}
// init() runs the loops that populate the numeric value menus (1..127 etc).
vm.runInContext('init();', sandbox);

const S = (n) => vm.runInContext(n, sandbox);

// --- Identify each value-domain table by identity ---------------------------
// The original code references domains by variable; we recover the NAME of the
// domain for each parameter by comparing array identity against these globals.
const DOMAIN_NAMES = [
  'swing_menu', 'notenames', 'note_menu', 'note_all_menu', 'divisions_menu',
  'fx_dest_menu', 'fx_source_menu', 'fx_dest_menu_cv', 'fx_dest_menu_gate',
  'fx_dest_prm', 'group_menu', 'onoff_menu', 'clock_state_menu',
  'clock_speed_menu', 'glide_mode_menu', 'source_menu', 'ch_menu', 'channels',
  'tables_menu', 'sync_menu', 'dest_menu', 'dest_note_menu', 'range_gate_menu',
  'invert_range_gate_menu', 'range_oct_menu', 'range_cv_note_menu',
  'range_cv_menu', 'lfo_mode_menu', 'invert_range_cv_menu', 'pb_range_menu',
  'semi_tone_range_menu', 'transpose_menu', 'lfo_type_menu', 'env_type_menu',
  'seq_type_menu', 'seq_gate_type_menu', 'seq_dir_menu', 'clock_type_menu',
  'math_func_menu', 'logic_menu', 'prm_menu', 'vel_dest_menu', 'length_menu',
  '_128_menu', 'ms_128_menu', '_1_8_menu', '_64_menu', '_0_1_menu',
  'bipolar_menu', '_63_menu', '_127_menu', '_100_menu', '_int63_menu',
  'ocatves_menu', 'oct_menu', 'percent_menu', 'div_menu', 'lfo_div_menu',
  'delay_ms', 'off_127_menu', 'off_100_menu', 'note_in_rec_menu',
  'note_in_dest_menu', 'note_in_dest_gate', 'rise_time', 'vib_speed',
  'env_times', 'glide_times', 'glide_times2', 'types_menu', 'gate_menu',
  'fx_menu', 'global_menu',
];
const byIdentity = new Map();
const domains = {};
for (const n of DOMAIN_NAMES) {
  let v;
  try { v = S(n); } catch { continue; }
  if (!Array.isArray(v)) continue;
  if (!byIdentity.has(v)) byIdentity.set(v, n);
  domains[n] = v.map((x) => (x === undefined ? null : x));
}
const domainNameOf = (arr) => byIdentity.get(arr) || null;

// --- Canonical renames -------------------------------------------------------
// The original editor reuses "type", "source" and "range" for several unrelated
// concepts. `id` is the stable machine name (app + manual + this spec all use
// it); `label` is the human string. `legacy` is the original editor's wording,
// kept so users of the old editor can map across. See spec/glossary.md.
const CANON = {
  // key: `${modeKey}.${paramIndex}`  OR  `*.${legacyLabel}` as a fallback
  '*.type':        { id: 'mode',        label: 'Mode' },
  '*.channel':     { id: 'channel',     label: 'MIDI channel' },
  '*.dest':        { id: 'target',      label: 'Target' },
  '*.min':         { id: 'note_low',    label: 'Note low' },
  '*.max':         { id: 'note_high',   label: 'Note high' },
  '*.lower':       { id: 'note_low',    label: 'Note low' },
  '*.higher':      { id: 'note_high',   label: 'Note high' },
  '*.div':         { id: 'division',    label: 'Clock division' },
  '*.vel sens':    { id: 'velocity_sensitive', label: 'Velocity sensitive' },
  '*.retrig':      { id: 'retrigger',   label: 'Retrigger' },
  '*.legato':      { id: 'legato',      label: 'Legato' },
  '*.swing':       { id: 'swing',       label: 'Swing' },
  '*.filter':      { id: 'slew',        label: 'Slew' },
  '*.smooth':      { id: 'slew',        label: 'Slew' },
  '*.glide':       { id: 'glide',       label: 'Glide' },
  '*.number':      { id: 'cc_number',   label: 'CC number' },
  '*.note':        { id: 'note',        label: 'Note' },
  '*.length':      { id: 'length',      label: 'Length' },
  '*.gate len':    { id: 'gate_length', label: 'Gate length' },
  '*.attack':      { id: 'attack',      label: 'Attack' },
  '*.decay':       { id: 'decay',       label: 'Decay' },
  '*.sustain':     { id: 'sustain',     label: 'Sustain' },
  '*.release':     { id: 'release',     label: 'Release' },
  '*.waveform':    { id: 'waveform',    label: 'Waveform' },
  '*.speed':       { id: 'rate',        label: 'Rate' },
  '*.mode':        { id: 'lfo_mode',    label: 'Reset mode' },
  '*.dir':         { id: 'direction',   label: 'Direction' },
  '*.hold':        { id: 'hold',        label: 'Hold' },
  '*.rise':        { id: 'rise',        label: 'Rise' },
  '*.fall':        { id: 'fall',        label: 'Fall' },
  '*.steps':       { id: 'steps',       label: 'Steps' },
  '*.events':      { id: 'fills',       label: 'Fills' },
  '*.rotate':      { id: 'rotate',      label: 'Rotate' },
  '*.scale':       { id: 'scale',       label: 'Scale' },
  '*.root note':   { id: 'root',        label: 'Root note' },
  '*.scale tab':   { id: 'table',       label: 'Table' },
  '*.probability': { id: 'probability', label: 'Probability' },
  '*.vel prob':    { id: 'velocity_probability', label: 'Velocity to probability' },
  '*.distribution':{ id: 'probability', label: 'Probability' },
  '*.function':    { id: 'operation',   label: 'Operation' },
  '*.modulator':   { id: 'operand',     label: 'Operand' },
  '*.semitone':    { id: 'semitones',   label: 'Semitones' },
  '*.octave':      { id: 'octaves',     label: 'Octaves' },
  '*.amount':      { id: 'amount',      label: 'Amount' },
  '*.amout':       { id: 'amount',      label: 'Amount' },
  '*.numbers':     { id: 'repeats',     label: 'Repeats' },
  '*.reset':       { id: 'reset_after', label: 'Reset after' },
  '*.vel control': { id: 'velocity_depth', label: 'Velocity depth' },
  '*.rnd level':   { id: 'random_depth', label: 'Random depth' },
  '*.base note':   { id: 'base_note',   label: 'Base note' },
  '*.note in dest':{ id: 'note_action', label: 'Note action' },
  '*.pb range':    { id: 'bend_range',  label: 'Bend range' },
  '*.vibrato':     { id: 'vibrato_rate', label: 'Vibrato rate' },
  '*.minimum':     { id: 'level_min',   label: 'Level min' },
  '*.out type':    { id: 'voice_mode',  label: 'Voice mode' },

  // --- Disambiguated collisions (mode-specific overrides) -------------------
  'cv.clock.2':    { id: 'clock_event', label: 'Clock event',
                     note: 'legacy editor labelled this "source"; it selects the clock EVENT, not a signal source.' },
  'gate.clock.2':  { id: 'clock_event', label: 'Clock event',
                     note: 'legacy editor labelled this "source"; it selects the clock EVENT, not a signal source.' },
  'cv.env.4':      { id: 'envelope_shape', label: 'Shape',
                     note: 'legacy editor labelled this "type", colliding with the output mode selector.' },
  'gate.env.4':    { id: 'envelope_shape', label: 'Shape',
                     note: 'legacy editor labelled this "type", colliding with the output mode selector.' },
  'gate.gate_seq.2': { id: 'seq_output', label: 'Step output',
                     note: 'legacy editor labelled this "type", colliding with the output mode selector.' },
  'cv.seq.2':      { id: 'seq_output', label: 'Step output',
                     note: 'legacy editor labelled this "out type".' },
  'fx.random vel.3': { id: 'blend', label: 'Blend',
                     note: 'legacy editor labelled this "type", colliding with the FX type selector.' },
  '*.source':      { id: 'trigger_source', label: 'Trigger source' },
};

// --- Human-readable parameter descriptions ----------------------------------
// This string is what the user reads, both in the app's UI and in the manual.
// Keyed by canonical parameter id, with `family.modeKey.id` overrides wherever
// the same id means something materially different in context.
// Human-authored (NOT extracted); accuracy is on us. Keep to one sentence.
const DESC = {
  // -- shared ---------------------------------------------------------------
  channel: 'Which MIDI channel this output listens to.',
  target: 'The output this FX slot processes.',
  level_range: 'Output voltage at full scale.',
  level_min: 'Output voltage at zero velocity, when velocity sensitivity is on.',
  slew: 'Smooths the output, so it glides to new values instead of stepping.',
  glide: 'Portamento time between notes.',
  division: 'How often this runs, as a division of the master clock.',
  swing: 'Delays every other step to create shuffle.',
  note_low: 'Notes below this are ignored.',
  note_high: 'Notes above this are ignored.',
  cc_number: 'Which MIDI CC number to follow.',
  velocity_sensitive: 'Scale the output voltage by note velocity.',
  trigger_source: 'What fires this output: incoming notes on the MIDI channel, or another CV output.',
  length: 'How long the output stays high. Latch holds it for as long as the note is held.',
  gate_length: 'How long each emitted gate stays high.',
  note: 'Which incoming note fires this output.',
  direction: 'The order steps are played in.',
  steps: 'Number of steps in the sequence.',
  base_note: 'The note a step plays when its value is zero.',
  note_action: 'What an incoming note does to the sequence.',
  probability: 'How often the effect is applied.',
  amount: 'Depth of the effect.',
  waveform: 'The LFO shape.',
  rate: 'LFO speed, as a division of the master clock.',
  lfo_mode: 'Whether the LFO free-runs, restarts on each note, or runs only while a key is held.',
  envelope_shape: 'Which envelope stages are used.',
  attack: 'Time to rise from zero to full level.',
  decay: 'Time to fall from full level to the sustain level.',
  sustain: 'Level held while the note is held.',
  release: 'Time to fall to zero after the note is released.',
  clock_event: 'Which clock event to output: running clock pulses, start/stop, or reset.',
  voice_mode: 'How this output picks notes: a mono priority rule, or membership of a polyphonic group.',
  bend_range: 'How far pitch bend moves the output.',
  vibrato_rate: 'Vibrato speed. Depth is controlled live by the mod wheel (CC 1).',
  legato: 'When on, glide applies only between overlapping notes.',
  rise: 'A short attack on the gate, to soften its leading edge.',
  fall: 'A short decay on the gate, to soften its trailing edge.',
  retrigger: 'Restart the gate on every new note, even if the previous note is still held.',
  seq_output: 'What each step emits.',
  interval_range: 'How far, in semitones, the value can move.',
  octave_range: 'How far, in octaves, the value can move.',
  hold: 'Keep arpeggiating after the keys are released.',
  fills: 'How many of the steps are active. The Euclidean algorithm spreads them evenly.',
  rotate: 'Shifts the whole pattern forward or back.',
  random_depth: 'How far a new random value can move from the last one.',
  scale: 'The scale incoming notes are quantised to.',
  root: 'The root note of the scale.',
  table: 'Which of the 8 microtonal tables to apply.',
  reset_after: 'Number of notes before the accumulated offset resets to zero.',
  semitones: 'Transposition in semitones.',
  octaves: 'Transposition in octaves.',
  operation: 'The logic operation applied to the two gates.',
  operand: 'The second gate input to the logic operation.',
  blend: 'How the generated velocity combines with the incoming note velocity.',
  velocity_depth: 'How strongly note velocity influences the result.',
  velocity_probability: 'How strongly note velocity influences the probability.',
  repeats: 'How many times each gate repeats.',

  // -- context-specific overrides -------------------------------------------
  'cv.note.trigger_source': 'What fires this output.',
  'cv.vel.trigger_source': 'Take velocity from notes on the MIDI channel, or from the note playing on another CV output.',
  'gate.vel.trigger_source': 'Take velocity from notes on the MIDI channel, or from the note playing on another CV output.',
  'cv.env.trigger_source': 'What triggers the envelope: notes on the MIDI channel, or the note playing on another CV output.',
  'gate.env.trigger_source': 'What triggers the envelope: notes on the MIDI channel, or the note playing on another CV output.',
  'gate.gate.trigger_source': 'What opens the gate: notes on the MIDI channel, or the note playing on another CV output. Pick a CV output to pair this gate with a voice.',
  'gate.trigger.trigger_source': 'What fires the trigger: notes on the MIDI channel, or the note playing on another CV output.',
  'cv.random cv.trigger_source': 'What generates a new random value: an incoming note, or the master clock.',
  'gate.random.trigger_source': 'What generates a new random value: an incoming note, or the master clock.',
  'cv.poly_after.trigger_source': 'Which note’s aftertouch to follow.',
  'gate.poly_after.trigger_source': 'Which note’s aftertouch to follow.',

  'cv.seq.length': 'Number of steps in the sequence.',
  'cv.cc_rec.length': 'Number of steps in the recording.',
  'gate.gate_seq.length': 'Number of steps in the sequence.',
  'gate.random.length': 'How long each output gate stays high.',

  'cv.seq.note_action': 'What an incoming note does to the sequence: transpose it, or randomise it over one or two octaves.',
  'cv.cc_rec.note_action': 'What the trigger note does: clear, arm recording, start recording, or start/stop playback.',
  'cv.cc_rec.note': 'Which incoming note performs the note action.',
  'cv.cc_rec.cc_number': 'Which MIDI CC to record.',
  'cv.cc_rec.glide': 'Smooths the transition between recorded steps.',

  'cv.random cv.base_note': 'The note the random values are centred on. Ignored when the source is an incoming note.',
  'cv.random cv.interval_range': 'How far, in semitones, a random value can stray from the base note.',
  'gate.random.probability': 'The chance that a new random value is generated on each trigger.',
  'gate.random.random_depth': 'How far a new random value can move.',

  'cv.arp.octave_range': 'How many octaves the arpeggio spans above the held notes.',
  'cv.arp.division': 'How fast the arpeggio steps, as a division of the master clock.',

  'fx.note filter.target': 'The CV output this filter applies to.',
  'fx.chance.probability': 'The chance that a note plays at all.',
  'fx.random oct.probability': 'The chance that a note is moved to a different octave.',
  'fx.random oct.octave_range': 'How many octaves up or down a note can be moved.',
  'fx.random fx.probability': 'The chance that a random interval is added.',
  'fx.random fx.interval_range': 'The largest interval, in semitones, that can be added.',
  'fx.accumulate.amount': 'Interval added to each successive note.',
  'fx.delay.amount': 'How long each gate is delayed.',
  'fx.humanize.amount': 'How much random timing jitter to add.',
  'fx.random vel.amount': 'The range of the generated random velocity.',
  'fx.random trig.amount': 'How much the trigger length can vary. Zero leaves it unchanged.',
  'fx.repeats.amount': 'How fast the repeats fire, as a division of the clock.',
  'fx.microtonal.table': 'Which of the 8 microtonal tables to apply. Edit table contents in the editor\'s Tuning tab (or import a Scala .scl).',
};

function descFor(family, modeKey, id) {
  return DESC[`${family}.${modeKey}.${id}`] || DESC[id] || null;
}

// "range" means five different things depending on the domain it is bound to.
const RANGE_BY_DOMAIN = {
  range_cv_menu:        { id: 'level_range', label: 'Level range', unit: 'V' },
  range_cv_note_menu:   { id: 'level_range', label: 'Level range', unit: 'V' },
  range_gate_menu:      { id: 'level_range', label: 'Level range', unit: 'V' },
  invert_range_gate_menu: { id: 'level_min', label: 'Level min', unit: 'V' },
  range_oct_menu:       { id: 'octave_range', label: 'Octave range', unit: 'oct' },
  semi_tone_range_menu: { id: 'interval_range', label: 'Interval range', unit: 'semitones' },
  oct_menu:             { id: 'octave_range', label: 'Octave range', unit: 'oct' },
  _127_menu:            { id: 'amount',      label: 'Amount', unit: null },
  percent_menu:         { id: 'probability', label: 'Probability', unit: '%' },
};

// Units inferred from the domain the parameter is bound to.
const UNIT_BY_DOMAIN = {
  range_cv_menu: 'V', range_cv_note_menu: 'V', range_gate_menu: 'V',
  invert_range_gate_menu: 'V', range_oct_menu: 'oct', oct_menu: 'oct',
  ocatves_menu: 'oct', semi_tone_range_menu: 'semitones', bipolar_menu: 'semitones',
  pb_range_menu: 'semitones', percent_menu: '%', ms_128_menu: 'ms',
  length_menu: 'ms', delay_ms: 'ms', env_times: 'ms', rise_time: 'ms',
  vib_speed: 'Hz', div_menu: 'bars/beats', lfo_div_menu: 'bars/beats',
  note_menu: 'note', note_all_menu: 'note', ch_menu: 'channel',
  _64_menu: 'steps', _63_menu: 'steps', _1_8_menu: 'table',
};

function canonFor(family, modeKey, idx, legacyLabel, domainName) {
  const spec = CANON[`${family}.${modeKey}.${idx}`];
  if (spec) return spec;
  if (legacyLabel === 'range' && RANGE_BY_DOMAIN[domainName]) return RANGE_BY_DOMAIN[domainName];
  const generic = CANON[`*.${legacyLabel}`];
  if (generic) return generic;
  return { id: legacyLabel.replace(/[^a-z0-9]+/gi, '_').toLowerCase(), label: legacyLabel };
}

// --- Wire encoding for the FX type byte -------------------------------------
// Confirmed from source (index.html update_change / analyse_midi_in):
//   UI index 0..8   -> wire byte == index          (NOTE-domain FX)
//   UI index 9..15  -> wire byte == index + 23     (GATE-domain FX, bit5 set)
const DEBUT_POST_FX = S('debut_post_fx');   // 9
const DIFF_POST_FX = S('diff_post_fx');     // 23
const fxWire = (i) => (i >= DEBUT_POST_FX ? i - DEBUT_POST_FX + 32 : i);

// --- Design taxonomy: family, colour, icon -----------------------------------
// [design decision, not a firmware fact] Approved by the user; shared by app and
// manual so both show one colour/icon per concept. See spec/model.md.
//
// Family is keyed by mode KEY (covers the CV and Gate variants of each mode).
// ARP and SEQ live under `pitch` (no separate "sequence" family).
const MODE_FAMILY = {
  off: 'off',
  // pitch
  note: 'pitch', arp: 'pitch', seq: 'pitch', gate_seq: 'pitch',
  // expression
  vel: 'expression', aftertouch: 'expression', poly_after: 'expression',
  pitchbend: 'expression', cc: 'expression', cc_rec: 'expression',
  // modulation
  lfo: 'modulation', env: 'modulation', 'random cv': 'modulation', random: 'modulation',
  // gate / trigger
  gate: 'gate_trigger', cvtrigger: 'gate_trigger', trigger: 'gate_trigger', euclid: 'gate_trigger',
  // clock
  clock: 'clock',
};

const MODE_FAMILIES = {
  pitch:        { label: 'Pitch',        colour: '#33c46a', members: ['NOTE', 'ARP', 'SEQ'] },
  expression:   { label: 'Expression',   colour: '#a533ff', members: ['VEL', 'AT', 'POLY AT', 'PB', 'CC', 'CC RECORDER'] },
  modulation:   { label: 'Modulation',   colour: '#8360c4', members: ['LFO', 'ENV', 'RANDOM'] },
  gate_trigger: { label: 'Gate / Trigger', colour: '#d0b24a', members: ['GATE', 'TRIG', 'EUCLIDEAN'] },
  clock:        { label: 'Clock',        colour: '#ffcf1a', members: ['CLOCK'] },
  off:          { label: 'Off',          colour: null,      members: ['OFF'] },
};

// Stable kebab icon id per mode KEY. CV and Gate variants of the same mode share
// an icon (e.g. cvtrigger + trigger -> "trig"; seq + gate_seq -> "sequencer").
const MODE_ICON = {
  off: 'off', note: 'note', cvtrigger: 'trig', trigger: 'trig', cc: 'cc',
  vel: 'velocity', aftertouch: 'aftertouch', poly_after: 'poly-aftertouch',
  pitchbend: 'pitch-bend', clock: 'clock', lfo: 'lfo', env: 'envelope',
  seq: 'sequencer', gate_seq: 'sequencer', 'random cv': 'random', random: 'random',
  arp: 'arpeggiator', cc_rec: 'cc-recorder', gate: 'gate', euclid: 'euclidean',
};

// [display decision, not a firmware fact] Human-readable full name per output-mode
// KEY. The module/hardware shows the terse code (kept in `name`); `display` is what
// the app UI and the manual print as the label. CV and Gate variants of a mode share
// one display name (cvtrigger + trigger -> "Trigger", seq + gate_seq -> "Sequencer").
const MODE_DISPLAY = {
  off: 'Off', note: 'Note', cvtrigger: 'Trigger', trigger: 'Trigger', gate: 'Gate',
  cc: 'MIDI CC', vel: 'Velocity', aftertouch: 'Aftertouch', poly_after: 'Poly aftertouch',
  pitchbend: 'Pitch bend', clock: 'Clock', lfo: 'LFO', env: 'Envelope',
  seq: 'Sequencer', gate_seq: 'Sequencer', 'random cv': 'Random', random: 'Random',
  arp: 'Arpeggiator', cc_rec: 'CC recorder', euclid: 'Euclidean',
};

// [display decision] Sentence-case full name per FX KEY (matches the output-mode style).
const FX_DISPLAY = {
  off: 'Off', 'note filter': 'Note filter', 'random oct': 'Random octave',
  'random fx': 'Random note', chance: 'Chance', accumulate: 'Accumulate',
  transpose: 'Transpose', scale: 'Scale', microtonal: 'Microtonal', delay: 'Delay',
  humanize: 'Humanize', logic: 'Logic', 'random vel': 'Random velocity',
  'random trig': 'Random trig length', invert: 'Invert', repeats: 'Repeats',
};

// FX: neutral (no family colour). Icon id + an optional non-colour grouping.
const FX_ICON = {
  off: 'off', 'note filter': 'note-filter', 'random oct': 'random-octave',
  'random fx': 'random-note', chance: 'chance', accumulate: 'accumulate',
  transpose: 'transpose', scale: 'scale', microtonal: 'microtonal', delay: 'delay',
  humanize: 'humanize', logic: 'logic', 'random vel': 'random-velocity',
  'random trig': 'random-trig-length', invert: 'invert', repeats: 'repeats',
};
const FX_GROUP = {
  off: null,
  'random oct': 'pitch', 'random fx': 'pitch', accumulate: 'pitch',
  transpose: 'pitch', scale: 'pitch', microtonal: 'pitch',
  'note filter': 'filter_logic', chance: 'filter_logic', logic: 'filter_logic', invert: 'filter_logic',
  delay: 'timing', humanize: 'timing', 'random trig': 'timing', repeats: 'timing',
  'random vel': 'level',
};
const FX_GROUPS = {
  pitch:        { label: 'Pitch' },
  filter_logic: { label: 'Filter / Logic' },
  timing:       { label: 'Timing' },
  level:        { label: 'Level' },
};

// --- Build the model ---------------------------------------------------------
function buildFamily(family, typeLabels, keyList, selectTable, defaults) {
  const menu_labels = S('menu_labels');
  const modes = [];
  for (let i = 0; i < typeLabels.length; i++) {
    const key = keyList[i];
    const labels = menu_labels[key];
    const sels = selectTable[key];
    if (!labels || !sels) {
      modes.push({ index: i, wire: i, key, name: typeLabels[i], unavailable: true, params: [] });
      continue;
    }
    const def = (defaults && defaults[i]) || [];
    const params = [];
    // index 0 is the mode selector itself; index 1 is channel (CV/GATE) or target (FX)
    for (let x = 1; x < sels.length; x++) {
      const dom = sels[x];
      const domName = domainNameOf(dom);
      const legacy = labels[x];
      const c = canonFor(family, key, x, legacy, domName);
      // Defaults array starts at parameter index 2.
      let dflt = 0;
      if (x >= 2 && def[x - 2] !== undefined) dflt = def[x - 2];
      params.push({
        index: x,                       // byte offset within the 9-byte line
        id: c.id,
        label: c.label,
        description: descFor(family, key, c.id),
        legacy_label: legacy,
        domain: domName,
        count: dom.length,
        min: 0,
        max: dom.length - 1,
        default: dflt,
        unit: c.unit !== undefined ? c.unit : (UNIT_BY_DOMAIN[domName] || null),
        ...(c.note ? { note: c.note } : {}),
      });
    }
    modes.push({
      index: i,
      wire: family === 'fx' ? fxWire(i) : i,
      key,
      name: typeLabels[i],
      // [display decision] full human-readable name; `name` stays the terse code.
      display: (family === 'fx' ? FX_DISPLAY[key] : MODE_DISPLAY[key]) || null,
      // [design decision] shared app/manual vocabulary; see MODE_FAMILY / *_ICON.
      icon: (family === 'fx' ? FX_ICON[key] : MODE_ICON[key]) || null,
      ...(family === 'fx'
        ? { domain: i === 0 ? 'none' : (i < DEBUT_POST_FX ? 'note' : 'gate'),
            fx_group: FX_GROUP[key] !== undefined ? FX_GROUP[key] : null }
        : { family: MODE_FAMILY[key] || null }),
      params,
    });
  }
  return modes;
}

const model = {
  $schema: 'https://eowave-portail-reboot.invalid/spec/model.schema.json',
  spec_version: '1.0.0',
  generated_by: 'research/extract-model.js',
  source: {
    editor: 'https://www.eowave.app/portail/',
    editor_files: ['js/notes.js', 'js/menu.js', 'js/about.js', 'js/midi.js', 'index.html'],
    manual: 'https://drive.google.com/file/d/1f-CBGsoNcTpe_blxI6dH2XDuSmyQyvuR/view',
    note: 'All enumerations and ranges in this file are mechanically extracted from the original editor source and are [confirmed from source]. Descriptions and canonical renames are human-authored; see spec/model.md and spec/glossary.md.',
  },
  device: {
    hp: 5,
    cv_outputs: 8,
    cv_resolution_bits: 16,
    cv_voltage_range: { min: -5, max: 10, unit: 'V' },
    gate_outputs: 8,
    gate_resolution_bits: 12,
    gate_voltage_range: { min: 0, max: 10, unit: 'V' },
    fx_slots: 8,
    cc_map_slots: 32,
    preset_slots: 8,
    mcu: 'RP2040',
  },
  memory: {
    // Per-family line width on the wire, [confirmed from firmware]: CV and Gate
    // share a 9-byte-stride array; FX slots live in a separate array with an
    // 8-byte stride, so FX read/write payloads are 8 bytes. Mitigating fact:
    // no FX mode has a parameter past index 3, so bytes 4-8 of an FX line are
    // unused by every mode either way - the width only changes the expected
    // SysEx payload/reply length, never which parameters exist.
    line_bytes: { cv: 9, gate: 9, fx: 8 },
    lines: [
      { range: [0, 7], family: 'cv', line_bytes: 9, description: 'CV outputs 1-8' },
      { range: [8, 15], family: 'gate', line_bytes: 9, description: 'Gate (D-Gate) outputs 1-8' },
      { range: [16, 23], family: 'fx', line_bytes: 8, description: 'FX slots 1-8 (separate 8-byte-stride array in firmware)' },
      { range: [24, 24], family: 'global', line_bytes: 8, description: 'Global parameters (8 bytes)' },
      { range: [25, 25], family: 'legacy_cc_grid', description: 'Vestigial 192-byte per-parameter CC grid' },
    ],
  },
  global_params: [
    { index: 0, id: 'clock_running', label: 'Clock run', domain: 'clock_state_menu', values: domains.clock_state_menu, default: 0 },
    { index: 1, id: 'clock_source', label: 'Clock source', domain: 'sync_menu', values: domains.sync_menu, default: 0 },
    { index: 2, id: 'tempo_msb', label: 'Tempo (MSB)', note: 'BPM = (msb << 7) | (lsb & 0x7F)' },
    { index: 3, id: 'tempo_lsb', label: 'Tempo (LSB)', note: 'BPM = (msb << 7) | (lsb & 0x7F)' },
    { index: 4, id: 'midi_thru', label: 'MIDI out copy', domain: 'onoff_menu', values: domains.onoff_menu, default: 0 },
    { index: 5, id: 'reset_on_continue', label: 'Reset on continue', domain: 'onoff_menu', values: domains.onoff_menu, default: 0 },
    { index: 6, id: 'global_cc_channel', label: 'Global CC channel', min: 1, max: 16 },
    { index: 7, id: 'disable_default_cc_map', label: 'Disable default CC map', domain: 'onoff_menu', values: domains.onoff_menu, default: 0 },
  ],
  tempo: { min_bpm: 30, max_bpm: 250, source: 'manual (V0.9)' },
  cc_map_slot: {
    fields: [
      { index: 0, id: 'status_high', label: 'MIDI status nibble', note: '9 = Note, 11 = CC' },
      { index: 1, id: 'channel', label: 'MIDI channel', min: 0, max: 15 },
      { index: 2, id: 'number', label: 'CC / note number', min: 0, max: 127 },
      { index: 3, id: 'target_line', label: 'Target line', note: '0-7 CV, 8-15 Gate, 16-23 FX, 24 Global; 127 = unassigned' },
      { index: 4, id: 'target_param', label: 'Target parameter index', note: '0 = slot unused' },
      { index: 5, id: 'value_min', label: 'Value min', note: 'index into the target parameter domain' },
      { index: 6, id: 'value_max', label: 'Value max', note: 'index into the target parameter domain' },
    ],
    targets: domains.fx_dest_menu ? undefined : undefined,
  },
  domains,
  modes: {
    cv: buildFamily('cv', S('menus')['cv'], S('note_labels'), S('cv_select'), S('default_cv_values')),
    gate: buildFamily('gate', S('menus')['gate'], S('gate_labels'), S('gate_select'), S('default_gate_values')),
    fx: buildFamily('fx', S('menus')['fx'], S('fx_labels'), S('fx_select'), S('default_fx_values')),
  },
  // --- Mode families (design taxonomy) ---------------------------------------
  // [design decision, user-approved — NOT a firmware fact]. family_key ->
  // {label, colour, members}. Each output mode carries its `family`; the app and
  // manual colour by this. FX are neutral (no family colour); their `fx_group`
  // is a non-colour grouping carried by icon. See spec/model.md.
  mode_families: {
    provenance: 'design decision (user-approved); not derived from firmware or the editor',
    families: MODE_FAMILIES,
    fx_groups: FX_GROUPS,
  },
  // --- LED colour language ---------------------------------------------------
  // Static block, recovered from the firmware disassembly (research/fw-analyse.py),
  // not from the editor. See spec/led-colors.md for the full analysis.
  //
  // KEY FINDING: the Portail's per-output LEDs are a STATE + LIVE-LEVEL display,
  // NOT a per-mode colour indicator. There is no mode -> colour map to mirror.
  // The app should use `palette` + `states` as a shared status vocabulary, and
  // (optionally) mirror the real behaviour with a per-output level meter.
  led_colors: {
    source: 'firmware v0.83r disassembly; reproduce with research/fw-analyse.py',
    per_output_mode_colors: null,
    per_output_mode_colors_note:
      '[confirmed from firmware] Output MODE does not set LED colour. LEDs show live output LEVEL as brightness, overlaid with module STATE colours. Do not colour output cards by mode to "match hardware".',
    transport: {
      type: 'WS2812',
      confidence: 'confirmed from firmware',
      controller: 'RP2040 PIO0 + DMA',
      bits_per_led: 24,
      order: 'GRB',
      led_count: 16,
      led_count_confidence: 'inferred',
      note: 'One LED per output (8 CV + 8 Gate). Word format G<<24|R<<16|B<<8.',
    },
    // Palette indices 0-9 (RAM 0x20000ddc, flash 0x100114e8). Primaries at half
    // brightness (127). Entries >=10 are a brightness ramp, not colours.
    palette: [
      { index: 0, name: 'off',        rgb: [0, 0, 0],     hex: '#000000' },
      { index: 1, name: 'red',        rgb: [127, 0, 0],   hex: '#7f0000' },
      { index: 2, name: 'green',      rgb: [0, 127, 0],   hex: '#007f00' },
      { index: 3, name: 'yellow',     rgb: [127, 127, 0], hex: '#7f7f00' },
      { index: 4, name: 'blue',       rgb: [0, 0, 127],   hex: '#00007f' },
      { index: 5, name: 'cyan',       rgb: [0, 127, 127], hex: '#007f7f' },
      { index: 6, name: 'warm_white', rgb: [100, 85, 75], hex: '#64554b' },
      { index: 7, name: 'red',        rgb: [127, 0, 0],   hex: '#7f0000' },
      { index: 8, name: 'dim',        rgb: [5, 6, 7],     hex: '#050607' },
      { index: 9, name: 'dim',        rgb: [2, 1, 3],     hex: '#020103' },
    ],
    // Colours also written as literals by the refresh code (not via palette).
    literals: [
      { name: 'idle_grey',   rgb: [16, 16, 16],    hex: '#101010', role: 'default idle fill for an output LED' },
      { name: 'active_white', rgb: [127, 127, 127], hex: '#7f7f7f', role: 'active / selected fill' },
    ],
    // State -> colour semantics for the app to mirror. Confidence per row.
    states: [
      { state: 'output_idle',      color: '#101010', confidence: 'confirmed from firmware' },
      { state: 'output_active',    color: 'brightness tracks live output level', confidence: 'confirmed from firmware' },
      { state: 'preset_selected',  color: '#7f0000', confidence: 'confirmed from firmware' },
      { state: 'saved_confirm',    color: '#007f00', confidence: 'inferred' },
      { state: 'midi_learn',       color: 'cycles through palette', confidence: 'confirmed from firmware' },
      { state: 'button_feedback',  color: '#7f0000 / #7f7f7f', confidence: 'confirmed from firmware' },
      { state: 'midi_clock_activity', color: '#00007f', confidence: 'inferred' },
    ],
    open_question:
      'Exact triggers for yellow/cyan/warm-white, the value->brightness curve, and animation timing are [unknown]. Resolve by filming the module — see spec/led-colors.md and spec/open-questions.md OQ-15.',
  },
  // --- Microtonal tuning tables ----------------------------------------------
  // Recovered from the firmware (research/fw-analyse.py). See spec/microtonal-tables.md.
  // KEY FINDING: all 8 factory tables are identical standard 12-TET. They are
  // user-customisable slots, not pre-loaded exotic tunings, so the editor should
  // label them "user table 1..8 (12-TET default)", not name specific temperaments.
  microtonal_tables: {
    source: 'firmware v0.83r disassembly; reproduce with research/fw-analyse.py',
    count: 8,
    definition: '12 values per table, one per pitch class (C..B), 14-bit each',
    unit: 'cents',
    expansion: 'note_cents = (note / 12) * 1200 + template[note % 12]',
    dac_scaling: 'dac = mul * (cents / 100); mul is a per-module V/oct calibration constant [inferred]',
    flash_note: 'Persistent tables live in device flash, NOT in the .uf2 image, so a user-customised module\'s tables can only be read off hardware.',
    wire_write_opcode: '0x24',
    wire_write_status: 'SEND_ONLY_WITH_SLOT_0_7',
    wire_write_note: 'The table-writer opcode is a firmware memory-safety defect: the firmware does not bound the table slot. The editor writes it safely by REJECTING any table slot outside 0-7 (never clamp/modulo), which keeps the write in bounds. The firmware bug is unfixed, so the disclosure stands. See spec/protocol.md §9.8 and SECURITY.md; technical detail withheld from the public repo.',
    // Every factory table is the same 12-TET template (cents per pitch class).
    factory_template_cents: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100],
    tables: Array.from({ length: 8 }, (_, i) => ({
      index: i,
      name: null,                 // no factory name; user-defined
      values_cents: [0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100],
      deviation_cents: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      is_factory_default: true,
      tuning: '12-TET (equal temperament)',
    })),
  },
};

// --- Validation: catch values that cannot survive a 7-bit SysEx byte ---------
const violations = [];
const missingDesc = [];
for (const [fam, list] of Object.entries(model.modes)) {
  for (const m of list) {
    for (const p of m.params) {
      if (!p.description) missingDesc.push(`${fam}.${m.key}.${p.id}`);
      if (p.max > 127) {
        violations.push(`${fam}.${m.key}.${p.id}: domain "${p.domain}" has ${p.count} entries -> max index ${p.max} exceeds the 7-bit SysEx data-byte limit (127).`);
      }
    }
  }
}
model.validation = {
  seven_bit_violations: [...new Set(violations)],
  note: 'A SysEx data byte must be 0x00-0x7F. Any parameter whose domain has more than 128 entries can emit an index >= 128, which the original editor sends verbatim and which corrupts the message. A correct editor must clamp these.',
};

// Guard the FX 8-byte line-width claim: it is only safe because no FX mode
// defines a parameter past byte index 3. Fail loudly if the editor ever grows one.
const fxMax = Math.max(...model.modes.fx.flatMap((m) => m.params.map((p) => p.index)), 0);
if (fxMax > 7) {
  console.error(`FAIL: an FX mode now has a parameter at byte index ${fxMax}, beyond the 8-byte FX line.`);
  process.exit(1);
}

const outPath = path.join(ROOT, 'spec', 'model.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(model, null, 2) + '\n');

console.log(`wrote ${outPath}`);
console.log(`  cv modes:   ${model.modes.cv.length}`);
console.log(`  gate modes: ${model.modes.gate.length}`);
console.log(`  fx modes:   ${model.modes.fx.length}`);
console.log(`  domains:    ${Object.keys(domains).length}`);
console.log(`  7-bit violations: ${model.validation.seven_bit_violations.length}`);
for (const v of model.validation.seven_bit_violations) console.log(`    ! ${v}`);

// The app renders `description` directly in its UI and the manual quotes it, so
// a missing one is a shipping defect, not a warning.
if (missingDesc.length) {
  console.error(`\nFAIL: ${missingDesc.length} parameter(s) have no description:`);
  for (const d of missingDesc) console.error(`    - ${d}`);
  process.exit(1);
}
console.log('  descriptions: complete');

// Every mode must carry an icon; every output mode a family; every FX an fx_group.
const missingTaxonomy = [];
for (const m of [...model.modes.cv, ...model.modes.gate]) {
  if (!m.icon) missingTaxonomy.push(`${m.key}: icon`);
  if (!m.display) missingTaxonomy.push(`${m.key}: display`);
  if (m.family === null || m.family === undefined) missingTaxonomy.push(`${m.key}: family`);
  if (!MODE_FAMILIES[m.family]) missingTaxonomy.push(`${m.key}: unknown family "${m.family}"`);
}
for (const m of model.modes.fx) {
  if (!m.icon) missingTaxonomy.push(`fx ${m.key}: icon`);
  if (!m.display) missingTaxonomy.push(`fx ${m.key}: display`);
  if (m.key !== 'off' && !m.fx_group) missingTaxonomy.push(`fx ${m.key}: fx_group`);
}
if (missingTaxonomy.length) {
  console.error(`\nFAIL: ${missingTaxonomy.length} taxonomy gap(s):`);
  for (const d of missingTaxonomy) console.error(`    - ${d}`);
  process.exit(1);
}
console.log('  families/icons: complete');
