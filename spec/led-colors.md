# eowave Portail — LED Colour Language

**Spec version:** 1.0.0
**Source:** disassembly of the official firmware (`usb-cv_3.uf2`, v0.83r); reproduced by
`research/fw-analyse.py`.
**Companion data:** `spec/model.json → led_colors`.

Tags: **[confirmed from firmware]** (read from the image), **[inferred]** (reasoned, not proven),
**[unknown]** (needs hardware — see [Open question](#open-question-film-the-module)).

---

## TL;DR — the premise was wrong, in a useful way

The task asked for a **mode → colour** map so the editor's output cards could show the same colour
the panel LED shows for that mode. **That map does not exist.** [confirmed from firmware]

The Portail's LEDs are a **status-and-level display, not a mode indicator.** Each output's LED shows:

- **brightness = the live output level** (the CV/gate value is pushed straight into the LED — a
  VU-meter-style glow), and
- **colour = the module's current *state*** (idle, a selected preset, MIDI-learn, activity), applied
  as an overlay from a small fixed palette.

The output's **mode** (Note, LFO, Clock…) does **not** set its LED colour. So there is nothing
per-mode for the editor to match. What the editor *can* and *should* match is the **palette** and the
**state semantics** below, so panel and screen share one colour vocabulary.

---

## 1. Transport [confirmed from firmware]

| Property | Value |
|---|---|
| LED type | **WS2812 / SK6812-style addressable RGB**, one data line |
| Driver | RP2040 **PIO0**, canonical `ws2812.pio` program at flash `0x1000ea3c` (`6221 1123 1400 a442`, T1=2/T2=5/T3=3) |
| Colour depth | **24-bit, GRB order** (autopull threshold = 24; no white channel → WS2812, not RGBW) |
| Feed | **DMA** (channel 0) from a RAM framebuffer at `0x200036a0`, one 32-bit word per LED |
| Word format | `G<<24 | R<<16 | B<<8` (low byte unused; PIO sends the top 24 bits MSB-first) |
| Count | **16 — one LED per output** (8 CV + 8 Gate) [inferred, from the 8×(CV,Gate) refresh loop] |

The single blinking "MIDI" indicator in the official web editor is a *software* activity dot; it is
unrelated to these hardware LEDs.

## 2. The palette [confirmed from firmware]

Ten entries, in RAM at `0x20000ddc` (initialised from flash `0x100114e8`). All primaries are at
**half brightness** (`0x7f` = 127) — deliberately dim for a panel LED.

| Index | RGB | Hex | Name | Role (see §3) |
|---:|---|---|---|---|
| 0 | (0, 0, 0) | `#000000` | off | output idle / dark |
| 1 | (127, 0, 0) | `#7f0000` | **red** | selected preset marker; button/menu feedback |
| 2 | (0, 127, 0) | `#007f00` | **green** | confirmation / "saved" state |
| 3 | (127, 127, 0) | `#7f7f00` | **yellow** | (in palette; specific trigger [unknown]) |
| 4 | (0, 0, 127) | `#00007f` | **blue** | MIDI / clock activity |
| 5 | (0, 127, 127) | `#007f7f` | **cyan** | (in palette; specific trigger [unknown]) |
| 6 | (100, 85, 75) | `#64554b` | **warm white** | (in palette; specific trigger [unknown]) |
| 7 | (127, 0, 0) | `#7f0000` | red | duplicate of 1 |
| 8 | (5, 6, 7) | `#050607` | dim grey | very-low idle glow |
| 9 | (2, 1, 3) | `#020103` | dim | very-low idle glow |

Palette entries beyond index 9 are **not colours** — they hold single-byte values in the unused low
byte and are a separate brightness/animation ramp. [confirmed from firmware]

Two colours are also written as **literals** in the refresh code (not via the palette):

| Hex | RGB | Where |
|---|---|---|
| `#101010` | (16, 16, 16) | dim grey — **default idle** fill for an output LED |
| `#7f7f7f` | (127, 127, 127) | white — an "active/selected" fill |

## 3. What actually drives each LED [confirmed from firmware]

The refresh is a **layered compositor**. A pool of "layers" (`0x200034d8`, 6-byte entries:
`value`, `mask`, `colour-index`) is composited by priority into the framebuffer, then DMA'd out. The
layers, highest-value first:

1. **Live output level → brightness.** For each of the 16 outputs, the refresh takes that output's
   current value — CV outputs from the DAC value, Gate outputs from the runtime field at
   `runtime[out]+0x18` — and writes it into the LED's colour channel (`framebuffer[out] = value << 8`).
   **The LED glows in proportion to the signal the output is producing.** A silent output sits at the
   idle fill (`#101010`); a swinging LFO or a high gate lights it up.
2. **Preset selection = red.** Loading a preset writes palette index 1 (`#7f0000`) as a marker on the
   preset's LED position. [confirmed from firmware — in the `SYS_LOAD_PRESET` handler]
3. **MIDI-learn / mapping = cycling palette colours.** While mapping CCs, each mapped slot lights its
   target with an incrementing palette index. [confirmed from firmware]
4. **Button / menu feedback = red / white.** Front-panel button and menu actions flash `#7f0000` /
   `#7f7f7f` on the status position. [confirmed from firmware]
5. **MIDI / clock activity = blue.** Incoming MIDI and clock ticks drive a blue (index 4) fade using
   the ramp table. [inferred — blue ramp table + activity path]

**None of these is keyed on the output's mode.** Two outputs both set to `LFO` show the same colour
behaviour if they carry the same signal; two outputs in different modes show the same colour if their
levels match.

## 4. What this means for the editor and the manual

- **Do not colour the editor's output cards by mode "to match the hardware."** There is no such
  mapping; doing so would invent a language the panel does not speak.
- **Do adopt the palette as the shared status vocabulary.** Use these exact RGB values for status in
  the app so panel and screen agree: **red = selected preset**, **blue = activity**, **dim grey
  `#101010` = idle**, **white `#7f7f7f` = active/selected**, **green = saved**.
- **The most faithful "match the hardware" feature** is an optional per-output **level meter** on
  each card (brightness/opacity tracking the output value), which is what the LED actually does —
  not a static mode colour.
- **The manual's on-module chapter** ([open-questions OQ-3](open-questions.md#oq-3)) should describe
  the LEDs as a level-and-status display and list the palette meanings, not a per-mode legend.

## 5. Confidence

| Claim | Tag |
|---|---|
| WS2812 / PIO0 / 24-bit GRB / DMA framebuffer | confirmed from firmware |
| Palette values (indices 0–9) | confirmed from firmware |
| Brightness = live output level | confirmed from firmware |
| Preset = red; mapping = cycling; button = red/white | confirmed from firmware |
| Activity = blue | inferred |
| 16 LEDs, one per output | inferred (8×(CV,Gate) loop) |
| Exact trigger for yellow/cyan/warm-white; value→brightness curve; animation timing | unknown |

---

## Open question: film the module

The palette and architecture are settled. What remains — the exact state→colour triggers for the
less-common palette entries, the value-to-brightness curve, and the animation timings — is cheaper to
read off the hardware than to finish tracing. Recipe:

1. In a dim room, film the module's LED column while doing each of these, narrating as you go:
   - power-up (note the boot animation and idle colour of unused outputs);
   - load each preset 1–8 (note the marker colour and which LED it lands on);
   - play sustained notes / a rising LFO / a fast gate on a few outputs (confirm brightness tracks level);
   - send MIDI clock and start/stop (note the activity colour);
   - enter MIDI-learn and map a CC (note the colour cycle);
   - press each front-panel button and menu combination (note the feedback colour).
2. For any colour that isn't obviously red/green/blue, hold a phone camera close and read the RGB off
   a single frame, or compare against the palette swatches in `spec/model.json → led_colors.palette`.
3. Record findings back into `spec/model.json → led_colors.states` and upgrade the tags here.

This confirms the [inferred] rows and fills the [unknown] ones without any further disassembly.
