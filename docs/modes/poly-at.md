# Poly aftertouch

**Available on:** CV outputs and Gate outputs.

Poly aftertouch converts the pressure applied to **one specific key** into a voltage.
Unlike [Aftertouch](at.md), which reports one pressure for the whole keyboard,
polyphonic aftertouch reports a separate pressure per note.

---

## What comes out of the jack

A **continuous voltage proportional to the pressure on one chosen note**.

- Pressure 0 → 0 V.
- Pressure 127 → **Level range**.
- Pressure messages for any other note are ignored by this output.

With **Slew** above `OFF`, the output slews.

---

## What MIDI drives it

**Polyphonic key pressure messages** on the selected **Channel**, whose note
number matches **Note**.

Polyphonic aftertouch is rare. Most keyboards do not send it; a handful of
modern controllers and MPE instruments do. If you are not sure whether yours
does, [Aftertouch](at.md) is the one that is far more likely to work.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Level range** — the editor says `range`
> - **Slew** — the editor says **Slew** `/ smooth`



| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Channel** | `ch 1` … `ch 16` | `ch 1` | |
| **Note** | `C-2` … `G8` | `C1` | **Which note number to track** |
| **Level range** | CV: `+/-5 V`, `10 V` … `1 V`, `-1 V` … `-5 V`<br/>Gate: `10 V` … `1 V` | `10 V` | Voltage at full pressure |
| **Slew** | CV: `OFF`, `1` … `127`<br/>Gate: `OFF`, `1` … `100` | `OFF` | Slew. Higher is slower |

### Note means something different here

On [Gate](gate.md), [Trigger](trig.md), [Velocity](vel.md) and [Envelope](env.md), **Note**
selects a CV output to follow. On Poly aftertouch it selects **a MIDI note number**.
There is no option to follow a CV output.

That means Poly aftertouch is tied to a fixed pitch, not to a voice. In a polyphonic
patch, a Poly aftertouch output tracks whichever voice happens to be playing that note,
not a particular voice. See [unverified.md](../unverified.md).

---

## What it's for

**Per-key pressure on a drone or pad note.** Set **Note** to the note you hold
down as a drone, and its pressure becomes a modulation source that the other
notes you play do not disturb.

- CV 5: **Mode** `Poly aftertouch`, **Channel** `ch 1`, **Trigger source** `C2`, **Level range** `5 V`, **Slew** `20`.

Hold C2, play a melody above it, and press into the C2 key: only C2's pressure
moves CV 5. Patch it to a wavefolder or a resonance input for a hand-controlled
swell that plays independently of the melody.
