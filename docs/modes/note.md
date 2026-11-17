# Note

**Available on:** CV outputs only.

Note is the mode that turns MIDI notes into pitch. It is CV-only because pitch
needs the bipolar range and 16-bit resolution that Gate outputs do not have.

---

## What comes out of the jack

A **pitch control voltage at 1 volt per octave**, 16-bit, updated when a new note
is assigned to this output.

The voltage holds at the last note's value between notes. It does not return to
zero on note-off, and it does not gate — Note produces pitch and nothing else.
To also get a gate, set a Gate output to [Gate mode](gate.md) with its **Trigger source**
pointing at this CV output.

Twelve semitones is exactly 1.000 V. The usable span is the CV bank's
−5 V to +10 V, so about fifteen octaves of theoretical range — far more than any
oscillator will track.

`TODO(verify)`: which MIDI note corresponds to 0 V. **Test:** set a CV output to
Note, play `C3` (MIDI 60), and measure the jack with a multimeter. Then play
`C4` and confirm the reading is exactly 1.000 V higher.

If **Vibrato rate** is set and CC#1 is above zero, a sine modulation is added to the
pitch. If **Glide** is set, the voltage ramps to each new note instead of
stepping.

---

## What MIDI drives it

- **Note on / note off** on the selected **Channel**. Which of several simultaneous
  notes this output takes is decided by **Voice mode**.
- **Pitch bend** on the same channel, scaled by **Bend range**.
- **CC#1 (mod wheel)** sets vibrato *depth*. This is not optional — with CC#1 at
  0, the **Vibrato rate** parameter produces no audible effect at all.

Notes outside **Low note** … **High note** are ignored by this output entirely.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Bend range** — the editor says `pb range`
> - **High note** — the editor says `max`
> - **Low note** — the editor says `min`
> - **Vibrato rate** — the editor says `vibrato`
> - **Voice mode** — the editor says `out type`



| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Channel** | `ch 1` … `ch 16` | `ch 1` | |
| **Voice mode** | `Mono last`, `Mono low`, `Mono high`, `Poly group 1` … `Poly group 4` | `Mono last` | Voice assignment. See below |
| **Bend range** | `+/-1` … `+/-24` semitones | `+/-2` | How far full pitch bend moves the pitch |
| **Vibrato rate** | `OFF`, then 99 steps from `0.06 Hz` to `37.07 Hz` | `OFF` | Vibrato **rate**. Depth comes from CC#1 |
| **Glide** | `OFF`, then `1` … `127` | `OFF` | Portamento amount. **Unitless** — see below |
| **Legato** | `Off`, `On` | `Off` | Whether glide applies always or only to overlapping notes |
| **Low note** | `C-2` … `G8` | `C-2` | Lowest note this output accepts |
| **High note** | `C-2` … `G8` | `G8` | Highest note this output accepts |

### Voice mode — voice assignment

The three `mono` settings decide which note wins when several are held:

- **`Mono last`** — the most recently pressed note. The usual choice.
- **`Mono low`** — the lowest held note. Good for basslines under chords.
- **`Mono high`** — the highest held note. Good for lead lines over chords.

The four `poly group` settings put this output into a shared round-robin pool.
**The number of voices equals the number of CV outputs you assign to the same
group.** Three outputs in `Poly group 1` is three-note polyphony. Four groups
exist, so you can run four independent polyphonic parts.

The official manual's description of `Mono high` says it takes "the lowest midi
note", which is a copy-paste error — see [audit §6](../audit.md).

### Glide has no unit

The control is `OFF` then `1`–`127`, and the editor shows a bare number. Higher
is slower. The official manual calls it "glide time" but no time is displayed.

`TODO(verify)`: the actual glide time in ms per volt. The editor's source
contains an unused lookup table (`glide_times`) suggesting a range of roughly
0.1 ms/V to 419 ms/V, but that table is not wired to this control in the shipped
editor, so the real mapping is unconfirmed. **Test:** set **Glide** to `127`, play
`C2` then `C5` (three octaves, 3 V), and time how long the pitch takes to
arrive. Divide by 3 for ms per volt. Repeat at `64` to see whether the curve is
linear or exponential.

### Legato

Controls whether glide applies to every note or only to overlapping ones.

`TODO(verify)`: which way round. The editor labels the values only `Off` and
`On`, the official manual says the parameter selects "if the glide will be
applied between all the notes or only when two notes are played without being
released", and a comment in the editor's source says "by default glide is only
legato notes" — which contradicts the default being `Off`. **Test:** set **Glide**
to `100`, **Legato** to `Off`, and play two separated notes. If the pitch slides,
`Off` means "glide always". Then set **Legato** to `On` and repeat.

### Low note and High note

A note filter local to this output. Notes below **Low note** or above **High note** are ignored
here but still reach other outputs on the same channel.

This is how you split a keyboard without an FX slot: set CV 1 to
**Low note** `C-2, max B2` and CV 2 to **Low note** `C3, max G8`, both on channel 1, and you have
a bass zone and a lead zone. For a filter you can also place mid-chain, use the
[Note filter](../fx/note-filter.md) FX slot instead.

---

## What it's for

**A monosynth voice.** CV 1 to your oscillator's 1 V/oct input, GATE 1 to your
envelope's gate input.

- CV 1: **Mode** `Note`, **Channel** `ch 1`, **Voice mode** `mono last`, **Bend range** `+/-2`,
  everything else default.
- GATE 1: **Mode** `Gate`, **Trigger source** `CV 1`, **Level range** `10 V`.

Play the keyboard: the oscillator tracks it and the envelope fires on each key
press. Bend the wheel and the pitch moves two semitones. Push the mod wheel with
**Vibrato rate** set to about `2 Hz` and you get vibrato.

Extended into three voices: [Recipes → poly synth](../recipes/poly-synth.md).
