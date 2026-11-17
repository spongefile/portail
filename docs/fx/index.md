# FX reference

An **FX slot** processes MIDI on its way to an output. The editor's tab calls
them `FX`. See
[Concepts §6](../concepts.md#6-fx-slots-are-eight-processors-that-point-at-an-output)
for how slots and chaining work.

The essentials, restated:

- **8 slots.** They are a separate resource from the 16 outputs — an FX slot
  costs you no jacks.
- Each slot has an **FX type**, a **Target** (one output), and its own parameters.
- Several slots pointing at the same **Target** **chain in slot order**, lowest slot
  first. The order you configured them in is irrelevant; the slot number is what
  counts.
- Changing a slot's **FX type** deletes any CC map slot that pointed into it.

Every page below answers the same four questions in the same order:

1. **What it does to the signal**
2. **What it needs to work** — which destinations and modes it applies to
3. **Parameters** — range, unit, default
4. **What it's for** — one concrete patch

---

## The two domains

| | Note FX | Gate FX |
|---|---|---|
| Operates on | Note numbers, before pitch is produced | Gate events: timing, length, level, logic |
| **Target** offers | `CV 1` … `CV 8` | `GATE 1` … `GATE 8` |
| Destination must be in mode | `Note`, `Arpeggiator`, `Sequencer` or `Random` | `Gate`, `Trigger`, `Envelope`, `Sequencer`, `Random` or `Euclidean` |

The **Target** menu enforces the split — a Note FX will not offer a Gate
output. You cannot quantise a gate, and you cannot invert a pitch.

A Note FX pointed at a CV output that is running `LFO`, `MIDI CC`, `Clock`
or similar does nothing at all. This is the most common reason an FX slot appears
to be ignored.

---

## Note FX

| FX | One line |
|---|---|
| [Note filter](note-filter.md) | Ignore notes outside a range |
| [Random octave](random-oct.md) | Jump notes to another octave, sometimes |
| [Random note](random-note.md) | Add a random interval, sometimes |
| [Chance](chance.md) | Decide whether a note plays at all |
| [Accumulate](accumulate.md) | Transpose a running amount further each time |
| [Transpose](transpose.md) | Shift by a fixed number of semitones and octaves |
| [Scale](scale.md) | Quantise to one of 24 scales |
| [Microtonal](microtonal.md) | Retune using one of 8 tables. Always applied last |

## Gate FX

| FX | One line |
|---|---|
| [Delay](delay.md) | Delay a gate by a fixed time |
| [Humanize](humanize.md) | Delay a gate by a random time |
| [Logic](logic.md) | Combine two gates with a boolean function |
| [Random velocity](random-vel.md) | Vary gate level |
| [Random trig length](random-trig-length.md) | Vary gate width |
| [Invert](invert.md) | Flip a gate's state |
| [Repeats](repeats.md) | Ratchet — repeat a gate within its step |

---

## Ordering, with a worked case

Order changes results. The clearest example:

| Slots | Chain | Result |
|---|---|---|
| FX 1 = Random note, FX 2 = Scale, both **Target** `CV 1` | randomise → quantise | Random notes, all in key |
| FX 1 = Scale, FX 2 = Random note, both **Target** `CV 1` | quantise → randomise | In-key notes, then knocked off key again |

The second is almost never what anyone wants, and it is easy to arrive at by
accident because the editor lists slots in numeric order regardless of when you
filled them in.

**Rule of thumb:** put the things that create or scatter notes in low slots, and
the things that constrain them — Scale, Note filter, Transpose — in high slots.

[Microtonal](microtonal.md) is the exception: it is applied at the end of the
chain whatever slot it occupies, because it replaces the tuning table rather than
editing note numbers.

---

## FX that are advertised but not available

The eowave product page lists **Velocity VCA** ("use an output to modify the
amplitude of another output") and **Math** ("binary operation on midi notes")
among the module's effects.

**Neither is reachable.** In the shipped web editor they are commented out of the
menu, along with `CONDITIONAL`, `MODULATE`, `LFO MOD` and `CC MOD`. Their
parameter definitions are still present in the editor's source, so the firmware
may implement them and a future editor release may expose them — but as of the
editor captured in `research/`, you cannot select them.

The official manual mentions none of the six, in either direction. Recorded in
[unverified.md](../unverified.md).

If you need velocity to control amplitude today, use [Gate](../modes/gate.md)
with **Velocity sensitive** `on`, or a [Velocity](../modes/vel.md) output — see
[Recipes → velocity to VCA](../recipes/velocity-vca.md). If you need boolean
combination, [Logic](logic.md) covers the gate-domain case.
