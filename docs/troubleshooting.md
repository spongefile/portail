# Troubleshooting

Organised by **what you observe**, because that is what you know when something
is wrong.

The official manual's troubleshooting section is a single bullet about
reconnecting a phone. See [audit §14](audit.md).

---

## Start here: three checks that solve most problems

**1. Is MIDI arriving?** Watch the module's LEDs while you play — incoming MIDI
drives them **blue**. If nothing responds, the problem is upstream of Portail and
no amount of configuration will fix it. See
[what the LEDs mean](on-module.md#what-the-leds-mean).

**2. Did you save?** Sending a configuration and saving it are two different
actions. If your settings disappeared at power-off, you sent but did not save.
See [Concepts §9](concepts.md#9-presets-and-the-difference-between-sending-and-saving).

**3. Is it the right channel?** Every output has its own **Channel**. There is no
global note channel. A wrong channel produces exactly the symptom of a broken
cable.

---

## Can I break my module?

Short answer: **not by using the editor, and not by a failed firmware update.**
Everything below is recoverable. It is worth reading once, because the fear of
bricking is the main reason people avoid configuring this module at all.

### Editing configuration cannot brick it

When an editor sends configuration, it writes to **volatile memory**. That memory
is cleared at power-off.

So the worst outcome of any configuration mistake — including a value the module
does not expect — is a module that behaves oddly until you **power-cycle your
rack**. Turn the case off and on and it reloads the stored preset. Nothing has
been written permanently.

This is the reason the send/save split exists, and the reason it is worth
keeping: **send** is always reversible by a power cycle.

### Saving a preset cannot brick it either

**save parameters** writes volatile memory into the active preset slot using the
module's own save routine — the same code path the module uses when you save from
the front panel. An editor cannot write to preset storage by any other route;
there is no opcode that writes arbitrary bytes to flash.

What you *can* do is **overwrite a preset you wanted to keep**. That is data loss,
not damage, and it is permanent only because eowave publish no factory preset
file. Back up all 8 presets to files before you start — see
[the editor](editor.md#backing-up). This is the one genuinely irreversible thing
in normal use, and it is entirely preventable.

One behaviour to know: **save always targets the currently active preset.** There
is no "save as". To write preset 5 you must recall preset 5 first, and recalling
discards unsaved edits. So the safe order is: recall the slot you intend to
overwrite, *then* make your edits, then send, then save.

### A failed firmware update cannot brick it

**Firmware is not updated over MIDI.** There is no SysEx command that writes
firmware, so nothing an editor sends can corrupt it.

Updates use the RP2040's **built-in bootloader**, which lives in read-only ROM on
the chip. It cannot be erased or overwritten by anything you do. That means:

- If an update is interrupted — the cable is pulled, the power drops, the file is
  corrupt — the application firmware may be incomplete, but **the bootloader is
  untouched**.
- You recover by entering the bootloader again and repeating the drag-and-drop
  with a good `.uf2` file.
- A module that appears dead after a failed update should still enumerate as the
  `RPI-RP2` USB volume when you enter the bootloader. If it does, it is fine.

This is the standard property of every RP2040-based module, and it is why UF2
updates are considered safe.

`TODO(verify)`: **the exact button and procedure for entering the bootloader.**
The official manual gives it once, in its final section: hold the **left button
(▼)** and power the rack up while holding, then release once the `RPI-RP2` volume
appears. That is the only place either button is mentioned in the entire manual,
and it does not say how long to hold, or whether the button must be held until
the volume mounts. **Test:** with the rack off and USB connected, hold the left
button, power up, and note whether the volume appears immediately or only after a
delay, and whether releasing early aborts it. See
[on-module controls](on-module.md).

### What is not covered by any of this

Ordinary hardware care still applies, and none of it is specific to Portail:

- **Patch with the case powered off** when connecting the ribbon cable. The red
  stripe goes to −12 V. Portail has reverse-polarity protection, so a backwards
  cable will not destroy it, but other modules in your case may not be so
  forgiving.
- **Do not feed voltage into an output.** Portail's jacks are outputs, not
  inputs. Patching another module's output into a Portail output is the one
  everyday mistake that could cause real damage.
- **Do not send the undocumented calibration commands.** Three SysEx calibration
  opcodes exist and no editor exposes them. One of the three is not even
  implemented in the firmware. Their payload formats are unknown, and a
  mis-formed calibration write is the one plausible way to leave the outputs
  producing wrong voltages with no documented way back. See
  [Appendix: SysEx notes](appendix-sysex.md). If you think your module needs
  calibration, contact eowave.

### If it is unresponsive right now

1. **Power-cycle the rack.** This clears volatile memory and reloads the stored
   preset. It fixes anything caused by a bad configuration send.
2. **Check the preset.** A preset in which every output is `OFF` looks exactly
   like a dead module. Connect an editor and read the configuration back.
3. **Enter the bootloader.** If it mounts as `RPI-RP2`, the hardware and the
   bootloader are healthy and you can reflash.
4. If it does not power up at all, that is a power problem, not a configuration
   problem — see
   [the module shows no sign of life](#the-module-shows-no-sign-of-life).

---

## Nothing works

### The module shows no sign of life

No LEDs, no response to anything.

- **Check the ribbon cable.** Red stripe to −12 V at both ends. The module has
  reverse-polarity protection, so a backwards cable will not damage it — it just
  will not start.
- **Check the cable is fully seated** on both the module and the bus board. A
  partly-seated 10-pin header is easy to miss.
- **Check your case has capacity.** Portail draws 110 mA on +12 V. A full case on
  a marginal supply may not start a new module.
- **Try a different bus board slot.**

### The module powers up but nothing responds to MIDI

- **Wrong cable type on TRS.** Portail's TRS input is **Type A**. A Type B
  adapter passes nothing. This is the most common single failure with hardware
  MIDI sources. Test by connecting over USB instead — if USB works, it is the
  adapter.
- **The source is not transmitting.** Many devices have MIDI output switched off
  by default, or send only on a channel you are not listening to.
- **The wrong preset is loaded.** A preset in which everything is `OFF` behaves
  exactly like a dead module. Connect the editor and read back what is actually
  configured.

---

## Notes and pitch

### A note plays but the pitch is wrong

- **The oscillator's 1 V/oct input is attenuated.** Many oscillators have an
  attenuator on the pitch input; it must be at maximum for correct tracking.
- **You are on the wrong octave.** Portail numbers middle C as `C3`. If your
  keyboard calls it `C4`, everything is an octave from where you expect.
- **An FX slot is transposing.** Check the FX slots for
  [Transpose](fx/transpose.md), [Accumulate](fx/accumulate.md) or
  [Microtonal](fx/microtonal.md) pointed at that output.
- **The module needs calibration.** If tracking is close but drifts over several
  octaves — right at C3, noticeably flat at C6 — that is a scaling error rather
  than an offset. See [Specifications → calibration](specifications.md#calibration).

### The pitch tracks but intervals are compressed or stretched

A scaling error. One octave should be exactly 1.000 V. Measure C3 and C4 on the
jack with a multimeter: if the difference is not 1.000 V, the problem is
Portail's calibration or the oscillator's. Test the oscillator with a known-good
CV source first.

### A note is stuck on

A note-off that never arrived. Common when a MIDI cable is unplugged mid-note, or
a DAW is stopped abruptly.

- **Play and release the same note again** on the same channel. That usually
  clears it.
- **Send an All Notes Off** from your DAW or controller if it has the option.
- **Power cycle the module** as a last resort.

To make it less likely: with **Retrigger** `on` on the gate, and a sequencer that sends
reliable note-offs, stuck notes are rare. DAWs stopped with the spacebar
mid-phrase are the usual cause.

### Some notes do not play at all

- Low note** and **High note** on the Note output** are filtering them. Check the output.
- **A [Note filter](fx/note-filter.md) FX slot** is pointed at that
  output.
- **[Chance](fx/chance.md) is dropping them.** Its default probability is
  low, so a freshly added Chance can silence most of a part.
- **Polyphony ran out.** With three CV outputs in a group and a four-note chord,
  one note is stolen. See [Recipes → poly synth](recipes/poly-synth.md#voice-stealing).

### All the voices in a poly group play the same note

They are not actually in the same group. Check each CV output's **Voice mode** — any row
set to a `mono` option takes every note independently.

---

## Gates and triggers

### A gate output does nothing

- Trigger source** is pointing at an unused CV output.** Gate mode defaults to
  **Trigger source** `CV 1`. If CV 1 is `OFF`, the gate never fires. Either configure CV 1 or
  set **Trigger source** to `Note`.
- **Wrong channel**, if **Trigger source** is `Note`.
- **The output is `OFF`.**

### A trigger fires but the module downstream ignores it

- **The pulse is too short.** Raise **Length** from 5 ms to 10 ms. Some inputs need
  more.
- **The voltage is too low.** Check **Level range**. A module with a 5 V trigger threshold
  will not reliably fire from a 3 V pulse.
- Velocity sensitive** is on and the velocity is low.** A soft note produces a low
  voltage. Set **Level min** to put a floor under it — see
  [Recipes → velocity to VCA](recipes/velocity-vca.md#when-almost-nothing-is-a-problem).

### Triggers are missed at fast tempos

**Length** is too long. A 50 ms trigger at 1/32 notes is still high when the next
one is due. Keep **Length** below about a third of the interval between pulses.

### Every note is the same volume

- Velocity sensitive** is `Off`** on the gate.
- **Your controller sends fixed velocity.** Many have a velocity curve setting
  with a "fixed" option.
- **The VCA has its own gain turned up**, so it is already open before the gate
  arrives.

### There is a click at the start or end of notes

Add **Rise** and **Fall** of 5–15 ms on the Gate output. A gate driving a VCA
directly always clicks without them.

---

## Clock and timing

### A clocked mode does nothing

- **`clock state` is `stop`** in the global settings. With the clock halted,
  every clocked mode is silent.
- **`clock source` is `External` and nothing is sending MIDI clock.** Many
  devices have clock output switched off by default.
- **`clock source` is `Internal` when you wanted to follow something.**

### Everything runs at the wrong speed

Check **Clock division** on the output. If it is four times too fast you are on `1/16` where
you want `1/4`.

Establish the reference first: set **Clock division** `1/4` and confirm one pulse per beat
against your master. Then work outward from there.

If no **Clock division** setting gives the right speed and your sequencer wants 24 PPQN, see
[Recipes → clocking](recipes/clocking.md#the-ppqn-problem).

### A sequencer drifts out of phase over several minutes

You have no reset cable, or its input is not connected. A step sequencer keeps
its position across transport stops and will accumulate offset. Add a
[Clock](modes/clock.md) output with **Trigger source** `reset`.

### The sequencer does not return to step 1 when I press play

- **The reset output is set to `Start/stop` rather than `Reset`.**
- **Reset on continue is `Off`** and your device is sending Continue rather
  than Start. Turn it `On`. See
  [Recipes → clocking](recipes/clocking.md#reset-on-continue).

### Everything is in time but the feel is wrong

Check **Swing** is `OFF` on the clock output. Swinging the master clock swings
everything downstream.

---

## Modulation

### An aftertouch output never moves

- **Your keyboard does not send aftertouch.** Most do not. Check its
  specifications before suspecting the module.
- **It sends it but has it disabled.** Many controllers have an aftertouch
  on/off setting.
- **You configured [Poly aftertouch](modes/poly-at.md) but the keyboard sends channel
  aftertouch**, or the reverse. They are different messages. Try
  [Aftertouch](modes/at.md) first — it is far more common.
- **Poly aftertouch's **Trigger source** is set to a note you are not playing.** It tracks one
  specific note number.

### A MIDI CC output steps audibly

Raise **Slew**. 128 values across 10 V is 78 mV per step, which is audible on a
filter cutoff. See [MIDI CC](modes/cc.md#slew).

### The pitch wobbles when I move the mod wheel

CC#1 sets vibrato depth on every [Note](modes/note.md) output on the same
channel, whether you patched it or not. Set **Vibrato rate** to `OFF` on the Note rows,
or move your modulation to another CC.

### An LFO output is not in time with anything

LFO uses a different division list from Clock, starting two steps slower. Check
you have not selected `32/1` or `16/1` when you meant something faster. See
[LFO](modes/lfo.md#clock-division).

---

## FX

### An FX slot appears to do nothing

In order of likelihood:

1. **The destination output is in the wrong kind of mode.** Note FX
   FX slots only affect CV outputs running `Note`, `Arpeggiator`, `Sequencer` or `Random`.
   Pointing [Scale](fx/scale.md) at an output running `LFO` does nothing
   at all.
2. **Its default is a no-op.** Several FX slots default to doing nothing:
   [Scale](fx/scale.md) defaults to `chromatic`,
   [Transpose](fx/transpose.md) to zero,
   [Random octave](fx/random-oct.md) to `0%`,
   [Note filter](fx/note-filter.md) to the full range,
   [Logic](fx/logic.md) to ANDing an output with itself.
3. Target** points at the wrong output.**
4. **The result is not audible.** [Random velocity](fx/random-vel.md) needs the
   destination to be velocity-sensitive; [Random trig length](fx/random-trig-length.md)
   needs something downstream that cares about gate length.

### Two FX slots on the same output give the wrong result

They chain in **slot order**, lowest first — not in the order you configured
them. Quantise-then-randomise and randomise-then-quantise give opposite results.
See [the ordering section](fx/index.md#ordering-with-a-worked-case).

### A CC map slot stopped working

**You changed the destination output's mode.** Mappings are bound to the output's
current mode, and changing **Mode** deletes any mapping into that output, because the
parameter no longer exists. Configure modes first, mappings second.

---

## Editor and presets

### The editor cannot see the module

See [the editor](editor.md#if-the-editor-cannot-see-the-module) for the full
list. In short: use Chrome, grant the MIDI permission, close any DAW that has the
port open, and reload the page after replugging USB.

### My settings disappeared when I powered off

You sent them but did not save them. **update all parameters** writes to volatile
working memory; **save parameters** writes to the preset slot. You need both.

### My settings disappeared when I changed preset

Selecting a preset overwrites working memory immediately, without warning. Any
unsaved changes are gone. Save before switching.

### I overwrote a factory preset

There is no published restore file, so unless you backed it up it is gone. Back
up the remaining presets now, before it happens again — see
[the editor](editor.md#backing-up).

### The editor shows values that do not match what I hear

You edited without reading first. An editor starts with defaults, so sending
overwrites all 24 rows with whatever was on screen. Always read the module's
configuration before changing anything.

---

## Still stuck

Check whether what you are trying to do is one of the things that is not
actually confirmed to work — [unverified.md](unverified.md) lists every claim in
this manual that has not been checked against a primary source, along with the
test that would settle it.
