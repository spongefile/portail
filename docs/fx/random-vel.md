# Random velocity

**Domain:** gate. Target**:** `GATE 1` … `GATE 8`.

Varies the level of a gate, so repeated hits are not all identical.

---

## What it does to the signal

Generates a random velocity value up to **Velocity range**, and combines it with the gate's
existing velocity according to **Blend**:

| **Blend** | Result |
|---|---|
| `Added` | Random value is added to the original velocity |
| `Subtracted` | Random value is subtracted from the original velocity |
| `Replaced` | Original velocity is discarded; the random value is used |

`Added` and `Subtracted` preserve the part's dynamics and vary around them.
`Replaced` throws the dynamics away, which is what you want when the source has
no meaningful velocity — a [Euclidean](../modes/euclidean.md) or
[Clock](../modes/clock.md) output, where every hit is otherwise identical.

The editor spells the second option `Subtracted`. That is the on-screen string.

**This only produces an audible result if the destination is velocity-sensitive.**
On a [Gate](../modes/gate.md) or [Trigger](../modes/trig.md) output, that means
**Velocity sensitive** must be `On`. Otherwise the gate has a fixed height and varying its
velocity changes nothing at the jack.

---

## What it needs to work

- The destination Gate output must be producing gates.
- For the variation to reach the jack, the destination needs **Velocity sensitive** `on`
  ([Gate](../modes/gate.md), [Trigger](../modes/trig.md)) or must otherwise respond
  to velocity.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Blend** — the editor says `type`
> - **Target** — the editor says `dest`
> - **Velocity range** — the editor says `range`


| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Target** | `GATE 1` … `GATE 8` | `GATE 1` | |
| **Velocity range** | `0` … `127` | `63` | Maximum random velocity generated |
| **Blend** | `Added`, `Subtracted`, `Replaced` | `Added` | How it combines |

`TODO(verify)`: whether `Added` clips at 127 or wraps. **Test:** play notes at
velocity 120 with **Blend** `added` and **Velocity range** `127`, and listen for hits that come out
quiet — wrapping would produce occasional very soft hits among loud ones.

---

## What it's for

**Giving a Euclidean hat pattern accents it does not have.**

- GATE 6: **Mode** `Euclidean`, **Clock division** `1/16`, **Steps** `16`, **Fills** `7`,
  **Gate length** `5 ms`, **Level range** `10 V`
- FX 4: **FX type** `Random velocity`, **Target** `GATE 6`, **Velocity range** `90`, **Blend** `replaced`

Every hat hit now has a different level. Patch GATE 6 into a hat module's
velocity or accent input, or into a VCA in the hat's signal path, and the pattern
gains a dynamic shape that changes bar to bar.

`Replaced` is the right choice here because a Euclidean output has no dynamics of
its own to preserve.

**On a played part**, use `Added` or `Subtracted` with a small **Velocity range** — 20 to
40 — so your own playing still comes through and the randomness only softens the
edges. Combine with [Humanize](humanize.md) for variation in both time and level.
