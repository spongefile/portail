# Recipes

Worked patches. Each one gives you the goal, the cabling, the exact settings,
what you should hear, and what to check when you don't.

They are ordered by how likely you are to need them, starting with a hardware
sequencer or groovebox over TRS MIDI and a keyboard over USB.

---

## Hardware-first

| Recipe | What you get |
|---|---|
| [Drum triggers from a groovebox](drum-triggers.md) | Per-track MIDI channels driving separate trigger outputs |
| [Clocking a sequencer correctly](clocking.md) | Clock, reset and start/stop, with the PPQN question settled |
| [Multitrack CV/gate pairs](multitrack.md) | Four sequencer tracks becoming four modular voices |
| [Poly voice allocation](poly-synth.md) | A three-voice keyboard patch, and what voice stealing sounds like |
| [Velocity to VCA](velocity-vca.md) | Dynamics from one cable |
| [Aftertouch and pitch bend as modulation](expression.md) | Hand control over the patch |

## Generative and tuning

| Recipe | What you get |
|---|---|
| [Euclidean rhythms](euclidean.md) | Two interlocking patterns and a derived third |
| [Microtonal and scale playback](microtonal.md) | Quantised and retuned pitch |

## From a DAW over USB

| Recipe | What you get |
|---|---|
| [A DAW-driven mono voice](daw-mono.md) | Pitch, gate and automation from a track |

---

## Before you start any of these

**Check your MIDI is arriving.** Everything here fails the same way if it is not.
Run the [quick start](../quick-start.md) once, confirm a note plays, and you have
eliminated the cable, the power and the port.

**TRS MIDI is Type A.** If your groovebox has a 5-pin DIN out, you need a
DIN-to-TRS-Type-A adapter. A Type B cable is wired backwards and passes nothing.
This is the most common single failure with hardware sources.

**Send, then save.** Every recipe assumes you press **update all parameters** to
hear the change, and **save parameters** to keep it. Sending without saving means
the patch disappears at power-off. See
[Concepts §9](../concepts.md#9-presets-and-the-difference-between-sending-and-saving).

**Back up before you overwrite.** The factory presets are not published anywhere,
so once you overwrite preset 1 it is gone. Use **save to file** on all eight
presets first — [the editor](../editor.md#backing-up) has the procedure.
