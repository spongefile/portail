# Delay

**Domain:** gate. Target**:** `GATE 1` … `GATE 8`.

Delays a gate by a fixed time.

The official manual's description of Delay is copied from another FX slot —
"Randomly add a note interval to the note being played" — and describes the wrong
effect. Its `Amount` parameter is documented correctly. See
[audit §4](../audit.md).

---

## What it does to the signal

Every gate event reaching the destination is held back by **Amount**
milliseconds. The gate's width is unchanged; only its start moves.

The delay is fixed, not random. For a random delay, use
[Humanize](humanize.md).

`TODO(verify)`: whether the note-off is delayed by the same amount, preserving
gate width, or only the note-on is delayed, shortening the gate. **Test:** set a
Gate output to `Gate` mode with **Trigger source** `note`, add Delay with **Amount** around
500 ms, hold a key for exactly two seconds, and measure the gate width on a
scope. If it is two seconds, both edges are delayed; if it is 1.5 seconds, only
the start is.

---

## What it needs to work

The destination Gate output must be producing gates — `Gate`, `Trigger`, `Envelope`,
`Sequencer`, `Random` or `Euclidean` mode.

The official manual notes it applies to "Gate, Trig, env".

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Target** — the editor says `dest`


| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Target** | `GATE 1` … `GATE 8` | `GATE 1` | |
| **Amount** | `0 ms` … `1041 ms`, in steps of about 8.2 ms | `82 ms` | Delay time |

The list has 128 entries covering 0 to 1041 ms, so the resolution is roughly
8 ms per step. Fine for feel, too coarse for sample-accurate work.

---

## What it's for

**Making a layered drum sound flam instead of hitting flat.**

- GATE 1: **Mode** `Trigger`, **Channel** `ch 10`, **Note** `C1`, **Length** `5 ms` → main drum
- GATE 2: **Mode** `Trigger`, **Channel** `ch 10`, **Note** `C1`, **Length** `5 ms` → layer
- FX 1: **FX type** `Delay`, **Target** `GATE 2`, **Amount** `25 ms`

Both outputs fire from the same MIDI note, but GATE 2 lands 25 ms later. Patch
them to two different drum modules and you get a flam that no amount of MIDI
editing gives you as easily.

**A second use:** delay an entire sequenced part by a fixed amount to sit it
behind the beat. 20–60 ms is the range where a part starts to feel laid back
without sounding wrong.
