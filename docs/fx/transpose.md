# Transpose

**Domain:** note. Target**:** `CV 1` … `CV 8`.

Shifts notes by a fixed amount.

---

## What it does to the signal

Adds **Semitones** semitones and **Octaves** octaves to every note reaching the
destination. Both can be negative, and they add together — `semitone -5` with
`octave 1` shifts up seven semitones.

Nothing is dropped and nothing is quantised. A transposed note is just a
different note.

---

## What it needs to work

The destination CV output must be in `Note`, `Arpeggiator`, `Sequencer` or `Random` mode.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Target** — the editor says `dest`


| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Target** | `CV 1` … `CV 8` | `CV 1` | |
| **Semitones** | `-63` … `+64` | `0` | Semitone offset |
| **Octaves** | `-4` … `+4` | `0` | Octave offset, added to the above |

The defaults are both zero, so a freshly added Transpose does nothing.

The **Semitones** range is wider than it looks useful — ±63 semitones is over five
octaves — and it overlaps **Octaves** completely. Use **Octaves** for octaves and
**Semitones** for the remainder; it is easier to read back later.

---

## Where to put it in a chain

**After [Scale](scale.md)** and Transpose moves the quantised result, which can
land you outside the scale. Transposing a C-major-quantised line up 1 semitone
gives you C♯ major, which may be exactly what you want, or may be a mistake.

**Before Scale** and the transposition happens first, then everything is pulled
back into the scale. The result stays in key.

Neither is wrong. Decide which you mean, then check the slot numbers.

---

## What it's for

**Getting a bassline into the register your oscillator likes.**

- FX 3: **FX type** `Transpose`, **Target** `CV 2`, `semitone 0`, `octave -2`

Your sequencer writes the part in a comfortable middle register and CV 2 plays it
two octaves down, without you having to rewrite the part or retune the
oscillator.

**A live use:** map **Semitones** to a CC through the
[CC map](../concepts.md#7-the-cc-map-controls-parameters-from-cc) with
**Low note** and **High note** set to a narrow window — say −12 to +12 — and you have a
transpose knob for a running sequence.
