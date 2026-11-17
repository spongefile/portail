# Chance

**Domain:** note. Target**:** `CV 1` … `CV 8`.

Decides whether a note plays at all.

The official manual's description of Chance is copied from
[Random octave](random-oct.md) and describes the wrong effect entirely — "Randomly
changes the octave of the note being played" — and then documents a `Range`
parameter that Chance does not have. See [audit §4](../audit.md). What follows is
derived from the editor's parameter tables.

---

## What it does to the signal

For each note reaching the destination, **Probability** decides whether it plays.
Notes that lose the roll are dropped entirely — no pitch change, no gate.

**Velocity influence** links the decision to velocity: with it raised, harder notes are more
likely to survive and softer notes more likely to be dropped.

This is the FX slot that thins a part out. Everything else on the note side
alters notes; Chance removes them.

---

## What it needs to work

The destination CV output must be in `Note`, `Arpeggiator`, `Sequencer` or `Random` mode.

Because dropped notes produce no gate, any Gate output whose **Trigger source** points at
this CV output goes quiet on the dropped notes too — which is what makes Chance
useful rhythmically rather than just melodically.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Probability** — the editor says `distribution`
> - **Target** — the editor says `dest`
> - **Velocity influence** — the editor says **Velocity influence** `/ vel control`


| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Target** | `CV 1` … `CV 8` | `CV 1` | |
| **Probability** | `0%` … `100%` | `10%` | Chance the note plays |
| **Velocity influence** | `0%` … `100%` | `10%` | How much velocity influences the decision |

`TODO(verify)`: the polarity of **Probability** — whether it is the chance a note
**plays** or the chance it is **dropped**. The default of `10%` is
suspiciously low for "chance it plays", which would silence nine notes in ten on
a freshly added FX slot. **Test:** add Chance with **Probability** `10%`,
**Velocity influence** `0%`, and play a steady stream of notes. If almost all of them sound,
the parameter is the chance of being dropped; if almost none do, it is the chance
of playing.

`TODO(verify)`: how **Velocity influence** combines with **Probability** — whether it scales
it, offsets it, or replaces it above a threshold. **Test:** set
**Probability** `50%`, **Velocity influence** `100%`, and play the same pitch at velocity 1 and
then at velocity 127, twenty times each. Compare how many sound.

---

## What it's for

**Thinning a busy pattern so it breathes.**

- CV 1: **Mode** `Sequencer`, **Channel** `ch 3`, **Clock division** `1/16`, **Steps** `16`
- GATE 1: **Mode** `Gate`, **Trigger source** `CV 1`
- FX 4: **FX type** `Chance`, **Target** `CV 1`, **Probability** `70%`, **Velocity influence** `0%`

A sixteenth-note sequence now drops roughly three notes in ten, differently each
bar. The gate follows, so the rests are real rests rather than held notes.

Raise **Velocity influence** and the pattern's own dynamics decide what survives — accented
steps stay, ghost notes come and go. That is a more musical thinning than a flat
probability, because it preserves the part's shape.
