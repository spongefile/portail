# Scale

**Domain:** note. Target**:** `CV 1` … `CV 8`.

Quantises notes to a musical scale.

---

## What it does to the signal

Every note reaching the destination is moved to the nearest note of the selected
scale, in the selected key. Notes already in the scale pass through unchanged.

`TODO(verify)`: what happens to a note exactly between two scale degrees —
whether it rounds up or down. **Test:** select **Scale** `major`, **Root note** `C`, and
play F♯, which is equidistant from F and G. Measure the output and see which one
you get. Repeat with C♯ (between C and D) to check the rule is consistent.

Scale does not drop notes. Every input note produces an output note, so gates and
envelopes fire as normal.

---

## What it needs to work

The destination CV output must be in `Note`, `Arpeggiator`, `Sequencer` or `Random` mode.

It is most valuable on `Random` and `Sequencer`, where the incoming pitches are not
something you played and may be anywhere.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Target** — the editor says `dest`


| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Target** | `CV 1` … `CV 8` | `CV 1` | |
| **Scale** | 24 scales — see below | `chromatic` | |
| **Root note** | `C`, `C#`, `D`, `D#`, `E`, `F`, `F#`, `G`, `G#`, `A`, `A#`, `B` | `C` | The key |

**The default **Scale** is `chromatic`, which passes every note.** A freshly added
Scale does nothing until you change it. This catches people.

### The 24 scales

| | | |
|---|---|---|
| `chromatic` | `major` | `minor` |
| `harmonic minor` | `pentatonic major` | `pentatonic minor` |
| `blues` | `dorian` | `phrygian` |
| `lydian` | `mixolydian` | `locrian` |
| `whole note` | `diminished` | `whole half diminished` |
| `quint` | **Octaves** | `major chord` |
| `minor chord` | `major 7th chord` | `minor 7th chord` |
| `major 6th chord` | `minor 6th chord` | `minor dim 7 chord` |

The last seven are chords rather than scales — quantising to `major chord`
restricts the output to root, third and fifth, which turns a random source into
broken-chord arpeggios. **Octaves** restricts to the root note only, in every
octave, which is a useful way to make a random source produce octave jumps and
nothing else.

The official manual says only "Select the scale" and lists none of them. See
[audit §13](../audit.md). Interval contents in
[Appendix: scales](../appendix-scales.md).

---

## What it's for

**Making a random source musical.** This is the standard pairing.

- CV 5: **Mode** `Random`, **Trigger source** `clock`, **Clock division** `1/8`, **Base note** `C2`, **Interval range** `+/-12`
- FX 1: **FX type** `Scale`, **Target** `CV 5`, **Scale** `pentatonic minor`, **Root note** `A`

Every eighth note CV 5 produces a random pitch within an octave of C2, and Scale
pulls it onto A minor pentatonic. The result is generative and never wrong,
because a pentatonic scale has no notes that clash.

**Put Scale in a higher slot than whatever is scattering the notes.** With
Random note in FX 1 and Scale in FX 2, the order is randomise-then-quantise and
the output is in key. Reverse the slots and it is not. See
[the ordering section](index.md#ordering-with-a-worked-case).

Full walkthrough: [Recipes → microtonal and scale playback](../recipes/microtonal.md).
