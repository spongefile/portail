# Specifications

The official manual contains no specifications table. Everything here is sourced
from the eowave product page, the manual's introduction, or the editor's source,
and each figure says where it comes from.

---

## Physical and electrical

| | | Source |
|---|---|---|
| Width | 5 HP | Product page |
| Depth | `TODO(verify)` | Not published. **Measure** the module from the back of the panel to the furthest rear component, including the seated power header |
| Current, +12 V | 110 mA | Product page |
| Current, −12 V | 20 mA | Product page |
| Current, +5 V | 0 mA | Product page |
| Power connector | 10-pin Eurorack IDC, red stripe to −12 V | Official manual |
| Reverse polarity protection | Yes | Official manual |
| Processor | RP2040 | Inferred — the bootloader presents as `RPI-RP2` |

---

## Outputs

| | CV bank | Gate bank |
|---|---|---|
| Count | 8 | 8 |
| Labelled | CV 1 – CV 8 | GATE 1 – GATE 8 |
| Resolution | 16-bit | 12-bit |
| Voltage range | −5 V to +10 V | 0 V to +10 V |
| Polarity | Bipolar | Unipolar |
| Step size at full range | about 0.23 mV | about 2.4 mV |

Voltage ranges are from the official manual's introduction: "CV outputs provide
16 bit CV allowing for v/oct tracking between −5 and +10V" and "Gate outputs outputs
CV are 12 bits and unipolar between 0 and 10V".

The per-mode **Level range** menus are consistent with this — the CV list runs from
`10 V` down to `-5 V`, the Gate list from `10 V` down to `1 V`.

`TODO(verify)`: the actual minimum and maximum a CV output can produce, as
opposed to the menu options. The menus offer nothing between `+/-5 V` and `10 V`,
so whether a single mode can span the full −5 V to +10 V at once is unclear.
**Test:** set a CV output to `Note` with no FX slots, and play the lowest and
highest notes your oscillator tracks while measuring the jack.

`TODO(verify)`: output impedance and short-circuit protection. Not published.

`TODO(verify)`: whether the outputs are DC-coupled across their full range and
what the settling time is. Relevant if you plan to use a CV output at audio
rates. **Test:** set a Gate output to `LFO` with **Waveform** `square`, **Clock division** `1/32`,
raise the tempo to maximum, and look at the edges on a scope.

---

## MIDI

| | |
|---|---|
| USB | USB-C, class compliant, appears as `Portail`. No driver needed |
| TRS MIDI in | 3.5 mm, **Type A** |
| MIDI out | See below |
| Channels | 16, assigned per output |
| Clock | Internal 30–250 BPM, or external MIDI clock over USB or TRS |

**A Type B cable will not work.** If your controller has a 5-pin DIN output you
need a DIN-to-TRS-Type-A adapter. This is the most common single failure with
hardware MIDI sources.

### The MIDI output question

`TODO(verify)`: **whether the module has a MIDI output at all.**

The official manual's global settings describe an **Active midi out copy**
option: "All MIDI messages received at the USB or MIDI IN port are passed
directly to the MIDI OUT port on the back of the module."

But no connector list anywhere — not the manual, not the product page —
mentions a MIDI output. The product page lists "usb C and midi trs input" only.
The editor does have a working `midi_copy` global parameter, so the *feature*
exists in firmware.

Either there is an undocumented rear connector or header, or the feature is
inherited from another design and does nothing.

**Test:** look at the back of the module for a header or connector besides the
power socket. Then enable **Active midi out copy** in the global settings, save,
and probe any candidate connector while sending MIDI in.

---

## Configuration

| | |
|---|---|
| Preset slots | 8, non-volatile |
| Outputs per preset | 16, plus 8 FX slots, plus globals, plus 32 CC mappings |
| Configuration method | Web editor over USB SysEx, plus reduced on-module controls |
| SysEx manufacturer bytes | `0x06 0x29` following `0xF0` |
| Backup format | Plain text, semicolon-separated |

The official manual says "up to 16 configuration preset" in one place and "8
preset" in another. It is 8 — see [audit §2](audit.md).

See [Appendix: SysEx notes](appendix-sysex.md) and `spec/protocol.md`.

---

## Calibration

The module has calibration routines. The official manual never mentions them.

The editor's SysEx command set defines three:

| Command | Value | Name in source |
|---|---|---|
| Calibration | 12 | `SYS_SET_CALIB` |
| Calibration 2 | 13 | `SYS_SET_CALIB2` |
| DAC calibration | 15 | `SYS_SET_CALIB_DAC` |

`TODO(verify)`: **what these do, how to invoke them, and whether the shipped
editor exposes them anywhere.** No control in the captured editor sends any of
the three. There is no documented user-facing calibration procedure.

### Whether yours needs calibration

Before worrying about it, measure. An uncalibrated output shows up as a tracking
error that grows with pitch.

1. Set a CV output to `Note`, **Channel** `ch 1`, no FX slots.
2. Play `C3` and measure the jack with a multimeter. Write it down.
3. Play `C4`. The reading should be **exactly 1.000 V higher**.
4. Play `C5`, `C6`. Each should be another 1.000 V.

A consistent offset — every note high or low by the same amount — is harmless
and is corrected by your oscillator's tune control.

A **growing** error — right at C3, 30 mV out at C4, 90 mV out at C6 — is a
scaling error, and that is what calibration fixes. Check the oscillator against
a known-good CV source first, because the error may be its.

If yours does need it, contact eowave. Do not send undocumented SysEx
calibration commands to a working module on guesswork.

---

## Firmware

| | |
|---|---|
| Update file format | `.uf2` |
| Bootloader | RP2040, presents as USB drive `RPI-RP2` |
| Bootloader entry | Hold the left button (▼) while powering up |
| Source of updates | The official eowave editor |

The version captured in `research/` is `usb-cv_3.uf2`.

`TODO(verify)`: how to read the running firmware version. The editor requests one
over SysEx (command 34) and displays it, so it is available once connected — but
the official manual never says where to look or what the current version is.

See [the editor](editor.md#firmware-updates).

---

## What is not published

Collected here because these are the questions people ask that no source
answers:

- Module depth in mm
- Output impedance, drive capability, short-circuit protection
- Clock resolution in PPQN
- Contents of the 8 microtonal tables
- The default CC map
- Factory preset contents
- Calibration procedure
- Whether a MIDI output connector exists
- The on-module button scheme

Each has a test attached where one is possible. See
[unverified.md](unverified.md).
