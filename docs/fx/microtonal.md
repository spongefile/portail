# Microtonal

**Domain:** note. **Target:** `CV 1` … `CV 8`.

Retunes the output using one of eight tuning tables, so notes need not be
twelve-tone equal temperament.

---

## What it does to the signal

Replaces the pitch mapping. Each pitch class — C, C♯, D and so on — is given a
tuning in **cents** by the selected table, and the note's voltage is built from
that instead of from a fixed 1/12 V step.

Concretely, the firmware computes each note as:

```
note_cents = (octave × 1200) + table[pitch class]
```

so the octave is always exactly 1200 cents and the table only shifts the twelve
pitch classes within it. A semitone is 100 cents; the DAC turns `cents / 100`
into a 1 V/oct voltage using your module's calibration.

That makes Microtonal categorically different from the other Note FX.
[Scale](scale.md) and [Transpose](transpose.md) change *which note number* is
played; Microtonal changes *what pitch each note class means*.

**Microtonal is always applied last**, whatever slot it occupies. The official
manual states this — "this effect will always be at the end of the FX chain" —
and it follows from what it does: it is the final note-to-voltage step, so nothing
can come after it.

This means you can combine it freely with the others without worrying about slot
order. Quantise with Scale in any slot, and Microtonal still applies the tuning
afterwards.

---

## What it needs to work

The destination CV output must be in `Note`, `Arpeggiator`, `Sequencer` or `Random` mode.

You do **not** need to load anything first. All eight tables ship as standard
tuning, so a freshly added Microtonal changes nothing until you select a table
you have customised — see [The tables](#the-tables). To author a tuning and send
it to a table, use the editor's [Tuning tab](../editor.md#the-tuning-tab).

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Target** — the editor says `dest`
> - **Tuning table** — the editor says `scale tab`


| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Target** | `CV 1` … `CV 8` | `CV 1` | |
| **Tuning table** | `table 1` … `table 8` | `table 1` | Which of the 8 tuning slots to use |

---

## The tables

**All eight tables ship identical: standard 12-tone equal temperament**, 100
cents per semitone, zero deviation. This is confirmed from the firmware (version
0.83r).

There are **no exotic factory tunings**. The eight "tables" are **empty user
slots**, and their factory and reset default is plain equal temperament — which
is exactly why the editor lists them as bare "table 1 … 8" with no names. There
is nothing pre-loaded to name.

So two things follow, and they replace the caution earlier drafts of this manual
carried:

- **`table 1` is a safe standard-tuning default.** Confirmed, not assumed. You can
  leave Microtonal in a chain on `table 1` and it will not change your pitch.
- **Any distinctive tuning on a module is something its owner stored**, not
  something eowave shipped.

### Where a table lives

Each table is **12 values, one per pitch class, in cents** (14-bit). Factory
tables decode to `0, 100, 200 … 1100` — even semitones.

A module's tables live in its own **flash memory**, separately
from the presets and **not** inside the firmware image. That has one practical
consequence: **a customised table can only be read back off the physical module**,
never derived from the firmware. If you want to know what a friend loaded onto
their Portail, you have to measure their hardware.

### Reading a table you have customised

You only need this if you (or a previous owner) have changed a table from the
default — a factory table is standard tuning and needs no measuring.

With a multimeter, or a tuner and an oscillator you trust:

1. Set a CV output to `Note`, `channel ch 1`, no other FX.
2. Play `C3` through `C4` chromatically, measuring the jack at each semitone. This
   is your **12-TET reference**: twelve equal steps of 83.3 mV, with C4 exactly
   1.000 V above C3.
3. Add `FX 1: Microtonal, Target the same output, Tuning table` set to the slot
   you want to read.
4. Repeat the measurement. Each step that differs from 83.3 mV is that pitch
   class's tuning. Convert to cents with **cents = millivolts × 1.2** (83.3 mV =
   100 cents).

That reads back a customised table without any documentation. A factory table
will simply measure as even 83.3 mV steps, confirming it is untouched.

### Editing a table

Use the editor's **[Tuning tab](../editor.md#the-tuning-tab)** to author a scale
and send it to one of the eight tables. You enter twelve cents values, one per
pitch class (C is normally 0, but the root is editable — a non-zero root
transposes the whole table; the module adds the octave), or import a Scala
`.scl` file. Only 12-note, octave-repeating scales fit the module's tables — the
Tuning tab explains the rest.

A factory tuning, **Quarter-tone (24-TET offset)**, ships in the Tuning tab —
every pitch class raised 50 cents. Because one table holds only 12 pitch classes,
full 24-TET does not fit a single table: put this tuning on one output and a
plain 12-TET tuning on another, and the two outputs together give the full
24-TET set (the technique behind quarter-tone music like **Angine de Poitrine**).
A 24-note `.scl` file is refused on import for the same reason — the paired
outputs are the way.

Two things to keep in mind, both covered in full on the
[Tuning tab](../editor.md#honesty-what-the-app-can-and-cannot-promise): the
table-write format is **not yet confirmed on hardware** (the first send asks you
to confirm, and the tuning is marked Unverified until you check it plays in tune),
and a sent tuning writes to **working memory** — it may not survive a
power-cycle, so re-send it after powering the module on.

See [Appendix: scales and microtonal tables](../appendix-scales.md).

---

## What it's for

**Playing a scale that twelve-tone equal temperament cannot express** — just
intonation, quarter tones, a historical temperament, or a stretched tuning — once
you have loaded one into a slot.

- CV 1: **Mode** `Note`, **Channel** `ch 1`
- FX 1: **FX type** `Microtonal`, **Target** `CV 1`, **Tuning table** `table 2`

With `table 2` still at its factory default this plays in standard tuning, because
every slot ships as 12-TET. Load a custom tuning into `table 2` first — from the
editor's [Tuning tab](../editor.md#the-tuning-tab) — and the same patch retunes
the keyboard: the layout is unchanged, every key still sounds, but the intervals
follow the table rather than the piano.

Full walkthrough: [Recipes → microtonal and scale playback](../recipes/microtonal.md).
