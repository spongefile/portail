# Gate

**Available on:** Gate outputs only.

Gate produces a sustained voltage for as long as a note is held. It is the
companion to [Note](note.md): Note gives pitch, Gate says when.

---

## What comes out of the jack

A **positive voltage that goes high on note-on and low on note-off**.

- High level = **Level range**, default 10 V.
- Low level = 0 V.
- With **Velocity sensitive** on, the high level scales with velocity: at **Level range** `10 V`, a
  velocity of 127 gives 10 V and a velocity of 64 gives about 5 V. This is the
  "dynamic gate" the module is named for.
- With **Rise** or **Fall** set, the edges are ramps rather than steps, which makes
  the output a crude envelope in its own right.

Between notes the output sits at 0 V.

---

## What MIDI drives it

Depends on **Trigger source**:

- ****Trigger source** `= note`** — any note-on on the selected **Channel** opens the gate; the
  gate closes when the last held note is released.
- ****Trigger source** `= CV 1` … `CV 8`** — the gate follows whichever note that CV output
  is currently playing. The **Channel** parameter disappears from the output, because
  the channel is inherited from the CV output.

The second form is what you want almost always, and it is essential for
polyphony: each voice's gate must follow its own voice, not the channel as a
whole. See [Concepts §5](../concepts.md#5-polyphony-is-several-cv-outputs-sharing-a-group).

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Level range** — the editor says `range`
> - **Retrigger** — the editor says `retrig`
> - **Trigger source** — the editor says `source`
> - **Velocity sensitive** — the editor says `vel sens`



| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Channel** | `ch 1` … `ch 16` | `ch 1` | Hidden when **Trigger source** is a CV output |
| **Trigger source** | `Note`, `CV 1` … `CV 8` | `CV 1` | Where the gate follows from |
| **Level range** | `10 V` … `1 V`, in 1 V steps | `10 V` | Gate high level |
| **Velocity sensitive** | `Off`, `On` | `Off` | Scale the high level by velocity |
| **Rise** | `OFF`, then 99 steps from `13 ms` to `67.11 s` | `OFF` | Attack ramp on the rising edge |
| **Fall** | `OFF`, then 99 steps from `13 ms` to `67.11 s` | `OFF` | Decay ramp on the falling edge |
| **Retrigger** | `Off`, `On` | `Off` | Re-fire on a new note while one is held |

The official manual calls **Rise** and **Fall** "Up" and "Down".

### Level range

Set this to match what you are driving. A module expecting a 5 V gate may behave
unpredictably at 10 V; one with a high trigger threshold may not fire at 3 V.
Being able to set it here saves an attenuator.

### Velocity sensitive

With this on, the gate becomes a velocity signal that happens to be shaped like a
gate. Two uses:

- **Straight into a VCA** — a single cable gives you note timing *and* dynamics.
  See [Recipes → velocity to VCA](../recipes/velocity-vca.md).
- **Into an envelope with a level-sensitive trigger input** — many analogue
  envelopes respond to trigger amplitude, so the envelope inherits the dynamics.

Note the interaction with **Level range**: **Velocity sensitive** scales *between 0 V and the Level range*.
Gate mode has no separate minimum-level control. [Trigger](trig.md) does, via its
**Level min** parameter, so use Trigger if you need velocity to scale between two
non-zero voltages.

### Rise and Fall

Ramps on the edges. The official manual describes them as "a small attack
envelope", but the range is not small: it runs from 13 ms up to 67 seconds in 99
exponential steps.

- A few milliseconds of **Fall** removes the click when a gate drives a VCA
  directly.
- Long values turn Gate into a usable slow envelope with a sustain.

**Rise** and **Fall** share the same table, listed in
[Appendix: parameter tables](../appendix-parameter-tables.md#rise-and-fall-times).

### Retrigger

With **Retrigger** `off`, playing a second note while the first is held does not
re-fire the gate — the gate stays high and only the pitch changes. That is
legato playing.

With **Retrigger** `on`, every note-on drops the gate briefly and raises it again, so
downstream envelopes restart.

`TODO(verify)`: how long the gate drops for when **Retrigger** is on. **Test:** set
**Retrigger** `on`, play overlapping notes, and watch the gate on a scope; measure the
low period between the two high sections.

---

## What it's for

**The gate half of a synth voice.** GATE 1 to your envelope's gate input, with
CV 1 in [Note](note.md) mode driving the pitch.

- CV 1: **Mode** `Note`, **Channel** `ch 1`.
- GATE 1: **Mode** `Gate`, **Trigger source** `CV 1`, **Level range** `10 V`, **Velocity sensitive** `off`,
  **Rise** `OFF`, **Fall** `OFF`, **Retrigger** `off`.

Hold a key and the envelope sustains. Play legato and it does not retrigger.
Turn **Retrigger** on if you want every note articulated.
