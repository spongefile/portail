# Unverified claims

Every statement in this manual that is **not** confirmed against a primary
source, with the test that would settle it.

This manual is published for other Portail owners. A stranger may patch their
rack based on it. So the rule is absolute: if a voltage, range, default or
behaviour could not be confirmed, it is marked `TODO(verify)` in the text and
listed here — never smoothed over into confident prose.

**Primary sources**, for this purpose:

- The official manual PDF (`research/portail_manual_v1.pdf`, V0.9)
- The shipped web editor's source (`research/original-editor/`)
- The eowave product page (`research/eowave-portail-page.html`)

Anything derived from the editor's parameter tables is treated as confirmed,
because those tables are what the editor sends to the module. Anything from the
official manual alone is treated as confirmed **unless** it contradicts the
editor, in which case the editor wins and the conflict is noted in
[audit.md](audit.md).

If you run one of these tests, please record the result. Items are grouped by how
much difference the answer makes; a by-chapter index of every inline marker is at
the [end of this page](#index-by-chapter).

`research/sweep-todos.py` sweeps the inline `TODO(verify)` markers and fails if
any file carrying one is not referenced here, so this list cannot silently fall
behind the text.

---

## High impact — affects whether a patch works at all

### 1. Factory preset contents

**Claim:** preset 1 has CV 1 in Note mode on channel 1 and GATE 1 following it.

**Status:** inferred from the module working out of the box in that configuration.
The contents of all 8 factory presets are unpublished.

**Test:** connect the editor, select each preset in turn, read it from the
module, and export each to a file. Do this **before overwriting anything** —
there is no published restore file.

Referenced in: [quick start](quick-start.md), [the editor](editor.md#backing-up)

### 2. Which preset loads at power-on

**Claim:** none made.

**Status:** unknown — always slot 1, or whichever was last selected.

**Test:** select preset 3, power the case off and on, then connect the editor and
check which preset is reported as current.

Referenced in: [on-module controls](on-module.md)

### 3. The on-module button scheme (OQ-3) — mostly resolved from firmware

**Status:** **resolved from the firmware** (version 0.83r). The two buttons are a
**preset selector plus a save**, not a menu or mode editor:

- **▲ short press** — active preset + 1 (wraps 8→1), recalled immediately.
- **▼ short press** — active preset − 1 (wraps 1→8), recalled immediately.
- **▲ + ▼ together, release** — saves the active preset to flash.
- **▼ held at power-up** — bootloader.

The ▲/▼ silkscreen labels are **inferred** from press direction (the firmware only
knows GPIO 23 and 22). See [on-module controls](on-module.md#gesture-reference).

**Residual (needs a press-test):** the hold-to-repeat rate and the roles of the
firmware's 2-second and 5-second timers; and whether an isolated first press shows
the current preset before the next press moves it.

**Test:** hold a button and count presets per second; separately, leave the module
idle then press once and watch whether the preset changes on that first press.

Referenced in: [on-module controls](on-module.md#the-two-things-still-worth-a-press-test)

### 4. Clock resolution in PPQN

**Claim:** none made. Divisions are musical (`1/16`, `1/4`).

**Status:** the internal PPQN is unstated. Matters if your sequencer wants raw
24 PPQN rather than one pulse per step.

**Test:** set **Clock division** `1/4` and count pulses against a known master over 16 bars —
should be 1:1. Then **Clock division** `1/32`, which should give 8 per quarter note.

Referenced in: [Concepts §8](concepts.md#8-one-master-clock-feeds-everything-time-based),
[clocking recipe](recipes/clocking.md#the-ppqn-problem)

### 5. Which voice gets stolen in a poly group

**Claim:** none made.

**Status:** the allocator is round-robin, so oldest-first is likely, but no source
states it.

**Test:** with **Retrigger** `on`, hold C3, E3, G3 in a three-voice group, then add B3
and note which pitch disappears. Repeat several times for consistency.

Referenced in: [poly synth recipe](recipes/poly-synth.md#voice-stealing)

### 6. The 8 microtonal tables — resolved; custom-tuning writes unverified

**Status:** **resolved from the firmware** (version 0.83r). All eight tables ship
identical: **standard 12-tone equal temperament**, zero deviation. They are empty,
user-customisable slots, not exotic factory tunings, which is why the editor lists
them unnamed. `table 1` is a **confirmed** safe standard-tuning default.

Format: 12 values per table, one per pitch class, in cents (14-bit). Tables live
in device flash, not in the firmware image. Custom tunings can now be authored and
sent from the editor's [Tuning tab](editor.md#the-tuning-tab).

**Residuals — all firmware-derived, not yet hardware-confirmed:**

- **The table-write format** (opcode `0x24`) has not been confirmed on real
  hardware. The Tuning tab sends behind a one-time confirmation and marks the
  tuning Unverified until checked. **Test:** send a table with an obvious offset
  (C♯ at 150 cents) and confirm C♯ plays sharp.
- **No read-back.** The module can't report a table, so the editor only tracks
  what it last sent. **Test:** send a table, reload the editor, confirm it can't
  recover the contents from the module.
- **Persistence.** Sending writes to working memory; there is no confirmed
  save-to-flash path. **Test:** send a distinctive table, power-cycle, and check
  whether it reverts to standard tuning.
- The contents of a table a *particular owner* customised (inherently per-module)
  can only be read off the hardware — see
  [Appendix: scales](appendix-scales.md#reading-a-table-a-module-has-been-given).

Referenced in: [Microtonal](fx/microtonal.md),
[Appendix: scales](appendix-scales.md#the-8-microtonal-tables)

### 7. The default CC map

**Claim:** none made about specific CC numbers.

**Status:** the map exists, is in firmware, is readable over SysEx, and can be
disabled globally. **The assignments themselves are unpublished** — the official
manual promises them and writes `(CC##)` placeholders instead.

**Test:** read the configuration from the module with the official editor; it
appends each parameter's assigned CC to the parameter's label.

Referenced in: [Appendix: default CC map](appendix-cc-map.md)

### 8. Whether a MIDI output connector exists

**Claim:** none made.

**Status:** contradictory. The official manual's global settings describe passing
MIDI to "the MIDI OUT port on the back of the module", and the editor has a
working `midi_copy` parameter. But no connector list anywhere mentions a MIDI
output, and the product page lists inputs only.

**Test:** inspect the back of the module for a connector or header besides the
power socket. Enable **Active midi out copy**, save, and probe any candidate
while sending MIDI in.

Referenced in: [Specifications](specifications.md#the-midi-output-question)

---

## Medium impact — affects how a parameter behaves

### 9. Glide time in real units

**Status:** the control is `OFF` then `1`–`127` with no unit shown. The editor's
source contains an unused `glide_times` table suggesting roughly 0.1 to
419 ms/V, but it is not wired to the control in the shipped editor.

**Test:** set **Glide** `127`, play `C2` then `C5` (3 V), and time the transition.
Divide by 3 for ms/V. Repeat at `64` to check linearity.

Referenced in: [Note](modes/note.md#glide-has-no-unit)

### 10. Which way Legato runs

**Status:** the values are only `Off` and `On`. A comment in the editor's source
says "by default glide is only legato notes", which contradicts the default
being `Off`.

**Test:** set **Glide** `100`, **Legato** `off`, play two separated notes. If the pitch
slides, `Off` means "glide always".

Referenced in: [Note](modes/note.md#legato)

### 11. Filter and smooth slew times

**Status:** **Slew** on MIDI CC, Aftertouch, Poly aftertouch, Pitch bend and on Random are bare
numbers with no unit.

**Test:** set **Slew** `100`, **Level range** `10 V`, send CC 0 then CC 127, and time the
transition. Halve the setting and check whether the time halves.

Referenced in: [MIDI CC](modes/cc.md#slew), [DAW recipe](recipes/daw-mono.md)

### 12. Envelope times — floor and ceiling in practice

**Status:** the table is confirmed from the editor as 2.1 ms to 134217.7 ms. The
official manual claims 0 ms to 13 s, which is wrong at both ends. What is
unconfirmed is whether the firmware honours the full table or clamps it.

**Test:** set **Shape** `ad`, **Attack** at index 0 and **Decay** at index 127, trigger
once, and time how long the output takes to return to 0 V. It should be over two
minutes.

Referenced in: [Envelope](modes/env.md#the-time-scale)

### 13. Which MIDI note is 0 V

**Status:** unstated. Note numbering (`C3` = MIDI 60) is confirmed from the
editor's naming function, but the voltage reference is not.

**Test:** set a CV output to Note, play `C3`, measure the jack. Then play `C4`
and confirm the reading is exactly 1.000 V higher.

Referenced in: [Note](modes/note.md#what-comes-out-of-the-jack),
[Specifications](specifications.md#calibration)

### 14. Clock `Start/stop` — pulse or sustained gate?

**Status:** the official manual describes "a high gate … until a midi stop
message is received", which does not match any menu option by name.

**Test:** set **Trigger source** `start/stop`, send MIDI Start, and measure the jack while
the transport runs. Continuous voltage means gate; a single pulse means trigger.

Referenced in: [Clock](modes/clock.md)

### 15. `Noise` versus `random` LFO waveforms

**Status:** both are random; the difference is undocumented.

**Test:** set each in turn at **Clock division** `1/4` and watch on a scope. One should step
once per division; the other should change continuously.

Referenced in: [LFO](modes/lfo.md)

### 16. LFO `Gated` mode between notes

**Status:** unclear whether the output holds its last value or falls to 0 V.

**Test:** set `Gated` with **Clock division** `1/1`, hold a note until the waveform is partway
up, release, and measure.

Referenced in: [LFO](modes/lfo.md#phase-mode)

### 17. Retrigger gate drop duration

**Status:** unstated.

**Test:** set **Retrigger** `on`, play overlapping notes, and measure the low period on
a scope.

Referenced in: [Gate](modes/gate.md#retrigger)

### 18. Pitch bend on a Gate output

**Status:** unclear whether the negative half of the wheel clamps at 0 V or the
full travel is rescaled into 0 V…**Level range**.

**Test:** set a Gate output to Pitch bend, **Level range** `10 V`, and measure at wheel centre. 5 V
means rescaled; 0 V means clamped.

Referenced in: [Pitch bend](modes/pb.md)

### 19. Chance Probability polarity

**Status:** unclear whether it is the chance a note **plays** or is **dropped**.
The default of `10%` is suspiciously low for "chance it plays".

**Test:** set **Probability** `10%`, **Velocity influence** `0%`, play a steady stream of notes. If
almost all sound, the parameter is the drop chance.

Referenced in: [Chance](fx/chance.md)

### 20. Chance Velocity influence interaction

**Status:** unclear whether it scales, offsets or overrides **Probability**.

**Test:** set **Probability** `50%`, **Velocity influence** `100%`, play twenty notes at velocity 1
and twenty at 127, and compare how many sound.

Referenced in: [Chance](fx/chance.md)

### 21. Accumulate start point and reset counting

**Status:** the official manual documents both parameters as `?`.

**Test:** set **Amount** `12`, **Reset after** `4`, play a repeated `C3` and note the four
pitches before it wraps. C3-C4-C5-C6 means it starts at zero and counts notes.
Separately, check whether a transport stop clears the accumulator.

Referenced in: [Accumulate](fx/accumulate.md)

### 22. Delay — is the note-off delayed too?

**Status:** unclear whether gate width is preserved.

**Test:** apply Delay with **Amount** around 500 ms to a Gate output, hold a key
for exactly two seconds, and measure the resulting gate width.

Referenced in: [Delay](fx/delay.md)

### 23. Humanize maximum displacement and direction

**Status:** the maximum in ms at **Amount** `100%` is unstated, as is whether
displacement is late-only or either side of the beat.

**Test:** set **Amount** `100%` on a Euclidean output at **Clock division** `1/4`, record against an
undelayed clock, and measure the earliest and latest offsets over fifty hits.

Referenced in: [Humanize](fx/humanize.md)

### 24. Repeats — Amount units and overrun behaviour

**Status:** **Amount** is a `0`–`127` control described as "division of the clock",
with no visible mapping. Whether repeats compress into the step or overrun into
the next is unknown.

**Test:** set **Repeats** `2` and step **Amount** through `0`, `32`, `64`, `96`, `127`,
measuring the gap each time. Then set **Repeats** `4` at a slow **Clock division** and check
whether the burst stays inside one step.

Referenced in: [Repeats](fx/repeats.md)

### 25. Random trig length — maximum extension and Velocity influence direction

**Test:** set **Level range** `127`, **Velocity influence** `0` on a `Trigger` output with **Length** `5 ms`
and measure the widest gate over fifty hits. Then set **Velocity influence** `127` and
compare velocity 1 against 127.

Referenced in: [Random trig length](fx/random-trig-length.md)

### 26. Logic output level and self-reference

**Status:** unclear whether the result uses the destination's **Level range**, and what
happens when **Target** and **Operand** are the same output.

**Test:** set the destination's **Level range** to `5 V`, apply Logic, measure the high
level. Separately set both to `GATE 1` with **Function** `XOR` and check for a dead
output.

Referenced in: [Logic](fx/logic.md)

### 27. Invert on a continuous signal

**Test:** set a Gate output to `LFO`, **Waveform** `triangle`, **Level range** `10 V`, apply
Invert, and watch on a scope. Mirroring means it handles continuous signals;
a square wave means it thresholds first.

Referenced in: [Invert](fx/invert.md)

### 28. Random velocity — clipping or wrapping

**Test:** play at velocity 120 with **Blend** `added`, **Level range** `127`. Occasional very
quiet hits among loud ones would mean it wraps.

Referenced in: [Random velocity](fx/random-vel.md)

### 29. Random octave — symmetric or upward only

**Test:** set **Level range** `1`, **Probability** `100%`, play a repeated note, and watch the
output over twenty notes.

Referenced in: [Random octave](fx/random-oct.md)

### 30. Sequencer `Transpose` zero point

**Test:** run a sequence with **Note action** `transpose` and play chromatically
upward. The note at which the sequence plays untransposed is the zero point.

Referenced in: [Sequencer](modes/seq.md#note-action)

### 31. CC recorder record semantics

**Status:** unclear whether a take replaces the whole loop or punches in, and
whether `arm record` stops after one pass.

**Test:** record a full loop, then re-record while moving the CC for only the
first half. Retained old values in the second half means punch-in.

Referenced in: [CC recorder](modes/cc-recorder.md)

### 32. Euclidean Fills above Steps

**Test:** set **Steps** `8` and raise **Fills** from 8 to 16, watching whether the
output saturates or wraps.

Referenced in: [Euclidean](modes/euclidean.md)

### 33. Euclidean Channel — any effect at all?

**Test:** send notes, CCs and aftertouch on the selected channel and watch for
any change in the pattern.

Referenced in: [Euclidean](modes/euclidean.md)

### 34. Arpeggiator Hold — replace or accumulate

**Test:** hold a triad with **Hold** `on`, release, then play one note. A single
repeating note means it replaces.

Referenced in: [Arpeggiator](modes/arp.md#hold)

### 35. Note filter with Lowest note above Highest note

**Test:** set **Lowest note** `G8`, **Highest note** `C-2`, and play across the keyboard.

Referenced in: [Note filter](fx/note-filter.md)

### 36. Scale rounding rule

**Test:** with **Scale** `major`, **Root note** `C`, play F♯ — equidistant from F and G —
and see which you get. Repeat with C♯.

Referenced in: [Scale](fx/scale.md)

### 37. Scale interval contents

**Status:** the 24 scale **names** are confirmed from the editor. Their interval
contents are the conventional readings, not verified against firmware.

**Test:** play a chromatic octave through each scale and note which input notes
collapse onto the same output pitch.

Referenced in: [Appendix: scales](appendix-scales.md#the-24-scales)

---

## Low impact — mostly specification detail

### 38. Module depth in mm

**Test:** measure from the back of the panel to the furthest rear component,
with the power cable seated.

### 39. Output impedance, drive capability, short-circuit protection

**Status:** unpublished. No safe user test; treat the outputs conservatively.

### 40. Full CV output swing in practice

**Status:** the manual says −5 V to +10 V, but no **Level range** menu option spans it.

**Test:** set a CV output to `Note` with no FX slots and measure at the lowest
and highest notes your oscillator tracks.

Referenced in: [Specifications](specifications.md#outputs)

### 41. DC coupling and settling time

**Test:** set a Gate output to `LFO`, **Waveform** `square`, **Clock division** `1/32`, raise the
tempo to maximum, and inspect the edges on a scope.

### 42. Calibration commands

**Status:** three SysEx calibration commands exist in the editor's source and no
editor control sends any of them. No documented procedure.

**Do not experiment with these on a working module.** Contact eowave.

Referenced in: [Specifications](specifications.md#calibration),
[Appendix: SysEx](appendix-sysex.md)

### 43. File-transfer SysEx commands

**Status:** `SYS_RECEIVE_FILE` (`0x0E`) and `SYS_VIEW_FILE` (`0x10`) are
implemented in firmware but unused by any editor, and their payload format is
unknown. Note these are **not** the microtonal-table route — that is opcode
`0x24`, now known (item 6). What `0x0E`/`0x10` carry is still open.

Referenced in: [Appendix: SysEx](appendix-sysex.md)

### 44. Firmware update preserves presets

**Test:** back up all 8 presets to files, update the firmware, read each back and
compare.

Referenced in: [the editor](editor.md#firmware-updates)

### 44a. Bootloader entry procedure

**Claim:** hold the left button (▼) and power the rack up while holding, until the
`RPI-RP2` volume appears.

**Status:** the button is confirmed from the official manual, which mentions it
exactly once — in the firmware update section, the only place either button
appears in the whole document. It does not say how long to hold, whether the
button must be held until the volume mounts, or whether releasing early aborts.
That omission is itself an audit finding: the module's only documented button
gesture is under-specified.

**Test:** with the rack off and USB connected, hold the left button, power up, and
note whether the volume appears immediately or after a delay, and whether
releasing early aborts it.

**Why it matters:** this is the recovery path from a failed firmware update. See
[Can I break my module?](troubleshooting.md#can-i-break-my-module).

Referenced in: [troubleshooting](troubleshooting.md#can-i-break-my-module),
[on-module controls](on-module.md)

### 45. Reading the running firmware version

**Status:** the editor requests it over SysEx (command 34) and displays it, but no
source says where or what the current version is.

Referenced in: [Specifications](specifications.md#firmware)

### 46. USB enumeration without rack power

**Test:** with the case off, connect USB and see whether the editor's device list
offers `Portail`.

Referenced in: [the editor](editor.md#connecting)

### 47. LED state triggers and brightness curve (OQ-15)

**Status:** mostly resolved from the firmware. Confirmed: 16 addressable RGB LEDs,
one per output; **brightness tracks each output's live level** (VU-style); and a
state palette of **blue = MIDI/clock activity, red = preset recalled, white =
active/selected, green = saved, cycling colours = MIDI-learn armed, dim grey =
idle**. See [on-module controls](on-module.md#what-the-leds-mean).

**Still unknown:** the exact triggers for the yellow, cyan and warm-white palette
entries, the precise voltage-to-brightness curve, animation timing, and which of
the 16 LEDs maps to which of the 8 presets for the red recall marker.

**Test:** the OQ-15 filming recipe. In a dim room, record the LED column while
powering up, recalling each preset 1–8, playing sustained notes and a rising LFO,
sending clock and start/stop, arming MIDI-learn, and pressing each button — then
read any unfamiliar colour off a single frame against the palette in
`spec/model.json → led_colors.palette`. Record results into
`spec/model.json → led_colors.states`.

Referenced in: [on-module controls](on-module.md#what-the-leds-mean)

### 48. Gate Random and Gate Trigger editor defaults

**Status:** the editor's stored default lists for these two modes are shorter than
their parameter counts, so the last one or two parameters may initialise to
something other than the first menu entry.

**Test:** select the mode in the editor, send it, then read back from the module
and compare.

Referenced in: [Random](modes/random.md)

### 49. Poly aftertouch in a polyphonic patch

**Status:** Poly aftertouch's **Trigger source** is a fixed note number, not a CV output, so it tracks
a pitch rather than a voice. Whether that is usable in a poly group depends on
the allocator, which is item 5.

Referenced in: [Poly aftertouch](modes/poly-at.md)

---

## Advertised but not available

**VELOCITY VCA** and **MATHS** are listed on the eowave product page as available
effects. They are **commented out of the shipped editor's menu**, along with
`CONDITIONAL`, `MODULATE`, `LFO MOD` and `CC MOD`.

Their parameter definitions remain in the editor's source, so the firmware may
implement them and a future editor may expose them. As of the editor captured in
`research/`, they cannot be selected.

The official manual mentions none of the six, in either direction.

Referenced in: [FX reference](fx/index.md#fx-that-are-advertised-but-not-available)

---

## Contributing

If you run any of these tests, the results are worth more than anything else that
could be added to this manual. Record what you observed, what you measured, and
what module and firmware version you used — firmware behaviour may change between
versions.

Items 3 and 6 — the button scheme and the microtonal tables — are now resolved
from the firmware. The largest remaining gap is **item 7, the default CC map**,
which is still answerable in an afternoon by reading it off a connected module.

---

## Index by chapter

Every inline `TODO(verify)` marker in the manual, by chapter and line. Generated
by `research/sweep-todos.py --chapters`. The numbered entries above are the ones
with full test recipes; this index proves none has been missed.

## Quick start

- `quick-start.md:88` — `TODO(verify)`: the exact contents of factory presets 1–8 are not published, and

## Concepts

- `concepts.md:289` — `TODO(verify)`: the master clock's internal resolution in PPQN is not stated in

## Mode reference

- `modes/arp.md:74` — `TODO(verify)`: whether, with **Hold** `on`, playing a single new note replaces the
- `modes/cc-recorder.md:52` — `TODO(verify)`: whether recording overwrites the whole loop or only the steps
- `modes/cc.md:80` — `TODO(verify)`: the slew time in ms for a given **Slew** value. **Test:** set
- `modes/clock.md:21` — `TODO(verify)`: the official manual describes a third behaviour — "a high gate
- `modes/euclidean.md:42` — `TODO(verify)`: whether **Channel** has any effect at all on a Euclidean output —
- `modes/euclidean.md:80` — `TODO(verify)`: what happens. **Test:** set **Steps** `8`, raise **Fills** from 8 to
- `modes/gate.md:108` — `TODO(verify)`: how long the gate drops for when **Retrigger** is on. **Test:** set
- `modes/lfo.md:33` — documented. `TODO(verify)`: **test:** set both in turn with **Clock division** `1/4` and watch
- `modes/lfo.md:92` — `TODO(verify)`: what the output does in `Gated` mode between notes — whether it
- `modes/note.md:24` — `TODO(verify)`: which MIDI note corresponds to 0 V. **Test:** set a CV output to
- `modes/note.md:90` — `TODO(verify)`: the actual glide time in ms per volt. The editor's source
- `modes/note.md:102` — `TODO(verify)`: which way round. The editor labels the values only `Off` and
- `modes/pb.md:30` — `TODO(verify)`: what a Gate output does with the downward half of the wheel —
- `modes/random.md:89` — `TODO(verify)`: the editor's stored defaults for Gate Random cover only five of
- `modes/seq.md:115` — `TODO(verify)`: which note is the zero point for transposition. **Test:** set

## FX reference

- `fx/accumulate.md:25` — `TODO(verify)`: whether the accumulation starts at zero or at **Amount** for the
- `fx/accumulate.md:31` — `TODO(verify)`: whether anything other than reaching **Reset after** clears the
- `fx/chance.md:53` — `TODO(verify)`: the polarity of **Probability** — whether it is the chance a note
- `fx/chance.md:61` — `TODO(verify)`: how **Velocity influence** combines with **Probability** — whether it scales
- `fx/delay.md:22` — `TODO(verify)`: whether the note-off is delayed by the same amount, preserving
- `fx/humanize.md:22` — `TODO(verify)`: the maximum delay in milliseconds at **Amount** `100%`, and whether
- `fx/invert.md:33` — `TODO(verify)`: what Invert does to a continuous signal such as an
- `fx/logic.md:62` — `TODO(verify)`: what happens if **Target** and **Operand** are the same output with
- `fx/logic.md:67` — `TODO(verify)`: the output voltage of a Logic result — whether it uses the
- `fx/note-filter.md:51` — `TODO(verify)`: what happens if **Lowest note** is set above **Highest note**. **Test:** set
- `fx/random-oct.md:53` — `TODO(verify)`: whether displacement is symmetric — up and down with equal
- `fx/random-trig-length.md:23` — `TODO(verify)`: the maximum extension in milliseconds at **Length range** `127`, and the
- `fx/random-vel.md:58` — `TODO(verify)`: whether `Added` clips at 127 or wraps. **Test:** play notes at
- `fx/repeats.md:21` — `TODO(verify)`: whether every gate is ratcheted or only some, and whether the
- `fx/repeats.md:29` — `TODO(verify)`: the unit of **Amount**. It is a `0`–`127` control rather than a
- `fx/scale.md:14` — `TODO(verify)`: what happens to a note exactly between two scale degrees —

## Recipes

- `recipes/clocking.md:95` — `TODO(verify)`: **whether any clock division setting produces 24 pulses per quarter
- `recipes/clocking.md:164` — or a gate — see the `TODO(verify)` on Clock.
- `recipes/daw-mono.md:84` — `TODO(verify)`: the slew time in milliseconds for a given **Slew** value.
- `recipes/poly-synth.md:76` — `TODO(verify)`: **which voice gets stolen.** The round-robin allocator most

## The editor

- `editor.md:34` — needs rack power to run. `TODO(verify)`: whether the module enumerates over
- `editor.md:281` — also a `TODO(verify)` — see unverified.md.
- `editor.md:288` — `TODO(verify)`: that the table-write format is correct on hardware. **Test:**
- `editor.md:294` — not the module's true state. `TODO(verify)`: whether any read-back path exists.
- `editor.md:300` — after powering the module on, re-send the table. `TODO(verify)`: whether a sent
- `editor.md:343` — Back up your presets before updating.** `TODO(verify)`: whether a firmware

## On-module controls

- `on-module.md:110` — `TODO(verify)`: **which preset loads at power-on** — always slot 1, or whichever
- `on-module.md:170` — `TODO(verify)`: **the exact triggers for the yellow, cyan and warm-white palette
- `on-module.md:221` — unverified.md and the last `TODO(verify)` markers on this page

## Troubleshooting

- `troubleshooting.md:84` — `TODO(verify)`: **the exact button and procedure for entering the bootloader.**

## Specifications

- `specifications.md:14` — Depth | `TODO(verify)` | Not published. **Measure** the module from the back of the panel to the furthest rear
- `specifications.md:42` — `TODO(verify)`: the actual minimum and maximum a CV output can produce, as
- `specifications.md:48` — `TODO(verify)`: output impedance and short-circuit protection. Not published.
- `specifications.md:50` — `TODO(verify)`: whether the outputs are DC-coupled across their full range and
- `specifications.md:73` — `TODO(verify)`: **whether the module has a MIDI output at all.**
- `specifications.md:122` — `TODO(verify)`: **what these do, how to invoke them, and whether the shipped
- `specifications.md:159` — `TODO(verify)`: how to read the running firmware version. The editor requests one

## Appendices

- `appendix-cc-map.md:52` — `TODO(verify)`: **the actual CC number assigned to each parameter.**
- `appendix-cc-map.md:79` — CV 1 | **Voice mode** | `TODO(verify)` |
- `appendix-cc-map.md:80` — CV 1 | **Bend range** | `TODO(verify)` |
- `appendix-scales.md:39` — `TODO(verify)`: the exact interval content of each. The names above are standard
- `appendix-sysex.md:162` — `TODO(verify)`: the payload format for all of them. Nothing documents them.
- `appendix-sysex.md:169` — `TODO(verify)`: the write format is firmware-derived, not yet hardware-confirmed —

## Other

- `audit.md:57` — values `TODO(verify)` because they live in firmware and are not in any primary
- `audit.md:259` — confirmed and marks the rest `TODO(verify)` with an explicit button-press test
- `audit.md:462` — §1, §13 numbers missing or placeholder | Every range, unit and default stated; anything unconfirmed is `TODO(v
- `index.md:21` — `TODO(verify)` and gives you the test to run on your own module. Every such gap
- `index.md:135` — `TODO(verify)` marks a value or behaviour not confirmed against a primary
