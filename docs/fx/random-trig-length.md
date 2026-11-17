# Random trig length

**Domain:** gate. Target**:** `GATE 1` … `GATE 8`.

Varies how long each trigger lasts.

---

## What it does to the signal

Each gate reaching the destination is given a randomly extended width. **Length range**
sets how much longer it can get:

- **Length range** `0` — every gate keeps its original length. No effect.
- **Length range** `127` — gates can be substantially longer than the original.

The extension is one-directional: gates get longer, never shorter than the
destination's own **Length** setting. That length is the floor.

**Velocity influence** links the amount of extension to the note's velocity, so harder
hits produce longer gates — or the reverse, depending on how it is applied.

`TODO(verify)`: the maximum extension in milliseconds at **Length range** `127`, and the
direction of **Velocity influence** — whether higher velocity means longer or shorter.
**Test:** set a Gate output to `Trigger` with **Length** `5 ms`, apply this FX slot
with **Length range** `127` and **Velocity influence** `0`, and measure the widest gate over fifty
hits on a scope. Then set **Velocity influence** `127` and compare gates at velocity 1
against velocity 127.

---

## What it needs to work

The official manual notes this works "only on trig in gates rows" — the
destination should be a Gate output in [Trigger](../modes/trig.md) mode.

For the variation to be audible, the thing you are patching into must care about
gate length. A drum module with a fixed decay will not notice; a VCA, an
envelope in sustain, or a module with a gate-length-dependent behaviour will.

If the destination's **Length** is set to `Latch`, gate width is determined by how
long the note is held and there is nothing fixed to extend.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Length range** — the editor says `range`
> - **Target** — the editor says `dest`
> - **Velocity influence** — the editor says **Velocity influence** `/ vel control`


| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Target** | `GATE 1` … `GATE 8` | `GATE 1` | |
| **Length range** | `0` … `127` | `63` | Maximum extension. `0` = no change |
| **Velocity influence** | `0` … `127` | `10` | How much velocity influences the length |

---

## What it's for

**Varying note lengths in a sequenced part, so it phrases instead of stuttering.**

- GATE 2: **Mode** `Trigger`, **Trigger source** `CV 2`, **Length** `20 ms`, **Level range** `10 V`
- FX 5: **FX type** `Random trig length`, **Target** `GATE 2`, **Length range** `60`, **Velocity influence** `90`

CV 2 plays a bassline and GATE 2 opens an envelope. Every note now holds for a
different length — and with **Velocity influence** high, the accented notes hold longest.
The part gains articulation that neither the sequencer nor the envelope was
providing.

Keep **Length range** moderate at fast tempos. A gate extended past the next step will
either merge with it or retrigger unpredictably, depending on the envelope you
are driving.
