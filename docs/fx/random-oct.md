# Random octave

**Domain:** note. Target**:** `CV 1` … `CV 8`.

Sometimes moves a note to a different octave.

---

## What it does to the signal

For each note reaching the destination, **Probability** decides whether to
displace it. If it fires, the note jumps up or down by a random number of
octaves, up to **Octave range**. The pitch class is unchanged — a C stays a C.

Notes that are not displaced pass through untouched. Nothing is dropped, so the
rhythm is unaffected.

Because the pitch class never changes, Random octave is safe to use with
[Scale](scale.md) in either order — an octave displacement cannot take a note out
of a scale.

---

## What it needs to work

The destination CV output must be in `Note`, `Arpeggiator`, `Sequencer` or `Random` mode.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Octave range** — the editor says `range`
> - **Probability** — the editor says `distribution`
> - **Target** — the editor says `dest`


| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Target** | `CV 1` … `CV 8` | `CV 1` | |
| **Octave range** | `0`, `1`, `2`, `3`, `4` | `1` | Maximum octaves of displacement |
| **Probability** | `0%` … `100%` | `0%` | How often a note is displaced |

The editor labels the second parameter **Probability**; the official manual calls
it "Probability", which is clearer. It is a percentage chance per note.

**The default **Probability** is `0%`,** so a freshly added Random octave does
nothing until you raise it.

**Octave range** `0` also does nothing regardless of **Probability**.

`TODO(verify)`: whether displacement is symmetric — up and down with equal
likelihood — or upward only. **Test:** set **Octave range** `1`, **Probability** `100%`, play
a single repeated note, and watch the output pitch over twenty notes. If it only
ever goes up, it is asymmetric.

---

## What it's for

**Stopping a repetitive sequence from sounding mechanical.**

- FX 2: **FX type** `Random octave`, **Target** `CV 2`, **Octave range** `1`, **Probability** `25%`

A one-bar bassline now throws about one note in four an octave away. The line is
recognisably the same but stops being a loop you can predict. At **Octave range** `1` the
displacement stays musical; at `3` or `4` it becomes a texture rather than a
part.

Pair with [Note filter](note-filter.md) in a later slot to catch notes thrown
below your oscillator's useful range — see that page for the chain.
