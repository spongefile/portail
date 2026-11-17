# Repeats

**Domain:** gate. Target**:** `GATE 1` … `GATE 8`.

A ratchet engine: repeats a gate several times inside the space of one step.

---

## What it does to the signal

When a gate fires at the destination, Repeats retriggers it **Repeats** times, at
a rate set by **Amount** — a division of the master clock.

One hit becomes a burst. This is the roll or ratchet effect: a snare that fires
four times inside one sixteenth, a hat that doubles up.

The official manual describes **Amount** as "division of the clock" and **Repeats**
as "number of repeats", which is correct and is the clearest thing it says about
any gate FX slot.

`TODO(verify)`: whether every gate is ratcheted or only some, and whether the
repeats are squeezed into the original step's duration or simply run at
**Amount** until **Repeats** is exhausted — which at a slow **Amount** would overrun
into the next step. **Test:** set a Gate output to `Euclidean` at **Clock division** `1/4`,
apply Repeats with **Amount** set to a `1/8` equivalent and **Repeats** `4`, and watch
on a scope. If the four repeats span half a bar, they overrun; if they compress
into the quarter note, they are scaled to the step.

`TODO(verify)`: the unit of **Amount**. It is a `0`–`127` control rather than a
division menu, so the mapping from number to clock division is not visible.
**Test:** set **Repeats** `2` and step **Amount** through `0`, `32`, `64`, `96`, `127`,
measuring the gap between the two repeats each time.

---

## What it needs to work

The destination Gate output must be producing gates.

The downstream module must be able to retrigger fast enough. A drum module with a
long decay and no retrigger will merge the repeats into one sound.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Repeats** — the editor says `numbers`
> - **Target** — the editor says `dest`


| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Target** | `GATE 1` … `GATE 8` | `GATE 1` | |
| **Amount** | `0` … `127` | `2` | Rate of the repeats. Unit unverified |
| **Repeats** | `0` … `127` | `1` | How many repeats |

**The default **Repeats** is `1`,** which for most readings means no additional
hits. A freshly added Repeats may do nothing until you raise it.

---

## What it's for

**Snare rolls at the end of a phrase.**

- GATE 4: **Mode** `Trigger`, **Channel** `ch 10`, **Note** `D1`, **Length** `5 ms`,
  **Level range** `10 V` → snare
- FX 6: **FX type** `Repeats`, **Target** `GATE 4`, **Amount** `2`, **Repeats** `4`

Every snare hit becomes a four-stroke roll. Patch GATE 4 to a snare module.

The interesting version is dynamic: map **Repeats** to a CC through the
[CC map](../concepts.md#7-the-cc-map-controls-parameters-from-cc) with
**Low note** `1` and **High note** `8`. A knob on your controller now goes from single hits to dense
rolls while the pattern runs, which is a performance control you cannot easily get
any other way.

Combine with [Random velocity](random-vel.md) so the repeats within each burst vary in
level, which makes a roll sound played rather than machine-generated.
