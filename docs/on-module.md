# On-module controls

Everything you can do without a computer.

**This is the least documented part of the module.** The official manual mentions
a button exactly once, in the firmware update procedure on its final page, and
never says what either button does in normal use — despite instructing you on
page 3 to "start using one of the 8 preset of the Portail". See
[audit §8](audit.md).

Both the **buttons** and the **LEDs** were read out of the firmware, so most of
this chapter is now confirmed rather than guessed — a reversal of the vendor
documentation, which describes neither. What the buttons do is settled; a couple
of timing details, and what the LED colours mean in the less-common states, are
the only things left for a hardware press-test, and each is marked and pointed at
[unverified.md](unverified.md).

---

## The hardware

| Element | Count | Confirmed by |
|---|---|---|
| Buttons | 2 | Firmware disassembly — a preset selector (up / down) plus a two-button save |
| RGB LEDs | 16, one per output | Firmware disassembly — WS2812 addressable RGB, one per CV and Gate output |
| Screen | None | Official manual: "we opted for a system that utilizes an external editor … rather than including an on-board screen" |

The LEDs are the module's whole visual display. They are **not** a per-mode
colour legend — there is no "Note is green, LFO is blue" mapping, and looking for
one is the reason the panel seems obscure. What they actually show is described in
[What the LEDs mean](#what-the-leds-mean) below, which is confirmed from the
firmware rather than guessed.

---

## The two buttons

The module has two buttons, and the firmware makes them a **preset selector plus a
save** — nothing more. This is the single most useful correction to the vendor
documentation, which calls them "menu and mode" and implies an on-module editing
menu. **There is no edit menu and no mode-cycling.** The firmware's button handler
does exactly three things: next preset, previous preset, and save.

The button behaviour below is **confirmed from the firmware** (version 0.83r).
The one thing that is *not* firmware-certain is the **▲/▼ silkscreen labels**: the
firmware only knows the two buttons as GPIO 23 and GPIO 22. The mapping to ▲
(up / GPIO 23) and ▼ (down / GPIO 22) is inferred from press direction and from
the official manual naming the bootloader button ▼. If your panel's arrows seem
reversed, swap ▲ and ▼ in the table — the *actions* are certain, only which
physical button is which is inferred.

### Gesture reference

| Gesture | What it does | Status |
|---|---|---|
| **▲ short press** (right / GPIO 23) | **Active preset + 1.** Recalled immediately. Wraps from 8 back to 1. | **Confirmed** (firmware 0.83r) |
| **▼ short press** (left / GPIO 22) | **Active preset − 1.** Recalled immediately. Wraps from 1 back to 8. | **Confirmed** (firmware 0.83r) |
| **▲ + ▼ together, then release** | **Saves the active preset to flash**, overwriting it. Identical to the editor's **save parameters**. | **Confirmed** (firmware 0.83r) |
| **▼ hold, then power up** | Enters the RP2040 bootloader — the module mounts as the USB drive `RPI-RP2` for a firmware update. See [the editor](editor.md#firmware-updates). | **Confirmed** (official manual + firmware) |
| **▲ or ▼ held** (~2 s+) | Auto-repeats the preset step, so you can scroll through presets without repeated presses. | Inferred — repeat rate needs a press-test (OQ-3) |

Three things follow from this table, all confirmed from the firmware:

- **Recall is immediate.** A short press changes the active preset *and loads it*
  right away — there is no "select then confirm" step. The output configuration
  changes the moment you press. The **red** LED marker moves to the new preset's
  position (see [What the LEDs mean](#what-the-leds-mean)); the button-to-preset
  link and the LED-to-preset link independently agree in the firmware.
- **A panel save is exactly an editor save.** Both buttons together call the same
  flash routine as the SysEx save. It writes only the preset region, so like the
  editor's save it **cannot touch the firmware** — see
  [Can I break my module?](troubleshooting.md#can-i-break-my-module).
- **There is nothing else.** No long-press menu, no mode editor, no hidden
  two-button combos beyond save. If you were looking for a way to edit parameters
  on the module, there isn't one — that is what the editor is for.

---

## Selecting and saving presets on the module

Because the buttons are a preset selector plus a save, a complete workflow is
available with no computer at all:

1. **Step to the preset you want** with ▲ (up) and ▼ (down). Each press recalls
   immediately — you hear the change as you scroll. Hold a button to auto-repeat
   through the eight slots.
2. **Watch the red LED marker** to see where you are — recalling a preset lights
   one LED red. (Which LED corresponds to which of the 8 presets is confirmed to
   happen but not yet mapped; see [What the LEDs mean](#what-the-leds-mean) and
   [unverified.md](unverified.md).)
3. **To keep edits made in the editor**, press **both buttons together** and
   release. This saves the live configuration into the active preset, overwriting
   it — the same operation as the editor's **save parameters**, and it survives
   power-off.

The vendor's product page describes "a simple embedded editor" with "simple midi
learn assignations" on the module. **The firmware exposes no such thing.** The
only on-module actions are preset up, preset down, and save; all deeper
configuration — modes, parameters, CC map learning — is done in the editor. If a
future firmware adds an on-module editor, this section will need revisiting, but
version 0.83r has none.

---

## Running standalone

Once a preset is saved, the module runs it with no computer attached. USB is for
configuration only. Power the case on and the saved preset is active.

`TODO(verify)`: **which preset loads at power-on** — always slot 1, or whichever
was last selected. **Test:** select preset 3, power the case off and on, then
connect the editor and check which preset is reported as current.

---

## The two things still worth a press-test

The button *actions* are settled. Two timing details are inferred from the
firmware and would be confirmed by a minute with the hardware. Both are folded
into **OQ-3** in `spec/open-questions.md`; record anything you find in
[unverified.md](unverified.md).

- **Does a single press show the current preset before the next press moves it?**
  The firmware has a ~5-second gate that suggests the first tap after a pause
  might just *display* where you are. **Test:** leave the module untouched for ten
  seconds, then press ▲ once. If the preset does **not** change on that first
  press but the red marker lights, the first press is a "show". If it steps
  straight to the next preset, there is no show step.

- **How fast does hold-to-repeat scroll, and is there a second threshold?** The
  firmware has both a 2-second and a 5-second timer on the buttons. **Test:** hold
  ▲ and count how many presets pass per second, and whether the rate changes after
  a few seconds. Note the two rates if it does.

## What the LEDs mean

There is one RGB LED per output — 8 for the CV outputs, 8 for the Gate outputs.
Each one carries **two pieces of information at once**:

- **How bright it is** shows the output's **live level**. The LED glows in
  proportion to the voltage or gate the output is producing right now, like a VU
  meter. A silent output sits at a dim idle glow; a rising LFO, an open gate or a
  high note lights it up.
- **What colour it is** shows the module's current **state** — idle, activity, a
  recalled preset, and so on — laid over the brightness.

The colour is **not** tied to the output's mode. Two outputs both running LFO
look the same if they carry the same signal; two outputs in different modes look
the same if their levels match. So you cannot read an output's mode off its LED —
but you can read, at a glance, which outputs are doing something and what the
module as a whole is up to.

### The colour reference

| What you see | What it means |
|---|---|
| **Dim grey glow**, brightness barely above black | The output is **idle** — powered, configured, but producing no signal right now |
| **Brightness rising and falling** | The output's **live level**. Brighter is a higher voltage or an open gate. This is the VU-meter behaviour, layered under whatever colour is showing |
| **Blue** | **MIDI or clock activity** — the module is receiving MIDI, or a clock tick just arrived |
| **Red** on one LED | A **preset was just recalled**; red marks the preset's position |
| **White** | **Active / selected** — the output or item the panel is currently acting on |
| **Cycling through colours** | **MIDI-learn is armed** — each mapped slot lights its target as you assign CCs |
| **Green** | A **save or confirmation** just completed |

Brightness (live level), the blue/red/white/green/cycling palette, and the
addressable-RGB hardware are all confirmed from the firmware. The exact moment
each state colour appears, and the precise curve mapping voltage to brightness,
are not yet pinned down.

`TODO(verify)`: **the exact triggers for the yellow, cyan and warm-white palette
entries, and the value-to-brightness curve.** These colours exist in the
firmware's palette but the events that show them are not traced. This is tracked
as **OQ-15** in `spec/open-questions.md`, which gives a filming recipe: in a dim
room, record the LED column while powering up, recalling each preset, playing
sustained notes and a rising LFO, sending clock and start/stop, arming MIDI-learn,
and pressing each button — then read any unfamiliar colour off a single frame.
See [unverified.md](unverified.md).

### Using the LEDs to diagnose

Because brightness tracks the live level and blue tracks MIDI, the panel answers
two questions without a computer or a scope:

- **Is MIDI arriving?** If nothing goes blue while you play, the problem is
  upstream of Portail — a cable, a port, or a Type B TRS adapter. Several
  [troubleshooting](troubleshooting.md) entries start here.
- **Is an output actually producing anything?** A configured output that stays at
  the dim idle glow while you play is not receiving what it expects — wrong
  channel, wrong note filter, or a **Trigger source** pointing at an unused output.

The companion editor shows this same colour legend on screen, so the panel and
the app share one vocabulary.

---

## What you cannot do without a computer

The buttons do preset selection and save, and nothing else, so everything below
requires the editor:

- Setting a mode on an output, and its parameters
- Configuring FX slots
- Setting the tempo numerically, or the clock source
- Building CC map slots with specific **Low note**/**High note** scaling
- Backing up or restoring presets
- Reading the firmware version

The design intent is stated plainly in the official manual: the editor exists
because eowave chose to leave out a screen to keep the module at 5 HP and avoid
adding noise. The on-module controls are for recall and quick adjustments, not
for building patches.

---

## Contributing what you find

The button actions and the LED colour language are settled. What is left is small
and physical: the button auto-repeat rate, whether a first press shows before it
moves, the exact preset-to-LED mapping, and the triggers for the less-common LED
colours. If you run those press-tests, record what you see in
[unverified.md](unverified.md) and the last `TODO(verify)` markers on this page
can be retired.
