# Random

**Available on:** CV outputs and Gate outputs, with substantially different
parameters on each.

Random generates new values on demand — either random voltages around a centre
pitch (CV), or random gates with a probability (Gate).

The two versions are different enough to be worth reading as separate modes.

---

## What comes out of the jack

**On a CV output:** a **new random pitch** each time it is triggered, centred on
**Base note** and spanning **Level range** semitones either side. The output holds between
triggers. With **Slew** above `OFF`, it glides to each new value instead of
jumping.

Because the output is pitch-shaped, Note FX work on it — putting
[Scale](../fx/scale.md) after a Random CV output is the standard way to
get random notes that are in key.

**On a Gate output:** a **random gate**. Each trigger, **Probability** decides
whether a gate fires at all, and **Random level** decides how much its height varies.
Gate width is set by **Length**.

---

## What MIDI drives it

Set by **Trigger source**, which here means *what causes a new value*:

- ****Trigger source** `= note`** — a note-on on the selected **Channel** generates a new
  value.
- ****Trigger source** `= clock`** — the master clock generates a new value every **Clock division**.

There are only these two. The official manual claims a third option, "from
another CV line", which does not exist in the editor. See
[audit §6](../audit.md).

With **Trigger source** `= note` on a CV output, the incoming note replaces **Base note** as
the centre — so the randomness follows what you play rather than sitting around a
fixed pitch.

---

## Parameters — CV output

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Clock division** — the editor says `div`
> - **Level range** — the editor says `range`
> - **Probability** — the editor says `distribution`
> - **Random level** — the editor says `rnd level`
> - **Slew** — the editor says **Slew** `/ smooth`
> - **Trigger source** — the editor says `source`


| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Channel** | `ch 1` … `ch 16` | `ch 1` | |
| **Trigger source** | `Note`, `Clock` | `Clock` | What triggers a new value |
| **Clock division** | `4/1` … `1/32`, triplets, dotted | `1/16` | Rate, when **Trigger source** `= clock` |
| **Base note** | `C-2` … `G8` | `C2` | Centre pitch. Ignored when **Trigger source** `= note` |
| **Level range** | `+/-1` … `+/-47` semitones | `+/-12` | Spread either side of centre |
| **Slew** | `OFF`, `1` … `100` | `OFF` | Glide between values |

## Parameters — Gate output

| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Channel** | `ch 1` … `ch 16` | `ch 1` | |
| **Trigger source** | `Note`, `Clock` | `Clock` | What triggers a new value |
| **Clock division** | `4/1` … `1/32`, triplets, dotted | `1/16` | Rate, when **Trigger source** `= clock` |
| **Length** | `Latch`, `1 ms` … `127 ms` | `6 ms` | Gate width |
| **Probability** | `0%` … `100%` | `11%` | Chance a gate fires |
| **Random level** | `0%` … `100%` | `0%` | How much gate height varies |
| **Level range** | `10 V` … `1 V` | `10 V` | Maximum gate height |
| **Slew** | `OFF`, `1` … `127` | `OFF` | Slew on the output |

**Probability** at `0%` produces nothing; at `100%` every trigger fires a gate,
which makes it a plain clock. The interesting territory is 20–70%.

**Random level** at `0%` gives every gate the full **Level range** height. Raise it and the
gates vary in amplitude, which — into a velocity-sensitive envelope or straight
into a VCA — reads as accents.

`TODO(verify)`: the editor's stored defaults for Gate Random cover only five of
its seven parameters, so **Level range** and **Slew** may initialise to something other
than the first menu entry. **Test:** set a Gate output to Random in the editor,
then click **request from portail** and read back what the module actually
holds.

---

## What it's for

**Random notes that stay in key.**

- CV 5: **Mode** `Random`, **Trigger source** `clock`, **Clock division** `1/8`, **Base note** `C2`,
  **Interval range** `+/-12`, **Slew** `OFF`.
- FX 1: **FX type** `Scale`, **Target** `CV 5`, **Scale** `pentatonic minor`, **Root note** `A`.

Patch CV 5 to pitch and a [Euclidean](euclidean.md) or Random gate to the
envelope. You get a generative line that never leaves A minor pentatonic. Raise
**Slew** for a slurred, portamento version.

**The gate version:** GATE 5 as `Random`, **Trigger source** `clock`, **Clock division** `1/16`,
**Probability** `35%`, `rnd level 40%`, **Length** `5 ms` gives sparse, accented hits —
a good ghost-note layer under a fixed drum pattern.
