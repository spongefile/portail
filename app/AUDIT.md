# Audit — official eowave Portail editor

Source: <https://www.eowave.app/portail/>, captured to `research/original-editor/`
(`index.html` 902 lines + `js/{menu,notes,midi,mod_matrix,about,file,FileSaver}.js`, ~105 KB total,
unminified, unbundled, no build step). Read in full on 2026-08-26.

This document is the **feature-parity floor** for the replacement editor. Everything in
[§1](#1-what-the-official-editor-actually-does) must exist in the new app before any of it can
claim to be "better". [§2](#2-ux-failures) is the list of things the replacement must not repeat.
[§3](#3-sysextransport-findings) is raw protocol intel handed to the COORDINATOR, who owns
`spec/protocol.md` — the numbers below are transcribed from the shipped source, not invented.

---

## 0. The data model, as the original actually implements it

Worth stating up front because the marketing description ("16 assignable outputs") undersells the
structure and the replacement UI has to model it correctly.

The device config is **24 lines × 9 bytes**, plus globals, plus a mod matrix:

| Lines | Meaning | Type menu |
|------:|---------|-----------|
| `0–7` | CV outputs 1–8 (16-bit) | `menus["cv"]`, 15 entries |
| `8–15` | Gate outputs 1–8 (12-bit) | `menus["gate"]`, 14 entries |
| `16–23` | **FX slots 1–8** (MIDI-effect processors, not outputs) | `menus["fx"]`, 16 entries |
| `24` | 8 global parameters | — |
| `25` | *(overloaded — see §2.16)* 192-entry per-parameter CC map | — |
| — | `mod_matrix[32][6]` — 32 MIDI→parameter modulation rows | — |

Byte 0 of each line is the type; bytes 1–8 are that type's parameters, and **the meaning of bytes
1–8 changes completely with the type**. `menu_labels[<type name>]` gives the per-type label list and
`cv_select` / `gate_select` / `fx_select` give the per-parameter value enumerations. That is the
whole feature model, and it is the thing `spec/model.json` needs to capture.

So it is 8 CV + 8 gate = 16 physical outputs, but **24 configurable slots**, and a rack-like
"see everything at once" view needs to show all 24 plus the mod matrix.

---

## 1. What the official editor actually does

### 1.1 Output modes

**CV outputs (lines 0–7)** — 15 types, in menu order:
`OFF, NOTE, TRIG, CC, VEL, AT, POLY AT, PB, CLOCK, LFO, ENV, SEQ, RANDOM, ARP, CC RECORDER`

**Gate outputs (lines 8–15)** — 14 types:
`OFF, GATE, TRIG, CC, VEL, AT, POLY AT, PB, CLOCK, LFO, ENV, SEQ, RANDOM, EUCLIDEAN`

Note the asymmetry, which the product blurb hides: **ARP and CC RECORDER are CV-only; EUCLIDEAN is
gate-only.** CV `SEQ` uses the `seq` parameter set, gate `SEQ` uses a different one (`gate_seq`).
CV `RANDOM` (`random cv`) and gate `RANDOM` (`random`) likewise differ — 7 params vs 9.

Per-type parameter lists (from `menu_labels`), which is the real spec surface:

| Type | Parameters |
|------|------------|
| `note` | type, channel, out type, pb range, vibrato, glide, legato, min, max |
| `gate` | type, channel, source, range, vel sens, rise, fall, retrig |
| `trigger` (gate) | type, channel, source, note, length, vel sens, minimum, range |
| `cvtrigger` (CV) | type, channel, note, length, vel sens, minimum, range |
| `cc` | type, channel, number, range, filter |
| `vel` | type, channel, source, range |
| `aftertouch` | type, channel, range, filter |
| `poly_after` | type, channel, source, range, filter |
| `pitchbend` | type, channel, range, filter |
| `clock` | type, channel, source, div, length, range, swing |
| `lfo` | type, channel, waveform, speed, mode, range |
| `env` | type, channel, source, note, type, attack, decay, sustain, release |
| `seq` (CV) | type, channel, out type, base note, div, length, dir, glide, note in dest |
| `gate_seq` | type, channel, type, div, gate len, length, dir, range, note in dest |
| `cc_rec` | type, channel, number, div, length, glide, note, note in dest, range |
| `random cv` | type, channel, source, div, base note, range, smooth |
| `random` (gate) | type, channel, source, div, length, probability, rnd level, range, smooth |
| `euclid` | type, channel, div, gate len, steps, events, rotate, range |
| `arp` | type, channel, dir, range, div, hold, swing |

### 1.2 FX slots (lines 16–23) — 16 types

`OFF, NOTE FILTER, RANDOM OCT, RANDOM NOTE, CHANCE, ACCUMULATE, TRANSPOSE, SCALE, MICROTONAL,
DELAY, HUMANIZE, LOGIC, RANDOM VEL, RANDOM TRIG LENGTH, INVERT, REPEATS`

Each FX targets a destination output (`fx_dest_menu_cv` = CV 1–8, or `fx_dest_menu_gate` = GATE 1–8,
depending on the FX). Parameters per `menu_labels`, e.g. `scale` → dest, scale, root note;
`microtonal` → dest, scale tab (8 tables); `transpose` → dest, semitone (±63), octave (−4…+4).

**"Post FX" flag:** types with index ≥ `debut_post_fx` (= 9: DELAY, HUMANIZE, LOGIC, RANDOM VEL,
RANDOM TRIG LENGTH, INVERT, REPEATS) are stored on the wire with bit 5 set —
encode `wire = (type - 9) + 32`, decode `type = (wire & 0x1F) + 9`. So FX types 9–15 travel as
32–38. This is *the* encode/decode subtlety in the whole protocol and it is completely undocumented.

There is also a `debut_mod_fx = 32` and two FX types (`mod_lfo`, `mod_cc`) fully defined in
`menu_labels`/`fx_select` but **commented out of the shipped `menus["fx"]` list** — unreleased or
withdrawn features. Same for `conditional`, `modulate`, `vel vca`, `maths` (defined, not exposed).

### 1.3 Scales and value tables

- **24 scale tables** for the SCALE fx (`tables_menu`): chromatic, major, minor, harmonic minor,
  pentatonic major/minor, blues, dorian, phrygian, lydian, mixolydian, locrian, whole note,
  diminished, whole-half diminished, quint, octave, major/minor chord, major/minor 7th,
  major/minor 6th, minor dim 7.
- **8 microtonal tables** (`_1_8_menu`, "table 1".."table 8") — user tables, contents not editable
  in this editor.
- Voltage ranges: CV `+/-5V, 10V, 5V, 4V, 3V, 2V, 1V, -1V…-5V, note scale`; gate `10V…1V`.
- Clock divisions: 23 entries `4/1 … 1/32` incl. triplets (`T`) and dotted (`.`);
  LFO divisions: 25 entries starting `32/1`.
- Envelope times: 128-entry lookup, 2.1 ms → 134217.7 ms.
- Glide times: 128-entry lookup in ms/V (two tables present, `glide_times` and `glide_times2`;
  only `glide_times2`… neither is actually referenced by any `*_select` array — see §2.17).
- Swing: OFF, 55%, 60%, 75%, 80%, 90%.

### 1.4 Modulation matrix — 32 rows

Each row: `[midi_status, midi_value, destination_line, parameter_index, min, max]`.
Destination is any of CV 1–8 / GATE 1–8 / FX 1–8 / GLOBAL (26-entry `destinations` list).
Parameter choices are populated dynamically from the destination line's *current type*, and min/max
are drawn from that parameter's own value enumeration — so a mod row mapping to "NOTE → glide"
offers min/max in ms/V. That dynamic-dependency behaviour is genuinely good design and the
replacement must keep it.

**MIDI learn:** clicking a row's number button sends `SYS_SET_MAP_MODE(29)` with 1, arms the row,
and the next incoming Note or CC message (status `0x90–0x9F` or `0xB0–0xBF`) is captured into
columns 0–1. Row button blinks while armed.

### 1.5 Global parameters (line 24, 8 values)

| Idx | Parameter | UI control |
|----:|-----------|-----------|
| 0 | clock start/stop | checkbox |
| 1 | sync mode (external 0 / internal 1) | checkbox |
| 2–3 | tempo, 14-bit as MSB/LSB | range slider 30–250 BPM |
| 4 | MIDI out copy on/off | checkbox |
| 5 | reset on continue on/off | checkbox |
| 6 | global CC channel 1–16 | range slider |
| 7 | disable default MIDI mapping | checkbox |

Each has both a bulk write (`SYS_SET_CLOCK`, all 8) and an individual setter command.

### 1.6 Device operations

- **Request from portail** — reads all 24 lines + globals + 32 mapping rows + version + current preset.
- **Update all parameters** — writes all of the above to the module's working memory.
- **Save parameters** — writes everything, then `SYS_SAVE_ALL(7)` to burn to the current preset slot.
- **Preset dropdown, 8 slots** — selecting one issues `SYS_LOAD_PRESET(4)` and re-reads everything.
- **Per-line update button** — each row has a `CV n` / `GATE n` / `FX n` button that writes just that line.
- **Version display** — `SYS_GET_VERSION(34)` → `"version : <maj>.<min><char>"`.
- **Connection check** — `SYS_CHECK_CONNECTION(35)` ping/echo.
- **Save to file / load file** — semicolon-delimited text, `output.txt`.
- **Latest firmware** button — hardcoded link to `https://eowave.app/portail/usb-cv_3.uf2`.
- **MIDI activity LED** — a 12 px dot that flashes red for 200 ms on any incoming message, plus a
  `label1` div showing the raw comma-joined bytes of the last non-SysEx message.

### 1.7 Type-change defaults

`about.js` carries `default_cv_values`, `default_gate_values`, `default_fx_values` — sensible
starting parameters applied when you change a line's type (e.g. NOTE → `[0,1,0,0,0,0,127]`,
ENV → `[0,0,2,1,50,100,50]`). **These are the only "default" data in the product** and they are not
surfaced as "this parameter's default is X" anywhere in the UI. The replacement should expose them.

---

## 2. UX failures

Ordered roughly by how much damage each one does.

### 2.1 Selecting the MIDI port is mandatory, unexplained, and failing to do it breaks everything silently
The port `<select>` starts on `[select your interface]` with `value="null"`. Every transmit path does
`midi.outputs.get(port)` then `output.send(...)`. With `port === "null"` that is
`undefined.send(...)` → **TypeError, thrown into a click handler, invisible unless devtools is
open**. Every button on the page does nothing and the page reports nothing. There is no
auto-detection of the Portail, no "no device selected" state, no disabled-until-ready controls.
This is the single worst thing about the editor: the most likely first-run experience is a dead page.

### 2.2 No `.catch()` on `requestMIDIAccess` — the app dies silently in Safari and Firefox
```js
navigator.requestMIDIAccess({ sysex: true }).then(onMIDISuccess);
```
On Safari/Firefox `navigator.requestMIDIAccess` is `undefined` → `TypeError` at parse-eval time,
killing the rest of that script block. If the user **denies** the browser permission prompt, it's an
unhandled rejection. Either way: page renders, looks fine, is inert, says nothing. No browser-support
check, no permission-denied message, no instruction to use Chrome/Edge.

### 2.3 Connection state is not represented
There is no persistent "connected / not connected" indicator. `version_label` is blank until you hit
"request from portail"; the only failure text is `"lost connection !!"`. The check itself is a race:
```js
check_if_connected();          // sends ping, sets connected = 0
setTimeout(is_it_connected, 50);  // 50 ms later, assume the worst
```
A 50 ms window with no retry, on a bus that may be busy. False "lost connection" is expected
behaviour. And nothing ever clears the message once shown.

### 2.4 Every edit is transmitted immediately — there is no offline mode and no staging
`update_change()` fires SysEx on every `<select>` change. With hardware attached you are editing the
live module continuously, with no preview and no undo. With hardware *not* attached, every edit
throws (§2.1). There is no concept of "the config in the editor" vs "the config on the module", so
there is nothing to diff, nothing to review before committing, and no safe way to experiment.

### 2.5 Changing an output's type silently destroys its configuration *and* unrelated mod-matrix rows
```js
clear_mapping(row_select);
mem[row_select] = [current_line,0,0,0,0,0,0,0,0];
```
Change CV 3 from SEQ to LFO to see what LFO looks like, change back — your sequencer settings are
gone, and **every mod matrix row targeting CV 3 has been deleted**. No confirmation, no undo, no
warning that the mod matrix is affected. Irreversible, and easy to do by accident while exploring.

### 2.6 Zero undo/redo, zero persistence
No undo anywhere. No localStorage. Reload the page, or close the tab, or crash — the entire working
config is gone unless you wrote it to hardware or exported a file. Combined with §2.4 (edits go
straight to the device) and §2.5 (silent destruction), the editor has no safety net at any layer.

### 2.7 The preset dropdown is a loaded gun
Changing the dropdown immediately calls `load_preset()`, which tells the module to load that preset
and then re-reads everything into the editor — **discarding all unsaved edits, with no
confirmation**. The same dropdown also designates the destination for "Save parameters". So one
control means both "navigate to slot N" (destructive to editor state) and "burn to slot N"
(destructive to device state), and there is no visual distinction between the two roles.

### 2.8 "Save parameters" vs "save to file" — adjacent buttons, wildly different consequences
"Save parameters" burns the config into the module's flash at the currently selected preset slot.
"save to file" writes a `.txt` to disk. They sit next to each other in the toolbar with no icon, no
grouping, and no confirmation on the destructive one. Nothing tells you which preset slot
"Save parameters" is about to overwrite.

### 2.9 A giant unlabeled floating button overwrites your module
```css
.top-left-corner { position: fixed; top: 10px; right: 10px; width: 70px; height: 70px;
                   border-radius: 50%; font-size: 48px; z-index: 1000; }
```
```html
<button class="material-symbols-outlined top-left-corner">upload</button>
```
A 70 px circular button pinned over the top-right of the page (the class name says left; it is
right), labeled only with a Material Symbols "upload" glyph — which renders as the literal **text
"upload"** until the Google Fonts stylesheet loads, and permanently if you're offline or the CDN is
blocked. Its click handler is `update_all()` — write the entire editor state to the module. No
tooltip, no confirm, no label.

### 2.10 There is no way to see the whole module at once
CV / GATE / FX / MOD MATRIX / GLOBAL are Bootstrap tabs. You can see 8 of 24 slots at a time. To
answer "what is this module currently doing?" you must visit four tabs and hold it in your head.
For a 5 HP module whose entire value proposition is dense multi-output routing, this is the wrong
primary view.

### 2.11 Inline help is present but systematically wrong
`about.js` defines 14 help strings and `generate_line` attaches them as tooltips via
`title="'+about_select[type]+'"`. Three separate defects:
1. **Indexed by type but applied to every cell in the row** — all 9 parameters of a NOTE line show
   the same run-on paragraph describing all of them at once. No parameter has its own help.
2. **`about_select` has 14 entries; the CV menu has 15.** `CC RECORDER` (index 14) →
   `about_select[14]` → `undefined` → tooltip reads "undefined".
3. **Gate and FX lines index into a CV-specific table.** FX slot set to `NOTE FILTER` (index 1)
   shows `about_note` — a paragraph about pitch bend range and glide. Gate `EUCLIDEAN` (index 13)
   shows `about_arp`. The help is actively misleading, not merely absent.

Plus the text itself is unproofed: *"continious"*, *"gilde"*, *"deufault"*, *"amout"*, *"beeing"*,
*"valocity"*, *"smothing"*, *"sensivity"*, *"polyphonc"*, *"enveloppe"*, *"avalaible"*,
*"ocatves_menu"*. And one is semantically wrong: the note-filter help says *"the Highest note
**below** which midi notes will be ignored"* — it should be *above*.

### 2.12 No units, ranges, or defaults anywhere
Many parameters are bare integers from generated menus (`_127_menu`, `_100_menu`, `_64_menu`,
`_63_menu`, `bipolar_menu`). Envelope "sustain" is a number 0–100 with no `%`. "vibrato" is an index
into a frequency table. Nothing states a parameter's range or its default, even though
`default_cv_values` etc. exist in the source. You learn this module by trial and error against
hardware.

Several generated menus also leak their placeholder initialisers — `var _128_menu=[1,2]` is only
partly overwritten in `init()`, and `_63_menu`, `_127_menu`, `_100_menu`, `bipolar_menu`,
`delay_ms`, `_0_1_menu` follow the same pattern, so stray `1`/`2` entries can appear in dropdowns.

### 2.13 The MIDI monitor is a flashing dot
`blink()` turns a 12 px div red for 200 ms on any inbound message; `label1` shows the raw byte array
of the last non-SysEx message as unformatted comma-separated decimals (`145,60,100`). No note names,
no channel, no message-type decoding, no history, no clock/transport indicator, no filtering. You
cannot answer "is my keyboard even sending on channel 3?" without a separate tool — which is exactly
the question a MIDI-to-CV interface generates most often.

### 2.14 Sync is fire-and-hope: fixed timeouts, no acknowledgement, no flow control
```js
for (let i = 0; i < 24; i++) setTimeout(() => update_line(i), i * 5);
setTimeout(() => update_global(), 200);
for (let i = 0; i < 32; i++) setTimeout(() => sendMapping(i), i * 5 + 210);
setTimeout(check_if_connected, 450);
setTimeout(is_it_connected, 500);
```
56 SysEx messages sprayed at 5 ms intervals with **no ACK on any of them**. If the device's input
buffer overruns, or the host is busy, or a USB frame is dropped, some lines silently don't apply and
the editor still shows them as set. `request_all()` has the same shape — a partial read leaves the
UI showing a mix of device state and stale state with no indication which is which. There is no
retry, no sequence numbering, no checksum, no completion event.

### 2.15 The file format is unversioned, unvalidated, untyped, and named `output.txt`
Semicolon-separated integers, no header, no schema version, no device identifier, no checksum:
```
0;1;0;0;0;0;127;0;0
...
```
`convertTextFileToTable()` does `mem = dataArray` with **no validation whatsoever** — no line-count
check, no range check, no confirmation. Load a truncated file, a file from a future firmware, or any
unrelated `.txt`, and you get a corrupted config; out-of-range type bytes then index past
`note_labels` and throw inside `generate_line`. The download is called `output.txt`, so a folder of
patches is `output.txt`, `output (1).txt`, `output (2).txt`. Not diffable, not shareable, not
self-describing.

Separately, `readFromFile()` is dead code that registers a listener and only `console.log`s.

### 2.16 `mem[25]` is used for two incompatible things
`active_mapping()` writes a 192-entry per-parameter CC map into `mem[25]`. `convertTextFileToTable()`
reads mod-matrix rows from `mem[25+i]` for i in 0..31. Same index, two schemas. Loading a file after
touching CC-map mode yields garbage.

### 2.17 Whole features are shipped-but-unreachable, or defined-but-dead
- **The per-parameter CC map is orphaned.** `active_mapping()` is never called from any control, and
  it references `document.getElementById("map_button")` — **an element that does not exist in the
  DOM**. So `mem[25]`, the 192-byte map, `update_cc_mapping()`, the click-to-assign handler on
  `#parent-list`, and the Backspace-to-clear key handler are all unreachable code. A user-visible
  feature was cut without removing its plumbing, and the leftovers still fight with §2.16.
- `SYS_INIT_ALL(6)` — factory reset — is defined and never called from anywhere.
- Calibration commands (`12`, `13`, `15`) are defined and never called.
- `glide_times` / `glide_times2` (128 entries each, carefully computed) are referenced by no
  `*_select` array, so glide is presented as a raw 0–127 index (`off_127_menu`) despite the
  human-readable ms/V table sitting right there in the source.
- `menus["fx"]` has 4+ types commented out with their full parameter definitions left in place.
- `update_prm()` calls `navigator.vibrate(200)`.

### 2.18 Not keyboard accessible
Click handlers on `<div>` elements (`#parent-list`, mod matrix rows) with no `tabindex`, no `role`,
no keyboard equivalent. Custom controls have no focus styling. The MIDI-learn arm/disarm is
mouse-only. `.blinking` animation with no `prefers-reduced-motion` guard. No landmarks, no headings
structure beyond one `<h2>`, no labels associated with the generated selects (labels are sibling
`<div>`s, not `<label for>`).

### 2.19 Dim-studio readability is poor despite being a dark theme
Pure `#000` background with `text-warning` amber and `border-warning` hairlines; `form-select-sm`
dropdowns at ~0.8 rem holding 128-entry lists; `btn-dark` buttons on black with only a thin border
separating them from the background. Nine dropdowns per row × 8 rows, each 100 px wide
(`.my-cell { flex: 0 0 100px }`), truncating their own option text. No light theme. No text sizing.

### 2.20 Hard dependency on three CDNs; no offline use
Bootstrap CSS + JS from jsDelivr, Material Symbols from Google Fonts. A studio machine that isn't
online — a completely normal situation — gets an unstyled page with literal glyph-name text where
icons should be. For a tool whose entire job is talking to local hardware over USB, this is a
gratuitous external dependency (and a third-party request on every load).

### 2.21 Malformed HTML and a broken cache-buster
```html
<body onload="init();">
</head>
<body class=" bg-black">
```
A `<body>` inside `<head>`, then `</head>`, then a second `<body>`. It works only because browsers
auto-close `<head>` at the first `<body>`; the second `<body>` tag is discarded.
And:
```html
<script src="js/menu.js?v=<?= time() ?>"></script>
```
An unrendered PHP tag in a statically served file — `menu.js` is requested with the literal query
string `?v=<?= time() ?>`. Cache-busting silently does nothing.

### 2.22 Firmware delivery is a bare hardcoded link
"Latest firmware" points at a fixed `usb-cv_3.uf2` URL. No version comparison against the connected
module, no changelog, no checksum, no warning about what updating does to stored presets.

---

## 3. SysEx/transport findings

> **For the COORDINATOR** — `spec/protocol.md` is yours; this section is evidence, not a spec.
> Everything here is transcribed from `research/original-editor/js/midi.js` and the
> `analyse_midi_in()` switch in `index.html` (lines ~715–870). It is what the official editor
> *sends and expects*, which is strong evidence of but not proof of firmware behaviour.

### 3.1 Framing

```
F0 06 29 <cmd> [payload...] F7
```
`MSB_ADD = 6`, `LSB_ADD = 41` (0x29). Receive is gated on `data[0]==240 && data[1]==6 && data[2]==41`.

⚠️ **This is not a valid MIDI manufacturer ID.** `0x06` is not an allocated single-byte manufacturer,
and this isn't the `00 xx xx` three-byte form either. The device is squatting a two-byte prefix.
Consequence for us: any other device using the same prefix would be misparsed, so the replacement
must not assume every matching message is a Portail — treat the prefix as necessary, not sufficient,
and validate command byte and length before acting.

### 3.2 Command table (all constants from `midi.js`)

| Cmd | Name | Direction | Payload |
|----:|------|-----------|---------|
| 0 | `READ_GATE` / `REQUEST_GATE` | both | req: `<idx>` · reply: `<idx> <9 bytes>` |
| 1 | `WRITE_GATE` / `SET_GATE` | → dev | `<idx> <9 bytes>` |
| 2 | `READ_CV` / `REQUEST_CV` | both | req: `<idx>` · reply: `<idx> <9 bytes>` |
| 3 | `WRITE_CV` / `SET_CV` | → dev | `<idx> <9 bytes>` |
| 4 | `LOAD_PRESET` | → dev | `<slot>` (dropdown sends 1–8) |
| 5 | `GET_PRESET` | both | reply: `<slot0>`; UI shows `slot0 + 1` |
| 6 | `INIT_ALL` | → dev | none — **never called by the editor** |
| 7 | `SAVE_ALL` | → dev | none — burns working memory to current preset |
| 8 | `READ_FX` / `REQUEST_FX` | both | req: `<idx>` · reply: `<idx> <9 bytes>` |
| 9 | `WRITE_FX` / `SET_FX` | → dev | `<idx> <9 bytes>` |
| 10 | `SET_CLOCK` | → dev | 8 global bytes |
| 11 | `READ_CLOCK` | both | req: none · reply: 8 global bytes |
| 12 | `SET_CALIB` | → dev | **unknown — never called** |
| 13 | `SET_CALIB2` | → dev | **unknown — never called** |
| 14 | `RECEIVE_FILE` | → dev | **unknown — never called** (firmware upload?) |
| 15 | `SET_CALIB_DAC` | → dev | **unknown — never called** |
| 16 | `VIEW_FILE` | ? | **unknown — never called** |
| 17 | `SET_MIDI_COPY` | → dev | `<0|1>` |
| 18 | `SET_MAPPING` | → dev | `<row> 0 <type> <ch> <cc/note> <dest> <prm> <min> <max>` |
| 19 | `READ_MAPPING` | both | req: `<row>` · reply: `<row> <type> <ch> <val> <dest> <prm> <min> <max>` |
| 23 | `SET_TEMPO` | → dev | `<msb> <lsb>` (14-bit BPM) |
| 24 | `SET_START` | → dev | `<0|1>` |
| 25 | `SET_SYNC` | → dev | `<0|1>` |
| 26 | `SET_RESET` | → dev | `<0|1>` |
| 29 | `SET_MAP_MODE` | → dev | `<0|1>` — arms device-side MIDI-learn |
| 32 | `GLOBAL_CC_CH` | → dev | `<1..16>` |
| 34 | `GET_VERSION` | both | reply: `<major> <minor> <ascii char>` |
| 35 | `CHECK_CONNECTION` | both | req: `<0>` · reply echo |

Gaps (20, 21, 22, 27, 28, 30, 31, 33) are unassigned in the shipped source.

### 3.3 Transport quirks the spec must capture

1. **Request and reply share a command byte.** `READ_CV` request is `F0 06 29 02 <idx> F7` and the
   reply is `F0 06 29 02 <idx> <9 bytes> F7` — same command, distinguished only by length. A parser
   must discriminate on payload length, and a host echoing its own output back (MIDI thru, or the
   "MIDI out copy" global!) will be misread as a device reply. Worth flagging to eowave.
2. **Gate type byte is masked on receive:** `mem[v][0] = mem[v][0] & 0x0F`. Gates come back with
   high bits set for reasons the editor doesn't explain. Write path does *not* mask.
3. **FX post-fx bit** — see §1.2. Wire `32 + (n - 9)` for types 9–15, decoded `(raw & 0x1F) + 9`.
4. **FX read copies only 8 bytes, CV/gate copy 9** (`for (x=0;x<8;x++)` in the `REQUEST_FX` case vs
   `x<9` elsewhere). Almost certainly a bug in the editor — byte 8 of every FX line is dropped on
   read. **Needs hardware confirmation**: does the device send 9 or 8?
5. **Mapping write pads a zero at payload[1]** (`sysex[5]` is type, but `sysex[4]` is row and the
   write layout is `row, <unused 0>, ...` vs the read reply's `row, type, ...`). The write splits
   status into `type = value >> 4` and `ch = value & 0x0F`; the read reply recombines
   `data[5] << 4 | data[6]`. Asymmetric but consistent.
6. **No ACK on any write.** The only liveness signal is cmd 35.
7. **`update_cc_mapping()` sends a 192-byte payload under cmd 18**, colliding with the 8-byte
   per-row mapping format on the same command. Unreachable dead code (§2.17), but if firmware
   still accepts it, it is a footgun.

### 3.4 Blocking unknowns for real-hardware operation

- Does the device ACK writes at all, or is cmd 35 genuinely the only feedback?
- FX read length: 8 or 9 bytes?
- Why is the gate type byte masked with `0x0F` on read — what occupies the high nibble?
- `LOAD_PRESET` slot indexing: the dropdown sends **1–8**, but `GET_PRESET` reply is displayed as
  `data[4] + 1`, implying the device reports **0–7**. Off-by-one between load and report, unresolved.
- Calibration commands 12/13/15 — payloads entirely unknown.
- Commands 14/16 (file receive/view) — unknown, possibly firmware update transport.
- Maximum safe SysEx throughput — the 5 ms spacing is a guess with no basis in the source.

---

## 4. Parity checklist for the replacement

Everything below must exist before the new editor can claim parity. Tracked in `app/README.md`.

- [ ] 15 CV types × per-type parameter sets
- [ ] 14 gate types × per-type parameter sets
- [ ] 16 FX types incl. post-FX bit encoding
- [ ] 32-row mod matrix with type-dependent parameter/min/max population
- [ ] MIDI learn for mod matrix rows
- [ ] 8 global parameters incl. 14-bit tempo
- [ ] 24 scale tables, 8 microtonal tables
- [ ] Per-line write, read-all, write-all, save-to-preset, load-preset
- [ ] 8 preset slots
- [ ] Version query, connection check
- [ ] Type-change defaults from `default_*_values`
- [ ] File import/export (plus: versioned JSON, and import of the original `.txt` format)
