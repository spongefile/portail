# Random note

**Domain:** note. Target**:** `CV 1` … `CV 8`.

Sometimes adds a random interval to a note.

The editor's menu calls this `Random note`. Internally it is the same FX slot
the editor's source calls `random fx`.

---

## What it does to the signal

For each note reaching the destination, **Probability** decides whether to alter
it. If it fires, a random interval of up to **Interval range** semitones — in either
direction — is added.

Unlike [Random octave](random-oct.md), this changes the pitch class, so the result
will often be out of key. That is why it is usually paired with
[Scale](scale.md) in a **higher** slot.

Nothing is dropped, so the rhythm is unaffected.

---

## What it needs to work

The destination CV output must be in `Note`, `Arpeggiator`, `Sequencer` or `Random` mode.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Interval range** — the editor says `range`
> - **Probability** — the editor says `distribution`
> - **Target** — the editor says `dest`


| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Target** | `CV 1` … `CV 8` | `CV 1` | |
| **Interval range** | `+/-1` … `+/-47` semitones | `+/-12` | Maximum interval added |
| **Probability** | `0%` … `100%` | `10%` | How often a note is altered |

The official manual calls **Probability** "Probability" and describes it as
"0% = play the original note all the time, 100% = play the original note with the
random note all the time", which reads as though both notes sound. Only one note
plays; the parameter is the chance that it is the altered one.

---

## What it's for

**Controlled variation in a melodic line, kept in key.**

- FX 1: **FX type** `Random note`, **Target** `CV 1`, **Interval range** `+/-7`, **Probability** `30%`
- FX 2: **FX type** `Scale`, **Target** `CV 1`, **Scale** `minor`, **Root note** `A`

About a third of the notes get shifted by up to a fifth in either direction, and
Scale — in the higher slot, so it runs afterwards — pulls every result back onto
A minor. The line varies without ever going wrong.

**Slot order is the whole trick here.** Put Scale in the lower slot and you
quantise first, then scatter, and the output is out of key. See
[the ordering section](index.md#ordering-with-a-worked-case).

Keep **Interval range** small — `+/-2` to `+/-7` — for variation that still sounds like the
original part. Larger values produce a different part.
