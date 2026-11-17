# eowave Portail — Canonical Feature Model

**Spec version:** 1.0.0
**Machine-readable companion:** [`spec/model.json`](model.json) — the app imports this directly.
**Vocabulary:** [`spec/glossary.md`](glossary.md) is binding for every name used here.
**Wire format:** [`spec/protocol.md`](protocol.md).

---

## How this file relates to `model.json`

`model.json` is **generated**, not written:

```
node research/extract-model.js
```

The generator evaluates the official editor's own JavaScript tables
(`research/original-editor/js/*.js`) inside a sandboxed VM and serialises the result. Every
enumeration, count, range and default in `model.json` is therefore **[confirmed from source]** — it
is the shipping editor's data, not a transcription of it. Re-running the generator after re-fetching
the editor is how we detect that eowave changed something.

What is *not* generated, and is human-authored:

- the canonical names (`id` / `label`), per [`glossary.md`](glossary.md)
- the units
- the prose in this file

The generator preserves each parameter's original editor label as `legacy_label` and its value-table
name as `domain`, so any canonical name can be traced back to the source.

### Consuming it

```js
import model from '../spec/model.json' with { type: 'json' };

const mode = model.modes.cv.find(m => m.key === 'note');
mode.name;     // 'NOTE'    -> the module's terse code (what the hardware shows)
mode.display;  // 'Note'    -> full human-readable name for app UI + manual labels
mode.family;   // 'pitch'  -> model.mode_families.families.pitch.colour = '#33c46a'
mode.icon;     // 'note'    -> glyph id in the app's shared icon set
for (const p of mode.params) {
  // p.index  -> byte offset in the line (9 bytes for CV/Gate, 8 for FX)
  // p.id     -> stable machine name
  // p.label  -> what to show the user
  // p.domain -> key into model.domains for the value list
  // p.min/max/default, p.unit
  const values = model.domains[p.domain];   // array of display strings
}
```

**A parameter's stored value is always an index into `model.domains[p.domain]`, never a physical
value.** An envelope attack of `50` means `env_times[50]`, which is `15.6 ms`. Do not do arithmetic
on these numbers; look them up.

### Validation gate

`model.json` carries a `validation.seven_bit_violations` array. It is **not empty** — four parameters
have value domains larger than 128 entries and can therefore emit an index that is not a legal SysEx
data byte. The app must clamp them. See [`protocol.md` §1.3](protocol.md#13-data-width-encoding-checksums).

The manual's build should assert that every mode and parameter it documents exists in `model.json`,
and fail if one does not. That is the mechanism that stops the manual and the app drifting.

---

## The shape of the device

| | |
|---|---|
| Format | 5 HP Eurorack, 110 mA +12 V / 20 mA −12 V |
| MCU | RP2040 |
| **CV outputs** | 8 × 16-bit, **−5 V … +10 V** |
| **Gate outputs** | 8 × 12-bit, **0 V … +10 V**, unipolar |
| **FX slots** | 8 |
| **CC map slots** | 32 |
| **Presets** | 8 *(manual V0.9 contradicts itself and says 16 in one place — see [OQ-11](open-questions.md#oq-9))* |
| Inputs | USB-C (device), TRS MIDI Type A in, MIDI out (thru) |
| Front panel | 2 buttons, 1 LED |

**16 outputs, but 24 configurable slots.** The product page's "16 assignable outputs" undersells the
structure: there are 8 CV + 8 Gate physical outputs, plus 8 FX slots that are configured the same way
but drive nothing directly. Any UI that shows "16 things" is modelling it wrong.

### Gate outputs are not gates

The Gate outputs are full 12-bit CV outputs restricted to 0–10 V. They can run LFOs, envelopes,
sequencers — everything a CV output can do except bipolar output and V/oct tracking. Their velocity
sensitivity (the "dynamic" in eowave's "D-Gate") makes them well suited to driving analogue envelope
and VCA inputs that respond to gate amplitude.

**Design consequence:** the app should present CV and Gate outputs in one unified view with the
differences marked, not as two unrelated tabs. Their mode lists overlap by 12 of 14.

---

## Mode names: `name` vs `display` (shared vocabulary)

**[display decision, not a firmware fact]** Each output mode carries two names, and the app and the
manual read both from `model.json` so they never diverge:

- **`name`** — the module's **terse code** (`VEL`, `PB`, `POLY AT`…). This is what the **hardware
  shows**; leave it as-is.
- **`display`** — the **full human-readable name** (`Velocity`, `Pitch bend`, `Poly aftertouch`…).
  Use this wherever the UI or the manual prints a mode as a **label**.

The terse codes are obscure to newcomers, so `display` is the default label; show `name` only when
mirroring exactly what the panel/hardware reads. CV and Gate variants of a mode share one `display`
(`cvtrigger`+`trigger` → **Trigger**, `seq`+`gate_seq` → **Sequencer**, `random cv`+`random` →
**Random**). FX also carry `display` (sentence-case full names).

| Mode `name` | `display` | | Mode `name` | `display` |
|---|---|---|---|---|
| OFF | Off | | LFO | LFO |
| NOTE | Note | | ENV | Envelope |
| TRIG | Trigger | | SEQ | Sequencer |
| GATE | Gate | | RANDOM | Random |
| CC | MIDI CC | | ARP | Arpeggiator |
| VEL | Velocity | | CC RECORDER | CC recorder |
| AT | Aftertouch | | EUCLIDEAN | Euclidean |
| POLY AT | Poly aftertouch | | | |
| PB | Pitch bend | | | |
| CLOCK | Clock | | | |

FX `display` names: Note filter, Random octave, Random note, Chance, Accumulate, Transpose, Scale,
Microtonal, Delay, Humanize, Logic, Random velocity, Random trig length, Invert, Repeats.

> These are display choices, not extracted from the hardware. The generator
> (`research/extract-model.js`) fails the build if any mode lacks a `display`, so a mode can never
> reach the UI or manual without an agreed full name.

---

## Mode families, colours and icons (shared vocabulary)

**[design decision, user-approved — not a firmware fact]** So the app and the manual never show a
different colour or icon for the same mode, both read these from `model.json`:

- each output mode carries a **`family`** and an **`icon`** id;
- `model.json → mode_families.families` gives `family_key → {label, colour, members}`;
- FX carry an **`icon`** and a non-colour **`fx_group`** (`mode_families.fx_groups`); FX are neutral
  grey — the four FX groups are conveyed by icon, not colour.

| Family | Colour | Modes |
|---|---|---|
| **Pitch** | `#33c46a` (green) | NOTE, ARP, SEQ |
| **Expression** | `#a533ff` (intense purple) | VEL, AT, POLY AT, PB, CC, CC RECORDER |
| **Modulation** | `#8360c4` (purple) | LFO, ENV, RANDOM |
| **Gate / Trigger** | `#d0b24a` (yellow) | GATE, TRIG, EUCLIDEAN |
| **Clock** | `#ffcf1a` (intense yellow) | CLOCK |
| **Off** | grey / unlit | OFF |

ARP and SEQ sit under **Pitch** — there is no separate "sequence" family. The Gate variants of a mode
share their CV sibling's family and icon (e.g. Gate SEQ → Pitch/`sequencer`, Gate TRIG →
Gate/Trigger/`trig`).

**Icon ids** are stable kebab keys naming a glyph in the app's shared icon set (the SVGs live in the
app; only the id is shared here). CV/Gate variants share one icon: `cvtrigger`+`trigger` → `trig`,
`seq`+`gate_seq` → `sequencer`, `random cv`+`random` → `random`.

FX groups: **pitch** (random-octave, random-note, accumulate, transpose, scale, microtonal),
**filter_logic** (note-filter, chance, logic, invert), **timing** (delay, humanize,
random-trig-length, repeats), **level** (random-velocity).

> These are design decisions, not extracted from the hardware. The generator
> (`research/extract-model.js`) fails the build if any mode lacks a family or icon, so the taxonomy
> can never fall out of sync with the mode list.

---

## Mode availability

12 modes exist on both families. The asymmetries are real and worth stating plainly:

| Mode | CV | Gate | Note |
|---|:---:|:---:|---|
| OFF | ✔ | ✔ | |
| **NOTE** | ✔ | — | V/oct pitch. CV only — Gate outputs have no V/oct tracking. |
| **GATE** | — | ✔ | Gate only. |
| TRIG | ✔ | ✔ | Gate version adds **Trigger source**; CV version has none. |
| CC | ✔ | ✔ | |
| VEL | ✔ | ✔ | |
| AT | ✔ | ✔ | |
| POLY AT | ✔ | ✔ | |
| PB | ✔ | ✔ | |
| CLOCK | ✔ | ✔ | |
| LFO | ✔ | ✔ | |
| ENV | ✔ | ✔ | |
| SEQ | ✔ | ✔ | **Different parameter sets.** CV: pitch steps + Glide. Gate: gates + Gate length. |
| RANDOM | ✔ | ✔ | **Different parameter sets.** CV: 6 params. Gate: 8, incl. Probability and Random depth. |
| **ARP** | ✔ | — | CV only. |
| **CC RECORDER** | ✔ | — | CV only. |
| **EUCLIDEAN** | — | ✔ | Gate only. |

Mode indices are **not** aligned between the two families past index 10 — CV `11 = SEQ, 12 = RANDOM,
13 = ARP, 14 = CC RECORDER`; Gate `11 = SEQ, 12 = RANDOM, 13 = EUCLIDEAN`. Always resolve a mode
through `model.json`, never by assuming a shared numbering.

---

## FX applicability

This is the matrix the product page does not provide. **An FX slot's domain determines which outputs
it can target, and the two sets do not overlap.**

| FX type | Index | Wire | Domain | Can target | Acts on |
|---|---:|---:|---|---|---|
| NOTE FILTER | 1 | `0x01` | Note | CV 1–8 | MIDI notes, before pitch conversion |
| RANDOM OCT | 2 | `0x02` | Note | CV 1–8 | " |
| RANDOM NOTE | 3 | `0x03` | Note | CV 1–8 | " |
| CHANCE | 4 | `0x04` | Note | CV 1–8 | " |
| ACCUMULATE | 5 | `0x05` | Note | CV 1–8 | " |
| TRANSPOSE | 6 | `0x06` | Note | CV 1–8 | " |
| SCALE | 7 | `0x07` | Note | CV 1–8 | " |
| MICROTONAL | 8 | `0x08` | Note | CV 1–8 | " |
| DELAY | 9 | `0x20` | Gate | GATE 1–8 | Gate events |
| HUMANIZE | 10 | `0x21` | Gate | GATE 1–8 | " |
| LOGIC | 11 | `0x22` | Gate | GATE 1–8 | " |
| RANDOM VEL | 12 | `0x23` | Gate | GATE 1–8 | " |
| RANDOM TRIG LENGTH | 13 | `0x24` | Gate | GATE 1–8 | " |
| INVERT | 14 | `0x25` | Gate | GATE 1–8 | " |
| REPEATS | 15 | `0x26` | Gate | GATE 1–8 | " |

**7 Gate FX, not 8.** Manual V0.9 lists EUCLIDEAN among them; that is an error — Euclidean is a Gate
output *mode*.

### Which modes actually respond to Note FX

**[inferred]** Note FX process MIDI notes on their way to a CV output. Per manual V0.9, they take
effect on CV outputs whose mode is **NOTE, ARP, RANDOM or SEQ** — the modes that deal in notes. A
Note FX targeting a CV output set to, say, `LFO` has nothing to act on. The app should warn on that
combination rather than silently allowing it. *Not verified on hardware.*

### Chaining

**[confirmed from source]** Multiple FX slots may target the same output. They are applied in **slot
order** — FX 1, then FX 2, and so on — regardless of the order the user created them. So an FX 1
`RANDOM NOTE` → FX 2 `SCALE` chain randomises first and quantises second; swapping the slots reverses
the musical result.

**[confirmed from source]** MICROTONAL is documented as always applying at the end of the chain,
regardless of slot. *Not verified on hardware.*

**Design consequence:** the app must display FX slots in slot order and make the chain visible per
target output. A flat list of 8 slots hides the thing that determines the result.

### Advertised but not shipping

eowave's product page lists **Velocity VCA** and **Math operations** among the modifiers. Both are
fully defined in the editor's tables (`vel vca`, `maths`) but **commented out of the shipped menu**,
along with `conditional`, `modulate`, `mod_lfo` and `mod_cc`. They are not reachable.

**The manual must not document them as available.** Whether the firmware still implements them is
[OQ-3](open-questions.md#oq-12).

---

## Globals

| Byte | Parameter | Values | Notes |
|---:|---|---|---|
| 0 | **Clock run** | stop / start | |
| 1 | **Clock source** | internal / external | External syncs to incoming MIDI clock |
| 2–3 | **Tempo** | 30–250 BPM | Split as `(msb << 7) \| lsb` |
| 4 | **MIDI thru** | off / on | Copies MIDI in to MIDI out |
| 5 | **Reset on continue** | off / on | Compatibility with some sequencers and Ableton Live |
| 6 | **Global CC channel** | 1–16 | **One-based**, unlike per-output channels |
| 7 | **Disable default CC map** | off / on | Disables the firmware's built-in CC grid |

**[confirmed from source]** Byte 7 has no single-setter opcode; the official editor's checkbox does
nothing unless the user also runs "update all parameters". The app should send a full global write
whenever byte 7 changes.

---

## Value domains worth knowing

`model.json → domains` holds all 73. These are the ones that shape the UI:

| Domain | Entries | Notes |
|---|---:|---|
| `env_times` | 128 | **2.1 ms … 134 s**, exponential. Not linear — a slider is misleading; show the value. |
| `rise_time` | 100 | Gate Rise/Fall, exponential, `OFF` at index 0. |
| `vib_speed` | 100 | Vibrato rate in Hz, `OFF` at index 0. |
| `div_menu` | 23 | `4/1` … `1/16.` — straight, triplet (`T`) and dotted (`.`). |
| `lfo_div_menu` | 25 | As above but starting at `32/1`. **Different table from `div_menu`.** |
| `range_cv_menu` | 12 | `+/- 5V`, `10 V`, `5 V` … `1 V`, `-1 V` … `-5 V`. **Not monotonic** — index 0 is bipolar. |
| `range_cv_note_menu` | 13 | As above plus `note scale` for V/oct output. |
| `range_gate_menu` | 10 | `10 V` down to `1 V` — **descending**. Index 0 is the largest. |
| `tables_menu` | 24 | Scales: chromatic, major, minor, modes, chords. |
| `note_menu` | 128 | `C-2` … `G8`. **MIDI 60 = `C3`**, not `C4`. |
| `ms_128_menu` | **129** | ⚠ Over-long. Index 0 and 1 both read `1 ms`; index 128 is not a legal SysEx byte. |
| `_int63_menu` | 128 | Signed: `0…63` then `0, -1 … -63`. Index 64 is `-0`. |
| `bipolar_menu` | 128 | `-63 … +64`. Neutral is index **63**, not 0. |

**The non-monotonic and descending domains are a UI trap.** `range_gate_menu` index 0 = 10 V and
index 9 = 1 V; a slider bound naively to the index runs backwards. Render these as pick-lists, or
sort for display and map back to the index.

---

## Defaults

**[confirmed from source]** When the user selects a mode, the official editor loads a default
parameter set (`default_cv_values`, `default_gate_values`, `default_fx_values`). Those defaults are
captured per-parameter in `model.json`. Two worth noting because they look wrong but are not:

- `TRANSPOSE` defaults to semitones index `63` and octaves index `4` — both of which decode to **0**.
  The default is correctly neutral.
- `ENV` defaults to shape `adsr`, attack index 1 (`2.2 ms`), decay 50 (`15.6 ms`), sustain 100,
  release 50.

**[confirmed from source]** Selecting a new mode **resets bytes 1–8 to that mode's defaults** and
**clears any CC map slots pointing at that output**. Both behaviours are the editor's, not the
firmware's; a replacement editor must reproduce them or stale mappings will accumulate.

---

## Per-mode parameter reference

Generated from `model.json`. Byte numbers are offsets within the line — **9 bytes for CV and Gate,
8 for FX**, per `model.json → memory.line_bytes` ([confirmed from firmware]: FX slots live in a
separate 8-byte-stride array). No FX mode has a parameter past byte 3, so the width difference only
affects expected SysEx payload lengths, never which parameters exist. Value columns show the
first and last entries of the domain with the entry count in parentheses; the full list is in
`model.json → domains`.


### CV output modes

#### 0. OFF

No parameters. The output is inactive.

#### 1. NOTE

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Voice mode**<br>`voice_mode` | How this output picks notes: a mono priority rule, or membership of a polyphonic group. | `mono last` … `poly group 4` (7) | `mono last` | — |
| 3 | **Bend range**<br>`bend_range` | How far pitch bend moves the output. | `+/-1` … `+/-24` (24) | `+/-2` | semitones |
| 4 | **Vibrato rate**<br>`vibrato_rate` | Vibrato speed. Depth is controlled live by the mod wheel (CC 1). | `OFF` … `37.07 Hz` (100) | `OFF` | Hz |
| 5 | **Glide**<br>`glide` | Portamento time between notes. | `OFF` … `127` (128) | `OFF` | — |
| 6 | **Legato**<br>`legato` | When on, glide applies only between overlapping notes. | `off` / `on` | `off` | — |
| 7 | **Note low**<br>`note_low` | Notes below this are ignored. | `C-2` … `G8` (128) | `C-2` | note |
| 8 | **Note high**<br>`note_high` | Notes above this are ignored. | `C-2` … `G8` (128) | `G8` | note |

#### 2. TRIG — Trigger

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Note**<br>`note` | Which incoming note fires this output. | `all` … `G8` (128) | `all` | note |
| 3 | **Length**<br>`length` | How long the output stays high. Latch holds it for as long as the note is held. | `latch` … `127 ms` (128) | `latch` | ms |
| 4 | **Velocity sensitive**<br>`velocity_sensitive` | Scale the output voltage by note velocity. | `off` / `on` | `off` | — |
| 5 | **Level min**<br>`level_min` | Output voltage at zero velocity, when velocity sensitivity is on. | `0 V` … `9 V` (10) | `0 V` | V |
| 6 | **Level range**<br>`level_range` | Output voltage at full scale. | `+/- 5V` … `-5 V` (12) | `+/- 5V` | V |

#### 3. CC — MIDI CC

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **CC number**<br>`cc_number` | Which MIDI CC number to follow. | `0` … `127` (128) | `1` | — |
| 3 | **Level range**<br>`level_range` | Output voltage at full scale. | `+/- 5V` … `note scale` (13) | `+/- 5V` | V |
| 4 | **Slew**<br>`slew` | Smooths the output, so it glides to new values instead of stepping. | `OFF` … `100` (101) | `OFF` | — |

#### 4. VEL — Velocity

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Trigger source**<br>`trigger_source` | Take velocity from notes on the MIDI channel, or from the note playing on another CV output. | `note` … `CV8` (9) | `CV1` | — |
| 3 | **Level range**<br>`level_range` | Output voltage at full scale. | `+/- 5V` … `-5 V` (12) | `10 V` | V |

#### 5. AT — Aftertouch

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Level range**<br>`level_range` | Output voltage at full scale. | `+/- 5V` … `-5 V` (12) | `+/- 5V` | V |
| 3 | **Slew**<br>`slew` | Smooths the output, so it glides to new values instead of stepping. | `OFF` … `127` (128) | `OFF` | — |

#### 6. POLY AT — Poly aftertouch

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Trigger source**<br>`trigger_source` | Which note’s aftertouch to follow. | `C-2` … `G8` (128) | `C1` | note |
| 3 | **Level range**<br>`level_range` | Output voltage at full scale. | `+/- 5V` … `-5 V` (12) | `10 V` | V |
| 4 | **Slew**<br>`slew` | Smooths the output, so it glides to new values instead of stepping. | `OFF` … `127` (128) | `OFF` | — |

#### 7. PB — Pitch bend

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Level range**<br>`level_range` | Output voltage at full scale. | `+/- 5V` … `-5 V` (12) | `+/- 5V` | V |
| 3 | **Slew**<br>`slew` | Smooths the output, so it glides to new values instead of stepping. | `OFF` … `127` (128) | `OFF` | — |

#### 8. CLOCK

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Clock event**<br>`clock_event` | Which clock event to output: running clock pulses, start/stop, or reset. | `clock` / `start/stop` / `reset` | `clock` | — |
| 3 | **Clock division**<br>`division` | How often this runs, as a division of the master clock. | `4/1` … `1/16.` (23) | `1/16` | bars/beats |
| 4 | **Length**<br>`length` | How long the output stays high. Latch holds it for as long as the note is held. | `1 ms` … `128 ms` (129) | `5 ms` | ms |
| 5 | **Level range**<br>`level_range` | Output voltage at full scale. | `+/- 5V` … `-5 V` (12) | `5 V` | V |
| 6 | **Swing**<br>`swing` | Delays every other step to create shuffle. | `OFF` … `90%` (6) | `OFF` | — |

#### 9. LFO

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Waveform**<br>`waveform` | The LFO shape. | `saw up` … `random` (7) | `saw up` | — |
| 3 | **Rate**<br>`rate` | LFO speed, as a division of the master clock. | `32/1` … `1/16.` (25) | `4/1` | bars/beats |
| 4 | **Reset mode**<br>`lfo_mode` | Whether the LFO free-runs, restarts on each note, or runs only while a key is held. | `continious` / `note reset` / `gated` | `continious` | — |
| 5 | **Level range**<br>`level_range` | Output voltage at full scale. | `+/- 5V` … `-5 V` (12) | `+/- 5V` | V |

#### 10. ENV — Envelope

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Trigger source**<br>`trigger_source` | What triggers the envelope: notes on the MIDI channel, or the note playing on another CV output. | `note` … `CV8` (9) | `note` | — |
| 3 | **Note**<br>`note` | Which incoming note fires this output. | `all` … `G8` (128) | `all` | note |
| 4 | **Shape**<br>`envelope_shape` | Which envelope stages are used. | `ar` / `ad` / `adsr` / `loop` | `adsr` | — |
| 5 | **Attack**<br>`attack` | Time to rise from zero to full level. | ` 2.1 ms` … ` 134217.7 ms` (128) | ` 2.2 ms` | ms |
| 6 | **Decay**<br>`decay` | Time to fall from full level to the sustain level. | ` 2.1 ms` … ` 134217.7 ms` (128) | ` 15.6 ms` | ms |
| 7 | **Sustain**<br>`sustain` | Level held while the note is held. | `0` … `100` (101) | `100` | — |
| 8 | **Release**<br>`release` | Time to fall to zero after the note is released. | ` 2.1 ms` … ` 134217.7 ms` (128) | ` 15.6 ms` | ms |

#### 11. SEQ — Sequencer

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Step output**<br>`seq_output` | What each step emits. | `notes` / `cc` | `notes` | — |
| 3 | **Base note**<br>`base_note` | The note a step plays when its value is zero. | `C-2` … `G8` (128) | `C1` | note |
| 4 | **Clock division**<br>`division` | How often this runs, as a division of the master clock. | `4/1` … `1/16.` (23) | `1/16` | bars/beats |
| 5 | **Length**<br>`length` | Number of steps in the sequence. | `1` … `64` (64) | `8` | steps |
| 6 | **Direction**<br>`direction` | The order steps are played in. | `forward` / `backward` / `pendulum` / `random` | `forward` | — |
| 7 | **Glide**<br>`glide` | Portamento time between notes. | `OFF` … `100` (101) | `OFF` | — |
| 8 | **Note action**<br>`note_action` | What an incoming note does to the sequence: transpose it, or randomise it over one or two octaves. | `transpose` / `randomise 1_oct` / `randomise 2_oct` | `transpose` | — |

#### 12. RANDOM

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Trigger source**<br>`trigger_source` | What generates a new random value: an incoming note, or the master clock. | `note` / `clock` | `clock` | — |
| 3 | **Clock division**<br>`division` | How often this runs, as a division of the master clock. | `4/1` … `1/16.` (23) | `1/16` | bars/beats |
| 4 | **Base note**<br>`base_note` | The note the random values are centred on. Ignored when the source is an incoming note. | `C-2` … `G8` (128) | `C2` | note |
| 5 | **Interval range**<br>`interval_range` | How far, in semitones, a random value can stray from the base note. | `+/-1` … `+/-47` (47) | `+/-12` | semitones |
| 6 | **Slew**<br>`slew` | Smooths the output, so it glides to new values instead of stepping. | `OFF` … `100` (101) | `OFF` | — |

#### 13. ARP — Arpeggiator

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Direction**<br>`direction` | The order steps are played in. | `forward` / `backward` / `pendulum` / `random` | `forward` | — |
| 3 | **Octave range**<br>`octave_range` | How many octaves the arpeggio spans above the held notes. | `1 OCT` / `2 OCT` / `3 OCT ` / `4 OCT` | `1 OCT` | oct |
| 4 | **Clock division**<br>`division` | How fast the arpeggio steps, as a division of the master clock. | `4/1` … `1/16.` (23) | `1/16` | bars/beats |
| 5 | **Hold**<br>`hold` | Keep arpeggiating after the keys are released. | `off` / `on` | `off` | — |
| 6 | **Swing**<br>`swing` | Delays every other step to create shuffle. | `OFF` … `90%` (6) | `OFF` | — |

#### 14. CC RECORDER

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **CC number**<br>`cc_number` | Which MIDI CC to record. | `0` … `127` (128) | `1` | — |
| 3 | **Clock division**<br>`division` | How often this runs, as a division of the master clock. | `4/1` … `1/16.` (23) | `1/16` | bars/beats |
| 4 | **Length**<br>`length` | Number of steps in the recording. | `1` … `64` (64) | `16` | steps |
| 5 | **Glide**<br>`glide` | Smooths the transition between recorded steps. | `OFF` … `100` (101) | `OFF` | — |
| 6 | **Note**<br>`note` | Which incoming note performs the note action. | `all` … `G8` (128) | `C3` | note |
| 7 | **Note action**<br>`note_action` | What the trigger note does: clear, arm recording, start recording, or start/stop playback. | `clear seq` / `arm record` / `start record` / `gate start/stop` | `clear seq` | — |
| 8 | **Level range**<br>`level_range` | Output voltage at full scale. | `+/- 5V` … `note scale` (13) | `10 V` | V |


### Gate output modes

#### 0. OFF

No parameters. The output is inactive.

#### 1. GATE

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Trigger source**<br>`trigger_source` | What opens the gate: notes on the MIDI channel, or the note playing on another CV output. Pick a CV output to pair this gate with a voice. | `note` … `CV8` (9) | `CV1` | — |
| 3 | **Level range**<br>`level_range` | Output voltage at full scale. | `10 V` … `1 V` (10) | `10 V` | V |
| 4 | **Velocity sensitive**<br>`velocity_sensitive` | Scale the output voltage by note velocity. | `off` / `on` | `off` | — |
| 5 | **Rise**<br>`rise` | A short attack on the gate, to soften its leading edge. | `OFF` … `67.11 s` (100) | `OFF` | ms |
| 6 | **Fall**<br>`fall` | A short decay on the gate, to soften its trailing edge. | `OFF` … `67.11 s` (100) | `OFF` | ms |
| 7 | **Retrigger**<br>`retrigger` | Restart the gate on every new note, even if the previous note is still held. | `off` / `on` | `off` | — |

#### 2. TRIG — Trigger

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Trigger source**<br>`trigger_source` | What fires the trigger: notes on the MIDI channel, or the note playing on another CV output. | `note` … `CV8` (9) | `note` | — |
| 3 | **Note**<br>`note` | Which incoming note fires this output. | `all` … `G8` (128) | `all` | note |
| 4 | **Length**<br>`length` | How long the output stays high. Latch holds it for as long as the note is held. | `latch` … `127 ms` (128) | `latch` | ms |
| 5 | **Velocity sensitive**<br>`velocity_sensitive` | Scale the output voltage by note velocity. | `off` / `on` | `off` | — |
| 6 | **Level min**<br>`level_min` | Output voltage at zero velocity, when velocity sensitivity is on. | `0 V` … `9 V` (10) | `0 V` | V |
| 7 | **Level range**<br>`level_range` | Output voltage at full scale. | `10 V` … `1 V` (10) | `10 V` | V |

#### 3. CC — MIDI CC

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **CC number**<br>`cc_number` | Which MIDI CC number to follow. | `0` … `127` (128) | `1` | — |
| 3 | **Level range**<br>`level_range` | Output voltage at full scale. | `10 V` … `1 V` (10) | `10 V` | V |
| 4 | **Slew**<br>`slew` | Smooths the output, so it glides to new values instead of stepping. | `OFF` … `100` (101) | `OFF` | — |

#### 4. VEL — Velocity

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Trigger source**<br>`trigger_source` | Take velocity from notes on the MIDI channel, or from the note playing on another CV output. | `note` … `CV8` (9) | `CV1` | — |
| 3 | **Level range**<br>`level_range` | Output voltage at full scale. | `10 V` … `1 V` (10) | `10 V` | V |

#### 5. AT — Aftertouch

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Level range**<br>`level_range` | Output voltage at full scale. | `10 V` … `1 V` (10) | `10 V` | V |
| 3 | **Slew**<br>`slew` | Smooths the output, so it glides to new values instead of stepping. | `OFF` … `100` (101) | `OFF` | — |

#### 6. POLY AT — Poly aftertouch

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Trigger source**<br>`trigger_source` | Which note’s aftertouch to follow. | `C-2` … `G8` (128) | `C1` | note |
| 3 | **Level range**<br>`level_range` | Output voltage at full scale. | `10 V` … `1 V` (10) | `10 V` | V |
| 4 | **Slew**<br>`slew` | Smooths the output, so it glides to new values instead of stepping. | `OFF` … `100` (101) | `OFF` | — |

#### 7. PB — Pitch bend

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Level range**<br>`level_range` | Output voltage at full scale. | `10 V` … `1 V` (10) | `10 V` | V |
| 3 | **Slew**<br>`slew` | Smooths the output, so it glides to new values instead of stepping. | `OFF` … `100` (101) | `OFF` | — |

#### 8. CLOCK

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Clock event**<br>`clock_event` | Which clock event to output: running clock pulses, start/stop, or reset. | `clock` / `start/stop` / `reset` | `clock` | — |
| 3 | **Clock division**<br>`division` | How often this runs, as a division of the master clock. | `4/1` … `1/16.` (23) | `1/16` | bars/beats |
| 4 | **Length**<br>`length` | How long the output stays high. Latch holds it for as long as the note is held. | `1 ms` … `128 ms` (129) | `5 ms` | ms |
| 5 | **Level range**<br>`level_range` | Output voltage at full scale. | `10 V` … `1 V` (10) | `10 V` | V |
| 6 | **Swing**<br>`swing` | Delays every other step to create shuffle. | `OFF` … `90%` (6) | `OFF` | — |

#### 9. LFO

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Waveform**<br>`waveform` | The LFO shape. | `saw up` … `random` (7) | `saw up` | — |
| 3 | **Rate**<br>`rate` | LFO speed, as a division of the master clock. | `32/1` … `1/16.` (25) | `4/1` | bars/beats |
| 4 | **Reset mode**<br>`lfo_mode` | Whether the LFO free-runs, restarts on each note, or runs only while a key is held. | `continious` / `note reset` / `gated` | `continious` | — |
| 5 | **Level range**<br>`level_range` | Output voltage at full scale. | `10 V` … `1 V` (10) | `10 V` | V |

#### 10. ENV — Envelope

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Trigger source**<br>`trigger_source` | What triggers the envelope: notes on the MIDI channel, or the note playing on another CV output. | `note` … `CV8` (9) | `note` | — |
| 3 | **Note**<br>`note` | Which incoming note fires this output. | `all` … `G8` (128) | `all` | note |
| 4 | **Shape**<br>`envelope_shape` | Which envelope stages are used. | `ar` / `ad` / `adsr` / `loop` | `adsr` | — |
| 5 | **Attack**<br>`attack` | Time to rise from zero to full level. | ` 2.1 ms` … ` 134217.7 ms` (128) | ` 2.2 ms` | ms |
| 6 | **Decay**<br>`decay` | Time to fall from full level to the sustain level. | ` 2.1 ms` … ` 134217.7 ms` (128) | ` 15.6 ms` | ms |
| 7 | **Sustain**<br>`sustain` | Level held while the note is held. | `0` … `100` (101) | `100` | — |
| 8 | **Release**<br>`release` | Time to fall to zero after the note is released. | ` 2.1 ms` … ` 134217.7 ms` (128) | ` 15.6 ms` | ms |

#### 11. SEQ — Sequencer

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Step output**<br>`seq_output` | What each step emits. | `gates` / `cc` | `gates` | — |
| 3 | **Clock division**<br>`division` | How often this runs, as a division of the master clock. | `4/1` … `1/16.` (23) | `1/16` | bars/beats |
| 4 | **Gate length**<br>`gate_length` | How long each emitted gate stays high. | `1 ms` … `128 ms` (129) | `6 ms` | ms |
| 5 | **Length**<br>`length` | Number of steps in the sequence. | `1` … `64` (64) | `8` | steps |
| 6 | **Direction**<br>`direction` | The order steps are played in. | `forward` / `backward` / `pendulum` / `random` | `forward` | — |
| 7 | **Level range**<br>`level_range` | Output voltage at full scale. | `10 V` … `1 V` (10) | `10 V` | V |
| 8 | **Note action**<br>`note_action` | What an incoming note does to the sequence. | `off` / `randomise` | `off` | — |

#### 12. RANDOM

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Trigger source**<br>`trigger_source` | What generates a new random value: an incoming note, or the master clock. | `note` / `clock` | `clock` | — |
| 3 | **Clock division**<br>`division` | How often this runs, as a division of the master clock. | `4/1` … `1/16.` (23) | `1/16` | bars/beats |
| 4 | **Length**<br>`length` | How long each output gate stays high. | `latch` … `127 ms` (128) | `6 ms` | ms |
| 5 | **Probability**<br>`probability` | The chance that a new random value is generated on each trigger. | `0%` … `100%` (101) | `11%` | % |
| 6 | **Random depth**<br>`random_depth` | How far a new random value can move. | `0%` … `100%` (101) | `0%` | % |
| 7 | **Level range**<br>`level_range` | Output voltage at full scale. | `10 V` … `1 V` (10) | `10 V` | V |
| 8 | **Slew**<br>`slew` | Smooths the output, so it glides to new values instead of stepping. | `OFF` … `127` (128) | `OFF` | — |

#### 13. EUCLIDEAN

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **MIDI channel**<br>`channel` | Which MIDI channel this output listens to. | `ch 1` … `ch 16` (16) | `ch 1` | channel |
| 2 | **Clock division**<br>`division` | How often this runs, as a division of the master clock. | `4/1` … `1/16.` (23) | `1/16` | bars/beats |
| 3 | **Gate length**<br>`gate_length` | How long each emitted gate stays high. | `1 ms` … `128 ms` (129) | `6 ms` | ms |
| 4 | **Steps**<br>`steps` | Number of steps in the sequence. | `1` … `64` (64) | `16` | steps |
| 5 | **Fills**<br>`fills` | How many of the steps are active. The Euclidean algorithm spreads them evenly. | `1` … `64` (64) | `4` | steps |
| 6 | **Rotate**<br>`rotate` | Shifts the whole pattern forward or back. | `0` … `63` (64) | `0` | steps |
| 7 | **Level range**<br>`level_range` | Output voltage at full scale. | `10 V` … `1 V` (10) | `10 V` | V |


### FX types

#### 0. OFF

No parameters. The output is inactive.

#### 1. NOTE FILTER — note-domain, wire byte `0x01`

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **Target**<br>`target` | The CV output this filter applies to. | `CV 1` … `CV 8` (8) | `CV 1` | — |
| 2 | **Note low**<br>`note_low` | Notes below this are ignored. | `C-2` … `G8` (128) | `C-2` | note |
| 3 | **Note high**<br>`note_high` | Notes above this are ignored. | `C-2` … `G8` (128) | `G8` | note |

#### 2. RANDOM OCT — Random octave

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **Target**<br>`target` | The output this FX slot processes. | `CV 1` … `CV 8` (8) | `CV 1` | — |
| 2 | **Octave range**<br>`octave_range` | How many octaves up or down a note can be moved. | `0` … `4` (5) | `1` | oct |
| 3 | **Probability**<br>`probability` | The chance that a note is moved to a different octave. | `0%` … `100%` (101) | `0%` | % |

#### 3. RANDOM NOTE — note-domain, wire byte `0x03`

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **Target**<br>`target` | The output this FX slot processes. | `CV 1` … `CV 8` (8) | `CV 1` | — |
| 2 | **Interval range**<br>`interval_range` | The largest interval, in semitones, that can be added. | `+/-1` … `+/-47` (47) | `+/-12` | semitones |
| 3 | **Probability**<br>`probability` | The chance that a random interval is added. | `0%` … `100%` (101) | `10%` | % |

#### 4. CHANCE — note-domain, wire byte `0x04`

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **Target**<br>`target` | The output this FX slot processes. | `CV 1` … `CV 8` (8) | `CV 1` | — |
| 2 | **Probability**<br>`probability` | The chance that a note plays at all. | `0%` … `100%` (101) | `10%` | % |
| 3 | **Velocity to probability**<br>`velocity_probability` | How strongly note velocity influences the probability. | `0%` … `100%` (101) | `10%` | % |

#### 5. ACCUMULATE — note-domain, wire byte `0x05`

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **Target**<br>`target` | The output this FX slot processes. | `CV 1` … `CV 8` (8) | `CV 1` | — |
| 2 | **Amount**<br>`amount` | Interval added to each successive note. | `0` … `-63` (128) | `3` | — |
| 3 | **Reset after**<br>`reset_after` | Number of notes before the accumulated offset resets to zero. | `1` … `128` (128) | `4` | — |

#### 6. TRANSPOSE — note-domain, wire byte `0x06`

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **Target**<br>`target` | The output this FX slot processes. | `CV 1` … `CV 8` (8) | `CV 1` | — |
| 2 | **Semitones**<br>`semitones` | Transposition in semitones. | `-63` … `64` (128) | `0` | semitones |
| 3 | **Octaves**<br>`octaves` | Transposition in octaves. | `-4` … `4` (9) | `0` | oct |

#### 7. SCALE — note-domain, wire byte `0x07`

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **Target**<br>`target` | The output this FX slot processes. | `CV 1` … `CV 8` (8) | `CV 1` | — |
| 2 | **Scale**<br>`scale` | The scale incoming notes are quantised to. | `chromatic` … `minor dim 7 chord` (24) | `chromatic` | — |
| 3 | **Root note**<br>`root` | The root note of the scale. | `C` … `B` (12) | `C` | — |

#### 8. MICROTONAL — note-domain, wire byte `0x08`

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **Target**<br>`target` | The output this FX slot processes. | `CV 1` … `CV 8` (8) | `CV 1` | — |
| 2 | **Table**<br>`table` | Which of the 8 microtonal tables to apply. Table contents are set on the module, not here. | `table  1` … `table  8` (8) | `table  1` | table |

#### 9. DELAY — gate-domain, wire byte `0x20`

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **Target**<br>`target` | The output this FX slot processes. | `GATE 1` … `GATE 8` (8) | `GATE 1` | — |
| 2 | **Amount**<br>`amount` | How long each gate is delayed. | `0 ms` … `1041 ms` (128) | `82 ms` | ms |

#### 10. HUMANIZE — gate-domain, wire byte `0x21`

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **Target**<br>`target` | The output this FX slot processes. | `GATE 1` … `GATE 8` (8) | `GATE 1` | — |
| 2 | **Amount**<br>`amount` | How much random timing jitter to add. | `0%` … `100%` (101) | `10%` | % |

#### 11. LOGIC — gate-domain, wire byte `0x22`

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **Target**<br>`target` | The output this FX slot processes. | `GATE 1` … `GATE 8` (8) | `GATE 1` | — |
| 2 | **Operation**<br>`operation` | The logic operation applied to the two gates. | `AND` … `NOT` (7) | `AND` | — |
| 3 | **Operand**<br>`operand` | The second gate input to the logic operation. | `GATE 1` … `GATE 8` (8) | `GATE 1` | — |

#### 12. RANDOM VEL — Random velocity

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **Target**<br>`target` | The output this FX slot processes. | `GATE 1` … `GATE 8` (8) | `GATE 1` | — |
| 2 | **Amount**<br>`amount` | The range of the generated random velocity. | `0` … `127` (128) | `63` | — |
| 3 | **Blend**<br>`blend` | How the generated velocity combines with the incoming note velocity. | `added` / `substracted` / `replaced` | `added` | — |

#### 13. RANDOM TRIG LENGTH — gate-domain, wire byte `0x24`

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **Target**<br>`target` | The output this FX slot processes. | `GATE 1` … `GATE 8` (8) | `GATE 1` | — |
| 2 | **Amount**<br>`amount` | How much the trigger length can vary. Zero leaves it unchanged. | `0` … `127` (128) | `63` | — |
| 3 | **Velocity depth**<br>`velocity_depth` | How strongly note velocity influences the result. | `0` … `127` (128) | `10` | — |

#### 14. INVERT — gate-domain, wire byte `0x25`

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **Target**<br>`target` | The output this FX slot processes. | `GATE 1` … `GATE 8` (8) | `GATE 1` | — |

#### 15. REPEATS — gate-domain, wire byte `0x26`

| Byte | Parameter | What it does | Values | Default | Unit |
|---:|---|---|---|---|---|
| 1 | **Target**<br>`target` | The output this FX slot processes. | `GATE 1` … `GATE 8` (8) | `GATE 1` | — |
| 2 | **Amount**<br>`amount` | How fast the repeats fire, as a division of the clock. | `0` … `127` (128) | `2` | — |
| 3 | **Repeats**<br>`repeats` | How many times each gate repeats. | `0` … `127` (128) | `1` | — |

