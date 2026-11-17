# Humanize

**Domain:** gate. Target**:** `GATE 1` … `GATE 8`.

Delays each gate by a small random amount, so a machine-timed part stops sounding
machine-timed.

The official manual's definition of the `Amount` parameter is the incomplete
sentence "set the amount of". See [audit §5](../audit.md).

---

## What it does to the signal

Each gate event reaching the destination is delayed by a randomly chosen amount,
scaled by **Amount**. Every gate gets a different offset, which is the difference
from [Delay](delay.md), where every gate is offset by the same fixed time.

At **Amount** `0%` there is no displacement. Raising it widens the spread of possible
delays.

`TODO(verify)`: the maximum delay in milliseconds at **Amount** `100%`, and whether
the displacement is late-only or spread either side of the beat. Early
displacement would require Portail to know about a gate before it happens, which
is impossible for live MIDI, so late-only is likely — but a clocked source such
as [Euclidean](../modes/euclidean.md) is predictable in advance, so it could go
either way there. **Test:** set **Amount** `100%` on a Euclidean output at
**Clock division** `1/4` and record its output against an undelayed clock. Measure the earliest
and latest offsets over fifty hits.

---

## What it needs to work

The destination Gate output must be producing gates.

Most valuable on outputs driven by the master clock —
[Euclidean](../modes/euclidean.md), [Sequencer](../modes/seq.md),
[Clock](../modes/clock.md) — because those are perfectly quantised and therefore
the most obviously mechanical.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Target** — the editor says `dest`


| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Target** | `GATE 1` … `GATE 8` | `GATE 1` | |
| **Amount** | `0%` … `100%` | `10%` | Spread of random delay |

---

## What it's for

**Loosening a Euclidean hat pattern.**

- GATE 6: **Mode** `Euclidean`, **Clock division** `1/16`, **Steps** `16`, **Fills** `7`, **Gate length** `5 ms`
- FX 2: **FX type** `Humanize`, **Target** `GATE 6`, **Amount** `15%`

The pattern keeps its shape but stops landing exactly on the grid, which is the
difference between a hat part that sits in a track and one that fights it.

Keep **Amount** low. Above about 30% the displacement becomes large enough to read
as sloppy rather than human, and at fast divisions it can push a gate past the
next step.

**Do not humanize the clock output** that drives your other modules — a
sequencer fed a jittering clock will drift against everything else. Humanize the
parts, not the timebase.
