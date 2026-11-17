# Invert

**Domain:** gate. Target**:** `GATE 1` … `GATE 8`.

Flips a gate: high becomes low, low becomes high.

The simplest FX slot on the module. It has one parameter.

---

## What it does to the signal

The destination output produces **Level range** volts whenever it would otherwise
produce 0 V, and 0 V whenever it would otherwise be high.

The consequence worth thinking about: an inverted output is **high most of the
time**, because gates are normally low most of the time. A `1/16` trigger pattern
with 5 ms pulses becomes a signal that sits at 10 V and dips briefly.

That is useful for anything that responds to a gate going low — a module with an
inverted or normally-high trigger input, a mute input, a hold input, or a VCA
you want to duck rather than open.

---

## What it needs to work

The destination Gate output must be producing gates.

Inverting a [Sequencer](../modes/seq.md) output set to `cc` type, or any output
producing a continuous voltage rather than gates, is not what this is for.

`TODO(verify)`: what Invert does to a continuous signal such as an
[LFO](../modes/lfo.md) on a Gate output — whether it mirrors the waveform around
the midpoint, or thresholds it into a square first. **Test:** set a Gate output
to `LFO`, **Waveform** `triangle`, **Level range** `10 V`, apply Invert, and watch on a scope.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Target** — the editor says `dest`


| Parameter | Values | Default |
|---|---|---|
| **Target** | `GATE 1` … `GATE 8` | `GATE 1` |

That is all of them.

---

## What it's for

**Ducking.** Sidechain-style level dips, without a sidechain compressor.

- GATE 1: **Mode** `Trigger`, **Channel** `ch 10`, **Note** `C1`, **Length** `80 ms`,
  **Level range** `10 V` → follows the kick
- FX 1: **FX type** `Invert`, **Target** `GATE 1`

GATE 1 now sits at 10 V and drops to 0 V for 80 ms on every kick. Patch it to a
VCA carrying a pad or a bassline: the pad plays at full level and ducks out of
the way each time the kick lands.

Add a little **Fall** on the Gate output — or use [Envelope](../modes/env.md) with
**Shape** `ad` instead of Trigger — to make the duck a smooth dip rather than a hard
step.

**A second use:** feed an inverted gate to a module with a normally-high input,
such as a mute or a hold, where the module expects a gate to *stop* something.
