# Aftertouch

**Available on:** CV outputs and Gate outputs.

AT converts channel (monophonic) aftertouch into a voltage. Aftertouch is the
pressure you apply *after* a key is down, and channel aftertouch reports a single
pressure value for the whole keyboard.

For per-note pressure, see [Poly aftertouch](poly-at.md).

---

## What comes out of the jack

A **continuous voltage proportional to channel pressure**.

- Pressure 0 → 0 V.
- Pressure 127 → **Level range**.
- The voltage follows pressure continuously while you press, and returns to 0 V
  when you release, because most keyboards send pressure 0 on release.

With **Slew** above `OFF`, the output slews, which smooths the sometimes-jumpy
pressure data most keybeds produce.

---

## What MIDI drives it

**Channel pressure messages** on the selected **Channel**. Nothing else.

Many controllers do not send aftertouch at all, and many that do have it disabled
by default. If this output never moves, check your keyboard first — see
[Troubleshooting](../troubleshooting.md#an-aftertouch-output-never-moves).

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Level range** — the editor says `range`
> - **Slew** — the editor says **Slew** `/ smooth`



| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Channel** | `ch 1` … `ch 16` | `ch 1` | |
| **Level range** | CV: `+/-5 V`, `10 V` … `1 V`, `-1 V` … `-5 V`<br/>Gate: `10 V` … `1 V` | CV: `+/-5 V`<br/>Gate: `10 V` | Voltage at full pressure |
| **Slew** | CV: `OFF`, `1` … `127`<br/>Gate: `OFF`, `1` … `100` | `OFF` | Slew. Higher is slower |

The **Slew** range genuinely differs between banks — `1`–`127` on a CV output and
`1`–`100` on a Gate output. This is an inconsistency in the firmware's parameter
tables, not a documentation error, and it is harmless; the extra range simply
allows slightly more slew on CV.

---

## What it's for

**Pressure into filter cutoff or vibrato depth**, the classic expressive
mapping.

- CV 4: **Mode** `Aftertouch`, **Channel** `ch 1`, **Level range** `5 V`, **Slew** `15`.

Patch CV 4 to your filter's cutoff CV input, attenuated to taste. Press harder
into held notes and the sound opens up. The **Slew** setting stops the pressure
sensor's noise from making the cutoff jitter.

A second use: patch AT to a VCA controlling an LFO's output level, and you get
pressure-controlled vibrato without using CC#1.
