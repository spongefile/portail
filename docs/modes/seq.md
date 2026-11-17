# Sequencer

**Available on:** CV outputs and Gate outputs, with different parameters on each.

Sequencer is a step sequencer whose **step values come from MIDI CC messages**, not
from notes. Step 1 takes the value of CC1, step 2 takes CC2, step 3 takes CC3,
and so on up to the sequence length.

The idea is a controller with a row of faders: each fader is a step, and you draw
the sequence with your hands. It is Portail's take on a Voltage Block or a Klee.

---

## What comes out of the jack

**On a CV output** (**Voice mode** `= notes`): a **1 V/oct pitch** per step. The CC
value of that step is added to **Base note**, so a CC of 0 plays **Base note** and
higher CC values play higher pitches.

**On a CV output** (**Voice mode** `= cc`): a **continuous voltage** per step, scaled
by the CC value directly rather than treated as a pitch.

**On a Gate output** (**Mode** `= gates`): a **gate per step**, **Gate length**
milliseconds long, at **Level range** volts. Whether a step fires is determined by its
CC value.

**On a Gate output** (**Mode** `= cc`): a stepped voltage, as with CV's `cc` mode but
unipolar.

With **Glide** above `OFF` (CV only), the output slides between steps instead of
stepping.

The sequence advances one step per **Clock division** of the master clock, in the order set by
**Direction**.

---

## What MIDI drives it

Three separate things:

- **The master clock** advances the steps, divided by **Clock division**.
- **CC1 upward on the selected **Channel set the step values. A sequence with
  **Steps** `8` reads CC1 through CC8. Sending CC5 = 100 changes step 5 and nothing
  else.
- **Note-ons on the selected **Channel do whatever **Note action** says —
  transpose the sequence, or randomise it.

### The CC collision

This is the thing to watch, and the official manual never mentions it. A Sequencer
output with **Steps** `16` consumes **CC1 through CC16 on its channel**. CC1 is the
mod wheel, which is also [Note](note.md) mode's vibrato depth control, and CCs in
that region are what most controllers send by default.

Put the Sequencer output on a channel of its own if you can. If you cannot, keep
**Steps** short and make sure nothing else on that channel is in Note mode with
`vibrato` set.

---

## Parameters — CV output

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Clock division** — the editor says `div`
> - **Direction** — the editor says `dir`
> - **Gate length** — the editor says `gate len`
> - **Level range** — the editor says `range`
> - **Note action** — the editor says **Note** `in dest`
> - **Steps** — the editor says `length`
> - **Voice mode** — the editor says `out type`


| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Channel** | `ch 1` … `ch 16` | `ch 1` | Both the MIDI CC source and the note input |
| **Voice mode** | `notes`, `cc` | `notes` | Pitch steps or voltage steps |
| **Base note** | `C-2` … `G8` | `C1` | Pitch when a step's CC is 0 |
| **Clock division** | `4/1` … `1/32`, triplets, dotted | `1/16` | Clock division per step |
| **Steps** | `1` … `64` | `8` | Number of steps. Also how many CCs are consumed |
| **Direction** | `Forward`, `Backward`, `Pendulum`, `random` | `Forward` | Play order |
| **Glide** | `OFF`, `1` … `100` | `OFF` | Slide between steps |
| **Note action** | `Transpose`, `randomise 1_oct`, `randomise 2_oct` | `Transpose` | What an incoming note does |

## Parameters — Gate output

| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Channel** | `ch 1` … `ch 16` | `ch 1` | |
| **Mode** | `Gates`, `cc` | `Gates` | Gates or stepped voltage |
| **Clock division** | `4/1` … `1/32`, triplets, dotted | `1/16` | Clock division per step |
| **Gate length** | `1 ms` … `128 ms` | `6 ms` | Gate width per step |
| **Steps** | `1` … `64` | `8` | Number of steps |
| **Direction** | `Forward`, `Backward`, `Pendulum`, `random` | `Forward` | Play order |
| **Level range** | `10 V` … `1 V` | `10 V` | Gate height |
| **Note action** | `Off`, `randomise` | `Off` | What an incoming note does |

The official manual calls **Steps** "Steps" and **Note action** "Note in function".

### Direction

- `Forward` — 1, 2, 3, … n, 1, 2, …
- `Backward` — n, … 3, 2, 1, n, …
- `Pendulum` — 1, 2, … n, … 2, 1, 2, …
- `random` — a random step each division. Not a shuffled permutation; steps can
  repeat.

### Note action

Incoming notes on the channel do not become sequence steps — they act on the
sequence as a whole:

- **`Transpose`** — the played note transposes the whole sequence.
  `TODO(verify)`: which note is the zero point for transposition. **Test:** set
  **Note action** `transpose`, run a sequence, and play notes chromatically upward
  while watching the output pitch. The note at which the sequence plays
  untransposed is the zero point.
- **`randomise 1_oct` / `randomise 2_oct`** — the played note scrambles the
  sequence within one or two octaves.
- On Gate outputs the choice is just `Off` or `randomise`.

---

## What it's for

**A fader-drawn bassline.** With a controller whose eight faders send CC1–CC8:

- CV 2: **Mode** `Sequencer`, **Channel** `ch 3`, **Voice mode** `notes`, **Base note** `C1`,
  **Clock division** `1/8`, **Steps** `8`, **Direction** `forward`, **Glide** `OFF`.
- GATE 2: **Mode** `Sequencer`, **Channel** `ch 3`, **Step output** `gates`, **Clock division** `1/8`, **Gate length** `10 ms`,
  **Steps** `8`, **Level range** `10 V`.

Patch CV 2 to pitch and GATE 2 to an envelope. Start the clock. Move the faders
and the bassline changes under your hands, in time, without stopping.

Add [Scale](../fx/scale.md) pointed at CV 2 and every fader position lands
in key, which turns an awkward instrument into a playable one.
