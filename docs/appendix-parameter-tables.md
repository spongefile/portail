# Appendix: parameter tables

Every value list in full, in index order. Index numbers matter because they are
what a [CC map](concepts.md#7-the-cc-map-controls-parameters-from-cc)
mapping's **Low note** and **High note** refer to, and what a saved configuration file contains.

Generated from `spec/model.json`, which is derived mechanically from the shipped
editor's parameter tables. Where a value here disagrees with the official manual,
the official manual is wrong — see [audit §3](audit.md).

---

## Voltage ranges

### CV outputs (`range_cv_menu`)

Used by every mode on a CV output.

| # | Value | # | Value | # | Value |
|---|---|---|---|---|---|
| 0 | `+/-5 V` | 4 | `3 V` | 8 | `-2 V` |
| 1 | `10 V` | 5 | `2 V` | 9 | `-3 V` |
| 2 | `5 V` | 6 | `1 V` | 10 | `-4 V` |
| 3 | `4 V` | 7 | `-1 V` | 11 | `-5 V` |

`+/-5 V` at index 0 is bipolar. Indices 7-11 are inverting: full scale
produces a negative voltage.

### CV outputs with note scale (`range_cv_note_menu`)

Used by CC and CC recorder on CV outputs. Identical to the above plus one
extra option.

| # | Value | # | Value | # | Value |
|---|---|---|---|---|---|
| 0 | `+/-5 V` | 5 | `2 V` | 10 | `-4 V` |
| 1 | `10 V` | 6 | `1 V` | 11 | `-5 V` |
| 2 | `5 V` | 7 | `-1 V` | 12 | **Note** `scale` |
| 3 | `4 V` | 8 | `-2 V` |  |  |
| 4 | `3 V` | 9 | `-3 V` |  |  |

**Note** `scale` makes the output produce 1 V/oct pitch steps instead of a
continuous voltage.

### Gate outputs (`range_gate_menu`)

Used by every mode on a Gate output. Positive only.

| # | Value | # | Value | # | Value |
|---|---|---|---|---|---|
| 0 | `10 V` | 4 | `6 V` | 8 | `2 V` |
| 1 | `9 V` | 5 | `5 V` | 9 | `1 V` |
| 2 | `8 V` | 6 | `4 V` |  |  |
| 3 | `7 V` | 7 | `3 V` |  |  |

### Trig minimum level (`invert_range_gate_menu`)

The **Level min** parameter on Trigger, on both banks.

| # | Value | # | Value | # | Value |
|---|---|---|---|---|---|
| 0 | `0 V` | 4 | `4 V` | 8 | `8 V` |
| 1 | `1 V` | 5 | `5 V` | 9 | `9 V` |
| 2 | `2 V` | 6 | `6 V` |  |  |
| 3 | `3 V` | 7 | `7 V` |  |  |

---

## Clock divisions

**Clock division** — used by Clock, Sequencer, Euclidean, Arpeggiator, Random and CC recorder.
23 values.

| # | Value | # | Value | # | Value |
|---|---|---|---|---|---|
| 0 | `4/1` | 8 | `4/1T` | 16 | `4/1.` |
| 1 | `2/1` | 9 | `2/1T` | 17 | `2/1.` |
| 2 | `1/1` | 10 | `1/1T` | 18 | `1/1.` |
| 3 | `1/2` | 11 | `1/2T` | 19 | `1/2.` |
| 4 | `1/4` | 12 | `1/4T` | 20 | `1/4.` |
| 5 | `1/8` | 13 | `1/8T` | 21 | `1/8.` |
| 6 | `1/16` | 14 | `1/16T` | 22 | `1/16.` |
| 7 | `1/32` | 15 | `1/32T` |  |  |

`T` is a triplet, `.` is dotted. `1/1` is one bar of 4/4.

## LFO divisions

**Clock division** — used only by LFO. 25 values. Note the two extra slow
options at the top that the clock list does not have.

| # | Value | # | Value | # | Value |
|---|---|---|---|---|---|
| 0 | `32/1` | 9 | `1/32` | 18 | `4/1.` |
| 1 | `16/1` | 10 | `4/1T` | 19 | `2/1.` |
| 2 | `4/1` | 11 | `2/1T` | 20 | `1/1.` |
| 3 | `2/1` | 12 | `1/1T` | 21 | `1/2.` |
| 4 | `1/1` | 13 | `1/2T` | 22 | `1/4.` |
| 5 | `1/2` | 14 | `1/4T` | 23 | `1/8.` |
| 6 | `1/4` | 15 | `1/8T` | 24 | `1/16.` |
| 7 | `1/8` | 16 | `1/16T` |  |  |
| 8 | `1/16` | 17 | `1/32T` |  |  |

---

## Envelope times

**Attack**, **Decay** and **Release** on [Envelope](modes/env.md) share one 128-entry
exponential table. Selected points:

| Index | Time | Index | Time |
|---|---|---|---|
| 0 | `2.1 ms` | 76 | `80.0 ms` |
| 1 | `2.2 ms` | 85 | `171.9 ms` |
| 10 | `2.9 ms` | 95 | `493.4 ms` |
| 20 | `4.2 ms` | 101 | `1073.7 ms` |
| 30 | `6.2 ms` | 110 | `4628.2 ms` |
| 41 | `10.0 ms` | 115 | `11184.8 ms` |
| 50 | `15.6 ms` | 120 | `26843.5 ms` |
| 60 | `27.1 ms` | 124 | `67108.9 ms` |
| 70 | `51.5 ms` | 127 | `134217.7 ms` |

Full range: `2.1 ms` to `134217.7 ms`. The official manual claims
"between 0 ms and 13 secondes", which is wrong at both ends.

## Rise and fall times

**Rise** and **Fall** on [Gate](modes/gate.md) share a 100-entry exponential table
(`OFF` plus 99 steps). Computed from the editor's source:

| Index | Time | Index | Time |
|---|---|---|---|
| 0 | `OFF` | 80 | `1.49 s` |
| 1 | `13 ms` | 85 | `3.35 s` |
| 10 | `18 ms` | 90 | `10.32 s` |
| 20 | `26 ms` | 93 | `16.78 s` |
| 30 | `38 ms` | 95 | `22.37 s` |
| 40 | `60 ms` | 97 | `33.56 s` |
| 50 | `104 ms` | 98 | `44.74 s` |
| 60 | `200 ms` | 99 | `67.11 s` |
| 70 | `464 ms` |  |  |

Full range: `OFF`, then `13 ms` to `67.11 s`. The official manual calls
this "a small attack envelope".

## Vibrato rates

`vibrato` on [Note](modes/note.md) — `OFF` plus 99 steps. Depth comes from
CC#1, not from this control.

| Index | Rate | Index | Rate |
|---|---|---|---|
| 0 | `OFF` | 60 | `3.87 Hz` |
| 1 | `0.06 Hz` | 70 | `6.91 Hz` |
| 10 | `0.18 Hz` | 80 | `12.34 Hz` |
| 20 | `0.36 Hz` | 90 | `21.99 Hz` |
| 30 | `0.66 Hz` | 95 | `29.38 Hz` |
| 40 | `1.19 Hz` | 99 | `37.07 Hz` |
| 50 | `2.15 Hz` |  |  |

Full range: `OFF`, then `0.06 Hz` to `37.07 Hz`.

## Gate delay times

**Amount** on the [Delay](fx/delay.md) FX slot — 128 steps of about
8.2 ms.

| Index | Delay | Index | Delay |
|---|---|---|---|
| 0 | `0 ms` | 64 | `524 ms` |
| 1 | `8 ms` | 80 | `656 ms` |
| 10 | `82 ms` | 96 | `787 ms` |
| 25 | `204 ms` | 110 | `901 ms` |
| 50 | `409 ms` | 127 | `1041 ms` |

Full range: `0 ms` to `1041 ms`.

---

## Enumerations

**Note mode voice assignment** — **Voice mode** on Note. 7 values:

`Mono last`, `Mono low`, `Mono high`, `Poly group 1`, `Poly group 2`, `Poly group 3`, `Poly group 4`

**Envelope types** — **Mode** on Envelope. 4 values:

`AR`, `AD`, `ADSR`, `Loop`

**LFO waveforms** — **Waveform** on LFO. 7 values:

`Saw up`, `Saw down`, `Square`, `Triangle`, `Sine`, `Noise`, `random`

**LFO phase modes** — **Phase mode** on LFO. 3 values:

`Continuous`, `Note reset`, `Gated`

**Clock event types** — **Trigger source** on Clock. 3 values:

`Clock`, `Start/stop`, `Reset`

**Sequencer direction** — `dir` on Sequencer and Arpeggiator. 4 values:

`Forward`, `Backward`, `Pendulum`, `random`

**Sequencer output type (CV)** — **Voice mode** on Sequencer, CV bank. 2 values:

`notes`, `cc`

**Sequencer output type (Gate)** — **Mode** on Sequencer, Gate bank. 2 values:

`Gates`, `cc`

**Swing** — **Swing** on Clock and Arpeggiator. 6 values:

`OFF`, `55%`, `60%`, `75%`, `80%`, `90%`

**Arpeggiator range** — **Level range** on Arpeggiator. 4 values:

`1 OCT`, `2 OCT`, `3 OCT `, `4 OCT`

**Random trigger source** — **Trigger source** on Random. 2 values:

`Note`, `Clock`

**Gate/Trig/Vel/Env source** — **Trigger source** where it selects a CV output. 9 values:

`Note`, `CV1`, `CV2`, `CV3`, `CV4`, `CV5`, `CV6`, `CV7`, `CV8`

**Logic functions** — **Function** on Logic. 7 values:

`AND`, `OR`, `NAND`, `NOR`, `XOR`, `XNOR`, `NOT`

**Random velocity mix** — **Mode** on Random velocity. 3 values:

`Added`, `Subtracted`, `Replaced`

**Pitch bend range** — **Bend range** on Note, in semitones. 24 values:

`+/-1`, `+/-2`, `+/-3`, `+/-4`, `+/-5`, `+/-6`, `+/-7`, `+/-8`, `+/-9`, `+/-10`, `+/-11`, `+/-12`, `+/-13`, `+/-14`, `+/-15`, `+/-16`, `+/-17`, `+/-18`, `+/-19`, `+/-20`, `+/-21`, `+/-22`, `+/-23`, `+/-24`

**Semitone ranges** — **Level range** on Random (CV) and Random note. 47 values:

`+/-1`, `+/-2`, `+/-3`, `+/-4`, `+/-5`, `+/-6`, `+/-7`, `+/-8`, `+/-9`, `+/-10`, `+/-11`, `+/-12`, `+/-13`, `+/-14`, `+/-15`, `+/-16`, `+/-17`, `+/-18`, `+/-19`, `+/-20`, `+/-21`, `+/-22`, `+/-23`, `+/-24`, `+/-25`, `+/-26`, `+/-27`, `+/-28`, `+/-29`, `+/-30`, `+/-31`, `+/-32`, `+/-33`, `+/-34`, `+/-35`, `+/-36`, `+/-37`, `+/-38`, `+/-39`, `+/-40`, `+/-41`, `+/-42`, `+/-43`, `+/-44`, `+/-45`, `+/-46`, `+/-47`

**Transpose octaves** — **Octaves** on Transpose. 9 values:

`-4`, `-3`, `-2`, `-1`, `0`, `1`, `2`, `3`, `4`

**Random octave range** — **Level range** on Random octave. 5 values:

`0`, `1`, `2`, `3`, `4`

**Microtonal tables** — **Tuning table** on Microtonal. 8 values:

`table  1`, `table  2`, `table  3`, `table  4`, `table  5`, `table  6`, `table  7`, `table  8`

**FX destinations (note domain)** — **Target** on Note FX. 8 values:

`CV 1`, `CV 2`, `CV 3`, `CV 4`, `CV 5`, `CV 6`, `CV 7`, `CV 8`

**FX destinations (gate domain)** — **Target** on Gate FX. 8 values:

`GATE 1`, `GATE 2`, `GATE 3`, `GATE 4`, `GATE 5`, `GATE 6`, `GATE 7`, `GATE 8`

---

## Numeric ranges

| Parameter | Where | Range |
|---|---|---|
| **Channel** | everywhere | `ch 1` - `ch 16` |
| **CC number** | CC, CC recorder | `0` - `127` |
| `Note`, **Low note**, **High note**, **Base note** | several | `C-2` - `G8` (MIDI 0-127) |
| `Note` on Trigger/Envelope | Trigger, Envelope | `all`, then `C#-2` - `G8` |
| **Length** (steps) | Sequencer, CC recorder | `1` - `64` |
| **Steps**, **Fills** | Euclidean | `1` - `64` |
| **Rotate** | Euclidean | `0` - `63` |
| **Length** (time) | Trigger, Random gate | `Latch`, then `1 ms` - `127 ms` |
| **Gate length** | Clock, Sequencer gate, Euclidean | `1 ms` - `128 ms` |
| **Sustain** | Envelope | `0` - `100` |
| **Glide**, **Slew** | Note, Sequencer, Random | `OFF`, then `1` - `100` or `1` - `127` |
| **Slew** | MIDI CC, Aftertouch, Poly aftertouch, Pitch bend | `OFF`, then `1` - `100` (Gate) or `1` - `127` (CV) |
| **Probability**, **Probability**, **Amount** | several FX slots | `0%` - `100%` |
| **Semitones** | Transpose | `-63` - `+64` |
| **Amount** | Accumulate | `0` - `63`, then `0` - `-63` |
| **Reset after** | Accumulate | `1` - `128` |
| Tempo | global | `30` - `250` BPM from the slider; `30` - `284` in 2 BPM steps via a CC mapping |

## Note numbering

MIDI note 0 is `C-2`. MIDI note 60 — middle C — is **`C3`**. MIDI note 127 is
`G8`.

If your keyboard calls middle C `C4`, every note name in this manual is one
octave below the name your keyboard shows for the same key.

