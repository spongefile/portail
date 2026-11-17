# Note filter

**Domain:** note. Target**:** `CV 1` … `CV 8`.

Ignores notes outside a pitch range.

---

## What it does to the signal

Notes below **Lowest note** or above **Highest note** are dropped before they reach the
destination output. Notes inside the range pass through unchanged.

Because it drops notes rather than clamping them, a filtered note produces no
pitch change and no gate on outputs following that destination — it is as though
the note was never played.

---

## What it needs to work

The destination CV output must be in a note-handling mode: `Note`, `Arpeggiator`, `Sequencer`
or `Random`.

Note that [Note](../modes/note.md) mode already has **Low note** and **High note** parameters
that do the same job. Use those when you just want a keyboard split; use this
FX slot when you need the filtering to happen at a specific point in a chain —
for example *after* [Random octave](random-oct.md), to catch notes that randomisation
has thrown out of range.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Highest note** — the editor says `higher`
> - **Lowest note** — the editor says `lower`
> - **Target** — the editor says `dest`


| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Target** | `CV 1` … `CV 8` | `CV 1` | |
| **Lowest note** | `C-2` … `G8` | `C-2` | Lowest note that passes |
| **Highest note** | `C-2` … `G8` | `G8` | Highest note that passes |

Defaults pass everything, so a freshly added Note filter does nothing until you
move one of the two.

`TODO(verify)`: what happens if **Lowest note** is set above **Highest note**. **Test:** set
**Lowest note** `G8` and **Highest note** `C-2` and play across the keyboard. Either nothing passes,
or the filter inverts into a band-reject.

---

## What it's for

**Catching strays after randomisation.**

- FX 1: **FX type** `Random octave`, **Target** `CV 1`, **Level range** `2`, **Probability** `40%`
- FX 2: **FX type** `Note filter`, **Target** `CV 1`, **Lowest note** `C1`, **Highest note** `C5`

Random octave can throw notes two octaves in either direction, which on a bassline
means occasional notes far below what your oscillator tracks usefully. Note
FILTER in the later slot removes them, so the part stays in a sensible register
and the strays become rests rather than rumbles.

**The simpler use:** a keyboard split without spending a mode parameter — set
**Lowest note** `C3` on the FX slot for a lead zone, leaving [Note](../modes/note.md)'s
own **Low note**/**High note** free for something else.
