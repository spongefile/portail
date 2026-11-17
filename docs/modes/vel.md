# Velocity

**Available on:** CV outputs and Gate outputs.

Velocity turns note velocity into a voltage that holds between notes. It is how you
get dynamics as a separate, patchable signal.

---

## What comes out of the jack

A **stepped voltage proportional to the velocity of the most recent note**.

- Velocity 0 → 0 V.
- Velocity 127 → **Level range**.
- The voltage is set at note-on and **holds** until the next note. It does not
  fall at note-off.

That holding behaviour is the difference between Velocity and a velocity-sensitive
[Gate](gate.md). A velocity-sensitive gate gives you a signal that is high only
while the note sounds; Velocity gives you a level that persists, suitable for
modulating something that should stay changed until the next note.

---

## What MIDI drives it

Depends on **Trigger source**:

- ****Trigger source** `= note`** — the velocity of any note-on on the selected **Channel**.
- ****Trigger source** `= CV 1` … `CV 8`** — the velocity of the note currently assigned to
  that CV output. In a polyphonic group, this is what gives each voice its own
  velocity.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Level range** — the editor says `range`
> - **Trigger source** — the editor says `source`


| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Channel** | `ch 1` … `ch 16` | `ch 1` | Hidden when **Trigger source** is a CV output |
| **Trigger source** | `Note`, `CV 1` … `CV 8` | `CV 1` | Whose velocity to follow |
| **Level range** | CV: `+/-5 V`, `10 V` … `1 V`, `-1 V` … `-5 V`<br/>Gate: `10 V` … `1 V` | `10 V` | Voltage at velocity 127 |

Note the default **Trigger source** is `CV 1`, not `Note`. If you set a Velocity output and
nothing happens, check whether it is waiting on a CV output that is set to `OFF`.

There is no **Slew** on Velocity, so the output steps. If you need it smoothed, that
is what [MIDI CC](cc.md) mode's filter is for, or slew it externally.

---

## What it's for

**Per-voice dynamics in a polyphonic patch.** With CV 1–3 in a poly group:

- GATE 4: **Mode** `Velocity`, **Trigger source** `CV 1`, **Level range** `10 V`
- GATE 5: **Mode** `Velocity`, **Trigger source** `CV 2`, **Level range** `10 V`
- GATE 6: **Mode** `Velocity`, **Trigger source** `CV 3`, **Level range** `10 V`

Each output carries the velocity of its own voice. Patch each into the CV input
of that voice's VCA, or into a filter's cutoff CV for velocity-to-brightness.

**The simpler one-cable alternative:** if all you want is dynamics into a VCA and
you do not need the level to hold between notes, use [Gate](gate.md) with
**Velocity sensitive** `on` instead — one cable does gate and dynamics together. See
[Recipes → velocity to VCA](../recipes/velocity-vca.md).
