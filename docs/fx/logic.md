# Logic

**Domain:** gate. Target**:** `GATE 1` … `GATE 8`.

Combines two gates with a boolean function.

The official manual's one-line description of Logic is copied from another
FX slot and describes the wrong effect. Its function table is correct, apart
from naming XNOR "XNOT". See [audit §4](../audit.md).

---

## What it does to the signal

Takes the destination gate and the **Operand** gate, applies **Function**, and
**replaces the destination's output with the result**.

The destination is both an input and the output. **Operand** is read but not
changed — that output continues to produce its own signal normally.

| **Function** | Output is high when |
|---|---|
| `AND` | Both dest and modulator are high |
| `OR` | Either is high |
| `NAND` | Not both are high |
| `NOR` | Neither is high |
| `XOR` | Exactly one is high |
| `XNOR` | Both are the same — both high or both low |
| `NOT` | The input is low. Ignores **Operand** |

`NAND`, `NOR` and `XNOR` are high most of the time, because "neither" and "the
same" are common states. If you patch one and get a nearly continuous voltage,
that is why — they are more useful as a way of generating *gaps* than hits.

---

## What it needs to work

Both the destination and the modulator must be Gate outputs producing gates.
Setting either to `OFF` gives you a constant.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Operand** — the editor says `modulator`
> - **Target** — the editor says `dest`


| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Target** | `GATE 1` … `GATE 8` | `GATE 1` | Input **and** output |
| **Function** | `AND`, `OR`, `NAND`, `NOR`, `XOR`, `XNOR`, `NOT` | `AND` | |
| **Operand** | `GATE 1` … `GATE 8` | `GATE 1` | The second input |

**The defaults set both **Target** and **Operand** to `GATE 1`.** A gate ANDed with
itself is itself, so a freshly added Logic does nothing until you point
**Operand** somewhere else.

`TODO(verify)`: what happens if **Target** and **Operand** are the same output with
a function other than `AND` — `XOR` with itself is always low, `NAND` always the
inverse. **Test:** set both to `GATE 1` with **Function** `XOR` and measure. If the
output is dead, self-reference is evaluated literally.

`TODO(verify)`: the output voltage of a Logic result — whether it uses the
destination's **Level range** or a fixed level. **Test:** set the destination's **Level range**
to `5 V`, apply Logic, and measure the high level.

---

## What it's for

**Deriving a third rhythm from two you already have.**

- GATE 5: **Mode** `Euclidean`, **Clock division** `1/16`, **Steps** `16`, **Fills** `4` → kick
- GATE 6: **Mode** `Euclidean`, **Clock division** `1/16`, **Steps** `16`, **Fills** `7` → hats
- GATE 7: **Mode** `Euclidean`, **Clock division** `1/16`, **Steps** `16`, **Fills** `7`, **Rotate** `0`
- FX 3: **FX type** `Logic`, **Target** `GATE 7`, **Function** `AND`, **Operand** `GATE 5`

GATE 7 now fires only where the hat pattern and the kick pattern coincide — a
sparse accent line that is rhythmically related to both and identical to neither.
Patch it to a clap or a snare.

Swap to `XOR` and GATE 7 fires where exactly one of them hits, which gives you
the inverse: a part that fills the gaps rather than reinforcing the hits.

Change **Rotate** on GATE 7 while it runs and the derived pattern shifts with it.
