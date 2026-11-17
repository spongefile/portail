# Euclidean

**Available on:** Gate outputs only.

Euclidean generates a rhythm from two numbers: how many steps are in the pattern,
and how many of them should fire. The hits are distributed as evenly as possible
across the steps, which is what produces the familiar patterns found in music
worldwide.

---

## What comes out of the jack

A **gate on each step that fires**, **Gate length** milliseconds long, at **Level range**
volts. Steps that do not fire produce nothing. The pattern advances one step per
**Clock division** and loops at **Steps**.

With **Steps** `16` and **Fills** `4`, the hits land on steps 1, 5, 9 and 13 — four on
the floor. With **Steps** `16` and **Fills** `5` they spread unevenly, because five does
not divide sixteen, and that unevenness is the point.

Useful pairs:

| **Steps** | **Fills** | Result |
|---|---|---|
| 16 | 4 | Four on the floor |
| 8 | 3 | Tresillo |
| 8 | 5 | Cinquillo |
| 16 | 7 | Busy, syncopated |
| 16 | 9 | Denser, off-kilter |
| 12 | 5 | Rolling 12/8 feel |

---

## What MIDI drives it

**The master clock**, divided by **Clock division**. Nothing else.

The **Channel** parameter exists on the output but Euclidean does not respond to
notes.

`TODO(verify)`: whether **Channel** has any effect at all on a Euclidean output —
the official manual documents it as "Select the midi channel" without saying what
it does, and no mechanism is apparent. **Test:** set a Euclidean output, then send
notes, CCs and aftertouch on the selected channel and watch for any change in the
pattern.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Clock division** — the editor says `div`
> - **Fills** — the editor says `events`
> - **Gate length** — the editor says `gate len`
> - **Level range** — the editor says `range`
> - **Steps** — the editor says `length`



| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Channel** | `ch 1` … `ch 16` | `ch 1` | No apparent effect |
| **Clock division** | `4/1` … `1/32`, triplets, dotted | `1/16` | One step per division |
| **Gate length** | `1 ms` … `128 ms` | `6 ms` | Gate width |
| **Steps** | `1` … `64` | `16` | Pattern length |
| **Fills** | `1` … `64` | `4` | How many steps fire |
| **Rotate** | `0` … `63` | `0` | Shifts the pattern's start point |
| **Level range** | `10 V` … `1 V` | `10 V` | Gate height |

The official manual calls **Steps** "Steps" but describes it as "the length of
euclidean sequence", and calls **Fills** "Fill the sequencer buffer with notes",
which does not say that it is a count.

### Fills above Steps

Nothing stops you setting **Fills** `20` with **Steps** `16`.

`TODO(verify)`: what happens. **Test:** set **Steps** `8`, raise **Fills** from 8 to
16 one at a time, and watch the output. Either it saturates at every step firing,
or it wraps.

### Rotate

Shifts which step the pattern starts on, without changing which steps fire
relative to each other. A `16/4` pattern rotated by 1 moves the hits from steps
1, 5, 9, 13 to 2, 6, 10, 14 — the same rhythm, displaced.

This is how you get two Euclidean outputs to interlock rather than collide: give
them the same **Steps** and **Fills** and different **Rotate** values.

---

## What it's for

**Two interlocking percussion patterns from one clock.**

- GATE 5: **Mode** `Euclidean`, **Clock division** `1/16`, **Gate length** `5 ms`, **Steps** `16`,
  **Fills** `4`, **Rotate** `0`, **Level range** `10 V` → kick
- GATE 6: **Mode** `Euclidean`, **Clock division** `1/16`, **Gate length** `5 ms`, **Steps** `16`,
  **Fills** `7`, **Rotate** `2`, **Level range** `10 V` → hats

Patch GATE 5 to a kick module and GATE 6 to a hat. The kick lands square; the
hats weave around it and never quite repeat where you expect. Nudge **Rotate** on
either while it runs to shift the relationship.

Full walkthrough: [Recipes → Euclidean rhythms](../recipes/euclidean.md).
