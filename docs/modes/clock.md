# Clock

**Available on:** CV outputs and Gate outputs.

Clock produces timing pulses derived from the master clock: a steady clock, a
start/stop signal, or a reset pulse. It is how you drive a Eurorack sequencer
from your DAW or from Portail's own internal clock.

---

## What comes out of the jack

Depends on **Clock event**, which despite its name selects the **event type**:

| **Clock event** | What comes out |
|---|---|
| `Clock` | A pulse every **Clock division**, **Length** milliseconds long, at **Level range** volts |
| `Start/stop` | A single pulse when MIDI Start arrives |
| `Reset` | A single pulse when a reset occurs |

`TODO(verify)`: the official manual describes a third behaviour — "a high gate
when a midi start message is received who stay high until a midi stop message is
received" — that does not correspond to any of the three menu options by name.
It may be that `Start/stop` produces a sustained gate rather than a pulse.
**Test:** set a Gate output to `Clock` with **Clock event** `start/stop`, send MIDI Start
from your DAW, and measure the jack while the transport runs. If it reads
**Level range** volts continuously, it is a gate; if it pulses once, it is a trigger.

Between pulses the output is at 0 V.

---

## What MIDI drives it

**Not the **Channel** parameter.** Clock ignores it — the parameter is present on
the output but has no effect. The official manual states this correctly in a tooltip
and nowhere in the manual body.

What drives it is the **master clock**, which is a global setting:

- **Clock source = internal** — Portail's own generator, at the tempo set in
  global settings.
- **Clock source = external** — MIDI clock arriving on USB or TRS.

See [Concepts §8](../concepts.md#8-one-master-clock-feeds-everything-time-based)
and [the editor's global settings](../editor.md#global-settings).

With `clock source = external`, MIDI Start, Stop and Continue from the same
source drive the `Start/stop` and `Reset` event types.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Clock division** — the editor says `div`
> - **Clock event** — the editor says `source`
> - **Level range** — the editor says `range`



| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Channel** | `ch 1` … `ch 16` | `ch 1` | **No effect** |
| **Clock event** | `Clock`, `Start/stop`, `Reset` | `Clock` | Event type, not a signal source |
| **Clock division** | `4/1` … `1/32`, triplets, dotted — 23 options | `1/16` | Division of the master clock |
| **Length** | `1 ms` … `128 ms` | `5 ms` | Pulse width |
| **Level range** | CV: `+/-5 V`, `10 V` … `1 V`, `-1 V` … `-5 V`<br/>Gate: `10 V` … `1 V` | CV: `5 V`<br/>Gate: `10 V` | Pulse height |
| **Swing** | `OFF`, `55%`, `60%`, `75%`, `80%`, `90%` | `OFF` | Delays every second pulse |

### Clock division

`1/1` is one bar of 4/4. `1/4` is a quarter note. `1/16` is a sixteenth. The
list also has triplets (`1/8T`) and dotted values (`1/8.`). Full list in
[Appendix: parameter tables](../appendix-parameter-tables.md#clock-divisions).

**Getting this right matters more than anything else on this page.** Most
Eurorack sequencers advance one step per pulse, so if your sequencer has 16 steps
and you want it to cover one bar, you want **Clock division** `= 1/16`. If it is running at four
times the speed you expected, you are sending `1/64`-equivalent pulses to a
step-per-pulse sequencer, or your sequencer expects 24 PPQN rather than one pulse
per step. See [Recipes → clocking a sequencer](../recipes/clocking.md), which
works through the PPQN question specifically.

### Length

Pulse width in milliseconds. The default of 5 ms fires almost everything.

Two constraints:

- **Too short** and some modules miss it. If a sequencer skips steps, raise this
  to 10 ms.
- **Too long** and consecutive pulses run together. At 180 BPM a `1/32` division
  is about 42 ms apart, so a 50 ms pulse never goes low. Keep **Length** below
  about a third of the interval.

Note an off-by-one in the value list: the first two entries both read `1 ms`.
Harmless, but it means the list has 129 entries for 128 distinct values.

### Swing

Delays every second pulse by the given percentage, producing shuffle. `OFF` is
straight. There is no 50% entry because 50% *is* straight; the list starts at
`55%`.

Swing applies to the division you have set, so **Clock division** `1/16` with **Swing** `60%`
swings sixteenths.

---

## What it's for

**Clocking a Eurorack sequencer from your DAW, with a reset so it stays in
phase.**

- Global: `clock source = external`.
- GATE 7: **Mode** `Clock`, **Clock event** `clock`, **Clock division** `1/16`, **Length** `5 ms`, **Level range** `10 V`,
  **Swing** `OFF`.
- GATE 8: **Mode** `Clock`, **Clock event** `reset`, **Length** `5 ms`, **Level range** `10 V`.

Patch GATE 7 to the sequencer's clock input and GATE 8 to its reset input. Press
play in the DAW: the sequencer starts from step 1 and advances a step per
sixteenth. Stop and restart and it returns to step 1 rather than drifting.

Without the reset cable, the sequencer keeps its position across transport stops
and will eventually be out of phase with the DAW.
