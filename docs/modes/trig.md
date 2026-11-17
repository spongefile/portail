# Trigger

**Available on:** CV outputs and Gate outputs.

Trigger produces a short pulse of a fixed length, optionally from one specific MIDI
note. It is the drum-trigger mode.

The difference from [Gate](gate.md): a gate lasts as long as the key is held; a
trig lasts as long as **Length** says, regardless. And Trigger can filter to a single
note, so one MIDI channel of drums can be split across eight outputs.

---

## What comes out of the jack

A **pulse** that rises when a matching note arrives and falls after **Length**.

- High level = **Level range**.
- Low level = **Level min**, default 0 V. This is not necessarily 0 V — see below.
- With **Length** `= latch`, it stops being a pulse and behaves like a gate: high
  while the note is held.
- With **Velocity sensitive** on, the high level is scaled by velocity between **Level min**
  and **Level range**, not between 0 V and **Level range**.

On a CV output, **Level range** can be negative, so a Trigger can be a downward pulse.

### The velocity scaling, precisely

With **Velocity sensitive** `on`, **Level min** `= 2 V`, **Level range** `= 5 V`:

| Velocity | Output |
|---|---|
| 127 | 5 V |
| 64 | about 3.5 V |
| 1 | just above 2 V |

The pulse never falls below **Level min** during its high phase. This two-point
scaling is what Trigger has and Gate does not.

---

## What MIDI drives it

- **Note-on** on the selected **Channel**, filtered by `Note`.
- If **Note** `= all`, every note-on fires the trig.
- If `Note` is set to a specific pitch, only that pitch fires it.
- On a Gate output, **Trigger source** can instead point at a CV output, in which case the
  trig fires whenever that CV output takes a new note.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Level min** — the editor says `minimum`
> - **Level range** — the editor says `range`
> - **Trigger source** — the editor says `source`
> - **Velocity sensitive** — the editor says `vel sens`


| Parameter | Values | Default | Bank |
|---|---|---|---|
| **Channel** | `ch 1` … `ch 16` | `ch 1` | both |
| **Trigger source** | `Note`, `CV 1` … `CV 8` | `Note` | **Gate only** |
| `Note` | `all`, then `C#-2` … `G8` | `all` | both |
| **Length** | `Latch`, then `1 ms` … `127 ms` | `Latch` | both |
| **Velocity sensitive** | `Off`, `On` | `Off` | both |
| **Level min** | `0 V` … `9 V`, in 1 V steps | `0 V` | both |
| **Level range** | CV: `+/-5 V`, `10 V` … `1 V`, `-1 V` … `-5 V`<br/>Gate: `10 V` … `1 V` | CV: `+/-5 V`<br/>Gate: `10 V` | both |

The official manual names **Level min** and **Level range** inconsistently — its parameter
list calls them "Val min" and "Val max", its headings call them "Minimum" and
"Range". They are one pair of controls. See [audit §7](../audit.md).

### `Note`

`all` is index 0 in the list; the pitch options start at `C#-2`. There is no way
to select `C-2` as a specific trigger note, because that slot is taken by `all`.
If you need `C-2` specifically, transpose your source or use **Low note**/**High note** on a
[Note](note.md) output instead.

### Length

- **`Latch`** — behaves as a gate, high while the note is held.
- **`1 ms` … `127 ms`** — a fixed pulse.

Most Eurorack trigger inputs want somewhere between 1 ms and 10 ms. If a module
is not firing, the pulse is probably too short for it; try 5 ms, then 10 ms.
Anything above about 20 ms starts to matter musically at fast tempos, because a
50 ms trig at 1/32 notes will still be high when the next one arrives.

---

## What it's for

**Drum triggers from a groovebox or DAW.** One MIDI channel carrying General
MIDI drums, split across four Gate outputs.

- GATE 1: **Mode** `Trigger`, **Channel** `ch 10`, **Trigger source** `note`, **Note** `C1`, **Length** `5 ms`,
  **Level range** `10 V` → kick
- GATE 2: same but **Note** `D1` → snare
- GATE 3: same but **Note** `F#1` → closed hat
- GATE 4: same but **Note** `A#1` → open hat

Patch each to a drum module's trigger input. Every output ignores the notes meant
for the others.

Turn **Velocity sensitive** `on` with **Level min** `2 V` on the hats and the accents come through as
level differences, which most analogue drum modules respond to.

Full walkthrough: [Recipes → drum triggers](../recipes/drum-triggers.md).
