# eowave Portail — Microtonal Tuning Tables

**Spec version:** 1.0.0
**Source:** firmware disassembly (`usb-cv_3.uf2`, v0.83r); reproduced by `research/fw-analyse.py`.
**Companion data:** `model.json → microtonal_tables`.

Tags: **[confirmed from firmware]**, **[inferred]**, **[unknown]**.

---

## Headline

**The 8 factory microtonal tables are all identical: standard 12-TET.** [confirmed from firmware]

There are **no exotic factory tunings** shipped on the module. The 8 tables are user-customisable
slots, and their factory/reset default is plain equal temperament (100 cents per semitone). That is
why the editor lists them as bare "table 1…8" with no names — there is nothing pre-loaded to name.

So the editor should present them as **8 user tuning slots**, defaulting to "12-TET (default)", not as
a menu of named historical temperaments. Any distinctive tuning is whatever the *user* has stored on
their own module (which lives in the module's flash, not in the firmware image, so we cannot read it
statically).

## Format [confirmed from firmware]

| Property | Value |
|---|---|
| Count | 8 tables |
| Definition | **12 values, one per pitch class** (C, C#, … B), 14-bit each |
| Unit | **cents** (0–16383; a value is cents relative to the pitch class's nominal position) |
| Expansion | per note: `note_cents = (note / 12) × 1200 + template[note mod 12]` |
| Runtime storage | 128 notes × 14-bit per table (expanded from the 12-value template) |
| Persistent storage | **device flash** — **not** in the `.uf2` image, so a user's customised tables can only be read off hardware |
| Wire write | SysEx opcode `0x24` — **a memory-safety defect, on the never-send list** ([`protocol.md` §9.8](protocol.md#98-three-memory-safety-defects--opcodes-22-0x16-31-0x1f-36-0x24)) |

**Scaling anchor.** The 12-TET table decodes to even 100-cent steps (`template = [0, 100, 200, …,
1100]`), and the octave term is exactly `1200` cents (`q × 75 × 16`). That fixes the unit as **cents**
beyond doubt: a semitone is 100, an octave is 1200. The final DAC value is
`mul × (cents / 100)` — i.e. `cents/100` = semitones, scaled by a per-module V/oct calibration
constant `mul` ([inferred] `mul` = DAC codes per semitone; it is a per-module calibration value).

## The factory tables, decoded [confirmed from firmware]

The firmware's factory generator (run on factory reset / first boot) writes, for **every** table
`t ∈ 0..7` and **every** note `n ∈ 0..127`:

```
value(t, n) = n × 100          # cents; identical for all 8 tables
```

Which is the 12-TET template for all eight:

| Pitch class | C | C# | D | D# | E | F | F# | G | G# | A | A# | B |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Cents (all 8 tables)** | 0 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 1000 | 1100 |
| **Deviation from 12-TET** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

There is nothing to distinguish table 1 from table 8 at the factory — they are byte-for-byte the same
12-TET template.

## What this means

- **Editor:** label the 8 slots as user tuning tables, default "12-TET". Do **not** invent names like
  "Pythagorean" / "meantone" — the firmware ships none. The editor's **Tuning tab** authors them as
  12 cent values (one per pitch class), matching the 12-value wire format, and can import a Scala
  `.scl` file.
- **Manual:** describe the 8 tables as customisable equal-temperament-by-default slots, edited in the
  Tuning tab.
- **The tuning editor writes safely by self-bounding the slot** — see the safety note below.

## ⚠ Safety: the tuning editor self-bounds the slot

**[confirmed from firmware]** The SysEx opcode that writes a tuning table (`0x24`) is one of three
memory-safety defects in the firmware — an out-of-bounds RAM write from an unchecked table slot. The
**firmware still does not bound the slot**, so the defect is real and the disclosure stands
([`protocol.md` §9.8](protocol.md#98-three-memory-safety-defects--opcodes-22-0x16-31-0x1f-36-0x24)).

The **replacement editor writes `0x24` safely**: the table slot is the sole address input to the
write, so the editor **rejects any slot outside 0–7** (it never clamps or wraps), which makes an
out-of-range write unrepresentable from the app while keeping every legitimate write in bounds. A
tuning editor is therefore available and safe against *this* app, even though the underlying firmware
bug is unfixed.

Like the other two defects it is RAM-only — it cannot write code flash or brick the module (see
[`protocol.md` §0.9](protocol.md#09-safety-model--can-the-module-be-bricked-over-midi)) — and it was
**reported privately to eowave (2026-08-26)** before this repo was made public. The technical
detail is withheld here; see [`SECURITY.md`](../SECURITY.md).

## Confidence

| Claim | Tag |
|---|---|
| Format: 8 tables, 12 pitch-class values, 14-bit, unit = cents | confirmed from firmware |
| Expansion `octave×1200 + template[pc]` | confirmed from firmware |
| All 8 factory tables = identical 12-TET | confirmed from firmware |
| Persistent storage in device flash (not in image) | confirmed from firmware |
| Opcode `0x24` (table writer) is a memory-safety defect | confirmed from firmware |
| `mul` = per-module V/oct calibration (DAC codes/semitone) | inferred |
| Contents of a *user-customised* module's tables | unknown (device flash, not in image) |
