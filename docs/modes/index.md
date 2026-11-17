# Mode reference

A **mode** is what a single output does. It is the first dropdown for that
output in the editor, which the official editor labels `type`. See
[Concepts §2](../concepts.md#2-a-mode-is-what-one-output-does).

Every page below answers the same four questions in the same order:

1. **What comes out of the jack** — the actual signal: voltage, polarity, shape,
   timing.
2. **What MIDI drives it** — which messages the mode listens to.
3. **Parameters** — every one, with its range, unit and default.
4. **What it's for** — one concrete patch.

---

## Which modes are available on which bank

| Mode | CV 1–8 | GATE 1–8 | Page |
|---|:---:|:---:|---|
| Off | ● | ● | Output sits at 0 V and ignores everything |
| Note | ● | — | [note.md](note.md) |
| Gate | — | ● | [gate.md](gate.md) |
| Trigger | ● | ● | [trig.md](trig.md) |
| MIDI CC | ● | ● | [cc.md](cc.md) |
| Velocity | ● | ● | [vel.md](vel.md) |
| Aftertouch | ● | ● | [at.md](at.md) |
| Poly aftertouch | ● | ● | [poly-at.md](poly-at.md) |
| Pitch bend | ● | ● | [pb.md](pb.md) |
| Clock | ● | ● | [clock.md](clock.md) |
| LFO | ● | ● | [lfo.md](lfo.md) |
| Envelope | ● | ● | [env.md](env.md) |
| Sequencer | ● | ● | [seq.md](seq.md) |
| CC recorder | ● | — | [cc-recorder.md](cc-recorder.md) |
| Random | ● | ● | [random.md](random.md) |
| Arpeggiator | ● | — | [arp.md](arp.md) |
| Euclidean | — | ● | [euclidean.md](euclidean.md) |

The official manual treats CC and Pitch bend as one entry ("CC/Pitch bend"). They are two
separate modes in the editor and they have separate pages here.

---

## Things that are true of every mode

Channel — every mode except OFF has one. It is `ch 1` … `ch 16`, set
independently per output. There is no global note channel.

Level range — the voltage the mode's full-scale output produces. The available
list depends on the bank, because the banks have different limits:

| On a CV output (`range_cv_menu`) | On a Gate output (`range_gate_menu`) |
|---|---|
| `+/-5 V`, `10 V`, `5 V`, `4 V`, `3 V`, `2 V`, `1 V`, `-1 V`, `-2 V`, `-3 V`, `-4 V`, `-5 V` | `10 V`, `9 V`, `8 V`, `7 V`, `6 V`, `5 V`, `4 V`, `3 V`, `2 V`, `1 V` |
| 12 options, bipolar available | 10 options, positive only |

A negative range on a CV output inverts the signal: `-5 V` means full scale
produces −5 V and zero produces 0 V.

CC and CC recorder on a CV output get a thirteenth option, ****Note** `scale`**,
which makes the output produce 1 V/oct pitch steps instead of a continuous
voltage. See [cc.md](cc.md#note-scale).

Clock division — a division of the master clock, on every time-based mode. The list is
`4/1, 2/1, 1/1, 1/2, 1/4, 1/8, 1/16, 1/32`, then triplets `4/1T … 1/32T`, then
dotted `4/1. … 1/16.` — 23 entries. LFO uses a slightly different list with two
extra slow values at the top (`32/1`, `16/1`) and no `1/1` triplet gap — 25
entries. Full lists in
[Appendix: parameter tables](../appendix-parameter-tables.md#clock-divisions).

`1/1` is one bar of 4/4. Larger numerator, slower.

**Defaults** quoted on these pages are the values the **editor** fills in when you
select that mode on a row. They are not necessarily the values in the module's
factory presets, which are not published — see
[unverified.md](../unverified.md).

**Note numbering:** MIDI note 60 is `C3`, note 0 is `C-2`, note 127 is `G8`.

---

## Choosing a mode

| You want | Use |
|---|---|
| Pitch that tracks a keyboard | [Note](note.md) on a CV output |
| A gate that follows the key | [Gate](gate.md), **Trigger source** = the CV output |
| A drum trigger from one specific key | [Trigger](trig.md) with `Note` set |
| A knob or fader to become a voltage | [MIDI CC](cc.md) |
| Dynamics into a VCA | [Velocity](vel.md), or [Gate](gate.md) with **Velocity sensitive** on |
| A clock for a sequencer | [Clock](clock.md) on a Gate output |
| Modulation locked to tempo | [LFO](lfo.md) |
| An envelope without spending a module | [Envelope](env.md) |
| A pattern you play in with faders | [Sequencer](seq.md) |
| A pattern from held notes | [Arpeggiator](arp.md) |
| A rhythm from two numbers | [Euclidean](euclidean.md) |
| Controlled unpredictability | [Random](random.md) |
