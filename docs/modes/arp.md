# Arpeggiator

**Available on:** CV outputs only.

Arpeggiator plays the notes you are holding, one at a time, in time with the master
clock.

---

## What comes out of the jack

A **1 V/oct pitch** that steps through the held notes, one per **Clock division**, in the
order set by **Direction**, extended upward by **Octave range** octaves.

The output holds each note's pitch until the next step. Arpeggiator produces pitch only —
for a gate per arpeggiated note, set a Gate output to [Gate](gate.md) or
[Trigger](trig.md) with **Trigger source** pointing at this CV output.

With **Hold** `off` and no keys held, the output stops changing and holds its last
pitch. With **Hold** `on`, the arpeggio keeps running on the last chord until you
play a new one.

---

## What MIDI drives it

**Note-on and note-off** on the selected **Channel** build the note pool. The
**master clock**, divided by **Clock division**, advances through it.

Because Arpeggiator produces note data, Note FX work on it —
[Scale](../fx/scale.md), [Transpose](../fx/transpose.md) and
[Random octave](../fx/random-oct.md) all apply if you point them at this CV
output.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Clock division** — the editor says `div`
> - **Direction** — the editor says `dir`
> - **Octave range** — the editor says `range`



| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Channel** | `ch 1` … `ch 16` | `ch 1` | |
| **Direction** | `Forward`, `Backward`, `Pendulum`, `random` | `Forward` | Order through the held notes |
| **Octave range** | `1 OCT`, `2 OCT`, `3 OCT`, `4 OCT` | `1 OCT` | Octave span |
| **Clock division** | `4/1` … `1/32`, triplets, dotted | `1/16` | One step per division |
| **Hold** | `Off`, `On` | `Off` | Keep playing after keys are released |
| **Swing** | `OFF`, `55%`, `60%`, `75%`, `80%`, `90%` | `OFF` | Delays every second step |

### Octave range

`1 OCT` plays only the notes you are holding. `2 OCT` plays them, then repeats
them an octave up, then returns. `3 OCT` and `4 OCT` extend further.

### Direction

- `Forward` — lowest to highest, then wrap.
- `Backward` — highest to lowest, then wrap.
- `Pendulum` — up then down without repeating the turnaround notes.
- `random` — a random held note each step; notes can repeat.

### Hold

With **Hold** `on`, releasing the keys does not stop the arpeggio. Playing a new
chord replaces the pool. This is what you want for hands-free arpeggios you then
patch around.

`TODO(verify)`: whether, with **Hold** `on`, playing a single new note replaces the
whole held chord or adds to it. **Test:** hold a triad with **Hold** `on`, release,
then play one note. If the arpeggio becomes a single repeating note, it replaces;
if it becomes four notes, it accumulates.

---

## What it's for

**A classic arpeggiated line with a gate to match.**

- CV 1: **Mode** `Arpeggiator`, **Channel** `ch 1`, **Direction** `forward`, **Octave range** `2 OCT`, **Clock division** `1/16`,
  **Hold** `on`, **Swing** `OFF`.
- GATE 1: **Mode** `Trigger`, **Trigger source** `CV 1`, **Length** `10 ms`, **Level range** `10 V`.

Patch CV 1 to pitch and GATE 1 to an envelope. Hold a chord and it arpeggiates
over two octaves in sixteenths. Because **Hold** is on, you can let go and patch
elsewhere while it runs.

Set **Swing** `60%` for shuffle, or **Direction** `pendulum` with **Octave range** `3 OCT` for the long
rolling figure that suits slow tempos.
