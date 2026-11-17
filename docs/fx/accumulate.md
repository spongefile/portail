# Accumulate

**Domain:** note. Target**:** `CV 1` … `CV 8`.

Adds a growing transposition, resetting after a set number of notes.

The official manual documents this FX slot's two parameters as literally
`?` and `?`. See [audit §5](../audit.md). What follows is derived from the
editor's parameter tables and is marked accordingly.

---

## What it does to the signal

Each note reaching the destination is transposed by an amount that **increases
with every note**. The step size is **Amount**. After **Reset after** notes, the
accumulated transposition returns to zero and the climb begins again.

With **Amount** `3` and **Reset after** `4`, successive notes are transposed by 0, +3, +6, +9,
then back to 0, +3, +6, +9, and so on — a rising figure superimposed on whatever
you are playing.

**Amount** can be negative, giving a descending figure.

`TODO(verify)`: whether the accumulation starts at zero or at **Amount** for the
first note, and whether **Reset after** counts notes or clock divisions. **Test:** set
**Amount** `12` and **Reset after** `4`, play a single repeated `C3`, and write down the four
pitches before it wraps. If you hear C3, C4, C5, C6 the count starts at zero and
counts notes; if you hear C4, C5, C6, C7 it starts at **Amount**.

`TODO(verify)`: whether anything other than reaching **Reset after** clears the
accumulator — a note-off, a transport stop, or a MIDI reset. **Test:** let it
climb two steps, stop your sequencer's transport, restart, and see whether the
next note is transposed or back at zero.

---

## What it needs to work

The destination CV output must be in `Note`, `Arpeggiator`, `Sequencer` or `Random` mode.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Reset after** — the editor says `reset`
> - **Target** — the editor says `dest`


| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Target** | `CV 1` … `CV 8` | `CV 1` | |
| **Amount** | `0` … `63`, then `0` … `-63` | `3` | Semitones added per note |
| **Reset after** | `1` … `128` | `4` | Notes before the accumulator clears |

The **Amount** list is unusual: it runs `0, 1, 2 … 63` and then continues
`0, -1, -2 … -63`. So there are two entries that mean zero, at positions 0 and
64, and the negative half is in the upper half of the list rather than below zero.

---

## Where to put it in a chain

Accumulate will take notes out of key, because a fixed semitone step repeated
does not respect scale degrees. Put [Scale](scale.md) in a **higher** slot to
pull the results back in.

With **Amount** `12` — a whole octave — the pitch class never changes, so no
quantiser is needed.

---

## What it's for

**Turning a one-note pulse into a rising figure.**

- CV 1: **Mode** `Sequencer` or `Arpeggiator` on channel 1
- FX 5: **FX type** `Accumulate`, **Target** `CV 1`, **Amount** `5`, **Reset after** `4`
- FX 6: **FX type** `Scale`, **Target** `CV 1`, **Scale** `minor`, **Root note** `D`

Each note climbs a fourth above the last, four times, then drops back — and
Scale, in the higher slot, keeps every step in D minor. A single repeated note
becomes a four-note ascending phrase that restarts forever.

Set **Amount** to a negative value for the descending version, or map **Reset after** to a
CC through the [CC map](../concepts.md#7-the-cc-map-controls-parameters-from-cc)
to change the phrase length while it runs.
