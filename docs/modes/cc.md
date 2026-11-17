# MIDI CC

**Available on:** CV outputs and Gate outputs.

CC turns one MIDI control change into a voltage. It is how a knob, fader, mod
wheel, expression pedal or DAW automation lane becomes modulation in your rack.

---

## What comes out of the jack

A **continuous voltage proportional to the last received value of one CC**.

- CC value 0 → 0 V.
- CC value 127 → **Level range**.
- Values in between scale linearly.

The voltage holds until the next message. It does not decay and it does not reset
at power-on — a CV output in MIDI CC mode sits at 0 V until the first message arrives.

With **Slew** above `OFF`, the output slews toward each new value instead of
stepping to it, which smooths the 128-step staircase into something usable for
audio-rate-adjacent duties like filter cutoff.

On a CV output with a negative **Level range**, the voltage runs the other way: CC 127
produces −5 V.

### **Note** `scale`

CV outputs get one extra **Level range** option that Gate outputs do not: ****Note** `scale`**.

With **Note** `scale` selected, the output produces **1 V/oct pitch steps** rather
than a continuous voltage — the CC value is treated as a note number. Use it when
you want a CC to drive pitch, or when you want to feed the output through a
Note FX slot such as [Scale](../fx/scale.md), which only makes
sense on pitch data.

The official manual mentions this option once, in passing, in a different mode's
section, and never explains it. See [audit §11](../audit.md).

---

## What MIDI drives it

**Control change messages** matching **CC number**, on the selected **Channel**.
Nothing else. Notes on the same channel are ignored by this output.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **CC number** — the editor says `number`
> - **Level range** — the editor says `range`
> - **Slew** — the editor says **Slew** `/ smooth`



| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Channel** | `ch 1` … `ch 16` | `ch 1` | |
| **CC number** | `0` … `127` | `1` | Which CC to follow. `1` is the mod wheel |
| **Level range** | CV: `+/-5 V`, `10 V` … `1 V`, `-1 V` … `-5 V`, **Note** `scale`<br/>Gate: `10 V` … `1 V` | CV: `+/-5 V`<br/>Gate: `10 V` | Full-scale output |
| **Slew** | CV: `OFF`, `1` … `100`<br/>Gate: `OFF`, `1` … `100` | `OFF` | Slew amount. Higher is slower |

### Slew

A one-pole slew on the output. The editor shows a bare number with no unit;
higher is slower.

Two reasons to use it:

- **Removing steps.** 128 CC values across 10 V is 78 mV per step, which is
  audible as zipper noise on a filter cutoff. A small amount of **Slew** removes
  it.
- **Making a lag generator.** Larger values turn abrupt automation into slow
  sweeps.

`TODO(verify)`: the slew time in ms for a given **Slew** value. **Test:** set
**Slew** to `100` and **Level range** to `10 V`, send CC 0 then CC 127, and time how long
the output takes to reach 10 V. Repeat at `50` to see whether the scale is linear.

### Conflicts to watch

- **CC#1** is also the vibrato depth control for every [Note](note.md) output on
  the same channel. If you use CC#1 here and have a Note output on the same
  channel with `vibrato` set, they interact.
- **CC#1 upward** is also what [Sequencer](seq.md) reads for its step values. A Sequencer
  output with **Steps** `8` consumes CC1–CC8 on its channel.
- The **default CC map** and the **CC map** also consume CCs, on the global
  CC channel. See [Appendix: default CC map](../appendix-cc-map.md).

If a CC seems to do two things at once, this is why. Putting your modulation CCs
on a channel with no Note or Sequencer outputs avoids all of it.

---

## What it's for

**A mod wheel controlling filter cutoff.**

- CV 3: **Mode** `MIDI CC`, **Channel** `ch 1`, **CC number** `1`, **Level range** `5 V`, **Slew** `20`.

Patch CV 3 to your filter's cutoff CV input. The mod wheel now sweeps the filter
over 5 V, smoothly rather than in steps.

For an expression pedal, use **CC number** `11`. For DAW automation, pick any CC your
DAW is not already using — 20 through 31 are conventionally free.
