# Pitch bend

**Available on:** CV outputs and Gate outputs.

Pitch bend converts the pitch bend wheel into a voltage you can patch anywhere. This is
separate from the **Bend range** parameter on [Note](note.md), which applies bend to
that output's pitch directly.

Use Note's **Bend range** when you want the wheel to bend the pitch. Use Pitch bend mode when
you want the wheel as a general-purpose bipolar controller.

---

## What comes out of the jack

A **bipolar voltage following the pitch bend wheel**.

- Wheel fully down → the negative extreme.
- Wheel centred → 0 V.
- Wheel fully up → **Level range**.

Pitch bend is a 14-bit message, so this output is smooth — far smoother than a
7-bit [MIDI CC](cc.md). That makes Pitch bend the best choice on Portail for anything where
stepping would be audible.

On a CV output with **Level range** `= +/-5 V`, the wheel gives you −5 V to +5 V through
zero. On a Gate output the negative half cannot be produced, so the useful travel
is centre-to-up only.

`TODO(verify)`: what a Gate output does with the downward half of the wheel —
whether it clamps at 0 V or rescales the full wheel travel into 0 V…**Level range**.
**Test:** set a Gate output to Pitch bend with **Level range** `10 V`, measure the jack with the
wheel centred, then fully down. If centre reads 5 V, the travel is rescaled; if
it reads 0 V, the negative half is clamped.

---

## What MIDI drives it

**Pitch bend messages** on the selected **Channel**.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Level range** — the editor says `range`
> - **Slew** — the editor says **Slew** `/ smooth`



| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Channel** | `ch 1` … `ch 16` | `ch 1` | |
| **Level range** | CV: `+/-5 V`, `10 V` … `1 V`, `-1 V` … `-5 V`<br/>Gate: `10 V` … `1 V` | CV: `+/-5 V`<br/>Gate: `10 V` | Voltage at full up-bend |
| **Slew** | CV: `OFF`, `1` … `127`<br/>Gate: `OFF`, `1` … `100` | `OFF` | Slew. Usually leave `OFF` |

Leave **Slew** at `OFF` unless you specifically want lag. Pitch bend is already
high resolution and filtering it only adds latency.

---

## What it's for

**A bipolar hand controller for something that is not pitch.**

- CV 6: **Mode** `Pitch bend`, **Channel** `ch 1`, **Level range** `+/-5 V`, **Slew** `OFF`.

Patch CV 6 into a stereo panner's CV input, or an oscillator's FM index, or a
wavefolder. The wheel springs back to centre, so you get a control that returns
to a known neutral when you let go — something no CC-based control gives you
without extra work.

The other use: keep Note's **Bend range** at `+/-2` for conventional bending, and
*also* run a Pitch bend output into a filter, so the wheel bends the pitch and opens the
filter together.
