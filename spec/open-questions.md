# eowave Portail — Open Questions

The things about the Portail that no primary source settles, each written as a **self-contained test
recipe**: which tool, what to do, what to look for, and what each possible result would mean.

They are **ordered by how much they unblock**. Two remain marked 🔴 — they block a correct
implementation, so run those first. Nothing in this file may be stated as fact in the app or the
manual until the corresponding test has been run and its result recorded here.

Where the answers so far came from: the official editor's complete source, official manual V0.9 and
eowave's product page have been read end to end; the **firmware disassembly**
(`research/fw-analyse.py`) is the strongest source and is not exhausted — it has already resolved
four questions outright (OQ-1, OQ-5, OQ-9, OQ-14), disproved one confident editor-derived inference, and
reshaped several others. When a question below can be attacked statically, prefer that before
reaching for hardware: it is free, carries zero risk, and its findings are tagged
**[confirmed from firmware]** in `protocol.md`. (The image contains no application-level *strings* —
all labels live in the editor — but its *code* answers behavioural questions precisely.)

---

## Priority index

| # | Question | Status |
|---|---|---|
| [OQ-1](#oq-1) | Preset numbering | ✅ **Resolved from firmware** — recall 1-based, query 0-based |
| [OQ-5](#oq-5) | FX line width | ✅ **Resolved from firmware** — 8 bytes, not 9 |
| [OQ-2](#oq-2) | Bits 4–6 of the Gate mode byte | 🔴 blocks Gate round-trip |
| [OQ-3](#oq-3) | On-module button UI | 🟢 **Mostly resolved from firmware** — preset up/down/save |
| [OQ-4](#oq-4) | Does the official editor zero CC-map slot 0? | 🔴 sharp falsifiable prediction |
| [OQ-6](#oq-6) | Minimum inter-message gap; are writes acked? | 🟡 transfer strategy |
| [OQ-7](#oq-7) | MIDI Identity Request support | 🟡 safe auto-detect |
| [OQ-8](#oq-8) | Behaviour on an illegal `0x80` data byte | 🟡 severity of a known bug |
| [OQ-9](#oq-9) | 8 presets or 16? | ✅ **Resolved from firmware** — 8 |
| [OQ-13](#oq-13) | Sequencer step buffers | 🟡 **new** — unlocks a feature the official editor lacks |
| [OQ-10](#oq-10) | Undocumented opcodes | ⚪ **Closed** — app needs none; do not probe |
| [OQ-11](#oq-11) | SysEx over TRS MIDI in | 🟢 manual accuracy |
| [OQ-12](#oq-12) | Hidden FX types (Velocity VCA, Math) | 🟢 possible bonus features |
| [OQ-14](#oq-14) | Is opcode 6 a factory reset? | ✅ **Resolved from firmware** — yes; erases all 8 presets |
| [OQ-15](#oq-15) | LED colour language | ✅ **Mostly resolved from firmware** — state/level, not per-mode |

**Start with OQ-2 and OQ-4** — the two that still block work; neither risks the module. (OQ-3, the
on-module UI, is now mostly resolved from firmware — see [`protocol.md` §10](protocol.md#10-front-panel-buttons).)

---

## Before you start

### Tools

You need something that shows **raw SysEx bytes** and can **send arbitrary SysEx**. Any one of:

| Tool | Platform | Notes |
|---|---|---|
| **SysEx Librarian** | macOS | Free. Best for sending; pair with MIDI Monitor for receiving. |
| **MIDI Monitor** | macOS | Free. Receive-side companion to the above. |
| **MIDI-OX** | Windows | Free. Sends and receives in one window. |
| **Pocket MIDI** | macOS / Windows | Free, simplest option — one window, both directions. |
| **Chrome DevTools** | any | Open the official editor at `https://www.eowave.app/portail/`, press F12, Console tab. Its own `analyse_midi_in` already logs every inbound message. To send: `midi.outputs.get(port).send([0xF0,0x06,0x29,0x22,0xF7])`. |

Set your tool to display **hexadecimal**, not decimal. Every byte sequence in this file is hex.

### Connect

1. Power up the Portail in your rack.
2. Connect USB-C from the module to the computer.
3. The module appears as a MIDI device named **Portail**. Select it as both input and output.

### Back up first — every time

**Do this before every test session.**

1. Open the official editor at `https://www.eowave.app/portail/`.
2. Select **Portail** in the interface dropdown.
3. Click **request from portail**.
4. Click **save to file**. Keep the `.txt` somewhere safe.

To restore: **load file** → **update all parameters** → **save parameters**.

Note this only backs up the **currently active preset**. To back up all 8, repeat for each preset in
the dropdown. Run the tests below on a preset you don't mind losing.

### Recording results

When you get an answer, **edit this file**: change the status to ✅, write the result under the
question, and note the firmware version you saw. Then update `protocol.md` to replace the
`[unknown]` tag with `[confirmed on hardware, fw X.Y]`. That is what turns this document into a
finished spec.

Get your firmware version first, and note it — every result below is only valid for that version:

```
F0 06 29 22 F7
```
Reply is `F0 06 29 22 <major> <minor> <rev> F7`, where `<rev>` is an **ASCII character**.
So `F0 06 29 22 00 09 61 F7` means version **0.9a**.

---

<a id="oq-1"></a>
## ✅ OQ-1 — Is preset load 0-based or 1-based? — **RESOLVED**

**Answered by firmware disassembly (fw 0.83r). No hardware test needed.**

**Answer: recall is 1-based, the active-preset query is 0-based.** The protocol is genuinely
asymmetric, and **the official editor handles it correctly** — it sends 1–8 and displays `reply + 1`.

The recall handler is, in effect:

```c
n = msg[4];
if (n > 8) return;            /* silently dropped */
active_preset = (n - 1) & 7;  /* 1-based in, 0-based stored */
```

and the query returns the stored 0-based value.

| Sent to opcode `0x04` | Result |
|---|---|
| `1`–`8` | Recalls presets 1–8 |
| `0` | `(0 − 1) & 7` = `7` → **recalls preset 8** |
| `9`–`127` | Rejected; message ignored entirely |

**What changed because of this:** an earlier revision of `protocol.md` inferred an off-by-one *bug in
the official editor* from the JavaScript alone. **That inference was wrong.** The firmware shows the
asymmetry is in the protocol and the editor is correct. This is the clearest argument in the project
for keeping the `[confirmed from source]` and `[confirmed from firmware]` tags distinct — a
confident, reasonable reading of the client was simply not the truth about the device.

**Optional confirmation**, if you want it on real hardware: send `F0 06 29 04 00 F7`, then
`F0 06 29 05 F7`. It should report `07`.

---

<a id="oq-2"></a>
## 🔴 OQ-2 — What is in bits 4–6 of the Gate mode byte?

**Blocks:** any read-modify-write of a Gate output. **Risk:** none.

### Why it matters

The official editor masks the Gate mode byte with `& 0x0F` on receive, with the comment
*"pour les gate on remet de 0 à 15"* — it throws away bits 4–6. It does **not** do this for CV or FX.
If those bits carry state, an app that reads a Gate line and writes it back will destroy that state
silently.

### Test

For each Gate mode in turn, but especially the ones listed in step 3:

1. In the official editor, configure **Gate 1**, then click **update all parameters**.
2. Send `F0 06 29 00 00 F7` and record **byte 6** of the reply verbatim (the reply is
   `F0 06 29 00 00 <mode> <8 more> F7`, so `<mode>` is at offset 5, the 6th byte).
3. Repeat for these configurations, which are the likeliest to set a flag:
   - Gate 1 = `GATE`, **Trigger source** = `note` — then again with **Trigger source** = `CV 1`
   - Gate 1 = `GATE`, **Velocity sensitive** off — then on
   - Gate 1 = `TRIG`, **Length** = `latch` — then a fixed millisecond value
   - Gate 1 = `ENV`, **Trigger source** = `note` — then `CV 1`

**Look for:** any reply where the mode byte exceeds `0x0F`.

### What each result means

| Result | Meaning |
|---|---|
| Mode byte is always `≤ 0x0F` | The mask is defensive and harmless. App may ignore bits 4–6. **Record this and move on.** |
| Mode byte exceeds `0x0F` in some configurations | **New protocol.** Record the exact configuration that sets each bit. The app must preserve the whole byte on round-trip, and `protocol.md` §2.2 needs rewriting. |

**Result:** _(unrecorded)_

---

<a id="oq-3"></a>
## 🟢 OQ-3 — What does the on-module button UI do? — **mostly resolved from firmware**

**Answered by firmware disassembly (fw 0.83r).** See [`protocol.md` §10](protocol.md#10-front-panel-buttons)
for the full per-gesture table and handler addresses.

### What the firmware settles

**[confirmed from firmware]:**

- Two buttons — **GPIO 23 (▲)** and **GPIO 22 (▼)** — debounced (4-sample) in the main loop.
- **Short-press ▲ = active preset +1; short-press ▼ = active preset −1** (wrap 0–7), recalled
  immediately via the same routine as SysEx `0x04`.
- **Both buttons, then release = save the active preset to flash** — the same routine as SysEx `0x07`.
- **The buttons are a preset selector + save, NOT a menu/mode editor.** Despite the product page's
  "menu and mode" wording, no on-module edit menu or MIDI-learn-from-panel exists in this firmware.
- Every preset action lights the preset LED **red**, matching the LED map.
- **▼ held at power-up** takes a special firmware init branch; the `RPI-RP2` bootloader itself is
  RP2040 hardware BOOTSEL.

**The manual can now write the on-module chapter** from the §10 table. The old "we can't know without
hardware" gap is closed.

### The small residue that still wants a press-test

None of this blocks the manual; it's polish:

1. **Hold-to-repeat:** confirm holding ▲/▼ auto-scrolls presets, and time the repeat rate (firmware
   has 2 s and 5 s thresholds).
2. **First-press-shows vs changes:** a ~5 s gate hints the first press after idle may *display* the
   preset before the next press *changes* it. Press ▲ once after a long pause, read `F0 06 29 05 F7`,
   and see whether the number already moved.
3. **Save gesture feel:** confirm "press both, release" saves (watch for the red flash) without also
   nudging the preset, and note whether order/timing matters.
4. **▼-at-boot flag:** power up holding ▼ (without letting it reach BOOTSEL) and look for any
   behavioural difference (outputs not cleared, a diagnostic mode).

Run each with `F0 06 29 05 F7` after, to read the active preset.

**Result:** _(gesture map resolved from firmware; timing details unrecorded)_

---
<a id="oq-4"></a>
## 🔴 OQ-4 — Does the official editor zero CC-map slot 0?

**Blocks:** confidence in the CC map; possible upstream bug report. **Risk:** low — do not save.

### Why it matters

The official editor contains a second, older CC-mapping mechanism (`mem[25]`) that sends **192
payload bytes under opcode `0x12`** — the same opcode as the documented 13-byte per-slot write. It
fires whenever the user leaves "map mode".

The payload is predictable: the buffer starts as nine zero bytes, entries 9–191 are `undefined`,
and WebMIDI's `send()` converts `undefined` to `0` — so an untouched buffer transmits **192 zeros**.
**[confirmed from firmware]** the `0x12` handler reads a fixed 8 payload bytes and ignores the
rest, so the message should write exactly **one slot: slot 0, with every field zero** — an
"unused" mapping targeting CV 1.

**Falsifiable prediction:** toggling map mode in the official editor **zeroes CC-map slot 0** and
touches nothing else. If users had a mapping in slot 0, it silently disappears — a plausible
contributor to the mod-matrix complaints on ModWiggler.

### Test

1. Using the official editor, create **two** CC mappings (they occupy slots 0 and 1). Read both
   back and record them:
   ```
   F0 06 29 13 00 F7
   F0 06 29 13 01 F7
   ```
2. Click the **map** button to enter map mode, then click it again to leave. (In DevTools you
   should see one very long SysEx message go out.)
3. Re-read slots 0 and 1 and diff against step 1.
4. **Power-cycle the module** to discard the change. **Do not click "save parameters".**

### What each result means

| Result | Meaning |
|---|---|
| Slot 0 zeroed, slot 1 intact | **Prediction confirmed** — a real, specific data-loss bug in the official editor. Report upstream; the app must never send the 192-byte form. |
| Both slots unchanged | The firmware rejects the over-long message despite the disassembly reading — record it, and re-examine the handler's length handling. |
| Anything else | Record verbatim; the handler does something the disassembly missed. |

**Result:** _(unrecorded)_

---

<a id="oq-5"></a>
## ✅ OQ-5 — Does an FX read return 8 config bytes or 9? — **RESOLVED**

**Answered by firmware disassembly (fw 0.83r). No hardware test needed.**

**Answer: 8.** FX slots live in their own array with an **8-byte stride**, separate from the CV/Gate
array, which uses a 9-byte stride. The FX read handler copies 8 bytes and replies with 8; the FX
write handler stores 8.

| Family | Array | Stride | Line size |
|---|---|---:|---:|
| CV 1–8 | shared | 9 | 9 bytes |
| Gate 1–8 | shared (offset by 8 lines) | 9 | 9 bytes |
| **FX 1–8** | **separate** | **8** | **8 bytes** |

So an FX reply is **14 bytes**, not 15. The official editor writes 9 bytes to an FX slot and reads 8
back; the 9th byte it sends is simply never read, and no overrun occurs because the firmware copies a
fixed 8.

**What changed because of this:** the app must model FX lines as 8 bytes. Modelling all three
families as 9-byte rows — as the official editor does — is the root cause of this whole confusion.
`spec/model.json` never depended on the answer (no FX mode has more than 3 parameters), so no
regeneration was needed.

**[confirmed from firmware]** The FX write handler also masks the target field with `& 7`, so a
malformed target cannot address outside the 8 outputs of its domain.

---

<a id="oq-6"></a>
## 🟡 OQ-6 — What is the real minimum gap between messages, and are writes acknowledged?

**Blocks:** the app's transfer strategy. **Risk:** none.

### Why it matters

The official editor spaces messages **5 ms** apart on a fixed timer, with no acknowledgement and no
retries — and its own schedule has overlapping volleys. If the device needs more than 5 ms, the
official editor is already dropping writes. If it needs less, a full sync can be near-instant.

### Test

1. Write a distinctive, *different* value to all 8 CV lines as fast as your tool allows, with **no
   delay** between messages. Easiest distinctive value is the MIDI channel:
   ```
   F0 06 29 03 00 01 00 00 01 00 00 00 00 7F F7
   F0 06 29 03 01 01 01 00 01 00 00 00 00 7F F7
   ...   (byte 6 = 00..07 for CV 1..8)
   ```
2. Read all 8 back (`F0 06 29 02 00 F7` … `F0 06 29 02 07 F7`) and **count how many took**.
3. Repeat the whole thing at 1 ms, 2 ms, 5 ms and 10 ms spacing.
4. Separately: send a single write and watch the monitor for **any** inbound message.

### What each result means

| Result | Meaning |
|---|---|
| All 8 land with no delay | Device keeps up. App can sync fast; keep a small gap for safety. |
| Some drop below N ms | **N is the real minimum.** Record it. If N > 5, the official editor is unreliable and that is worth saying in the manual. |
| Step 4 produces a reply | **Writes are acknowledged.** Huge — the app can use a properly acknowledged queue instead of timers. Record the reply's exact layout. |
| Step 4 produces nothing | Writes are fire-and-forget, as expected. Verify by read-back instead. |

**Result:** _(unrecorded)_

---

<a id="oq-7"></a>
## 🟡 OQ-7 — Does the firmware answer a standard MIDI Identity Request?

**Blocks:** safe auto-detection. **Risk:** none.

### Why it matters

The official editor makes the *user* pick the right MIDI port, and because the Portail's message
prefix collides with Moog Music's registered manufacturer ID, a mis-selected port means writing
Portail configuration into someone's Moog. If the firmware answers the universal identity request,
the app can auto-detect the module and refuse to write anywhere else.

### Test

Send the universal (all-call) identity request:
```
F0 7E 7F 06 01 F7
```
Then try the device-specific form:
```
F0 7E 00 06 01 F7
```

**Look for:** a reply beginning `F0 7E <ch> 06 02`.

### What each result means

| Result | Meaning |
|---|---|
| No reply to either | Expected. The app falls back to the version handshake (`F0 06 29 22 F7`) as its detection gate — still much better than a port-name match. |
| A reply arrives | **Record every byte.** It gives a real manufacturer / family / model / version tuple, and becomes the app's preferred detection path. Also tells us whether eowave registered an ID after all. |

**Result:** _(unrecorded)_

---

<a id="oq-8"></a>
## 🟡 OQ-8 — What does the firmware do with an illegal `0x80` data byte?

**Blocks:** knowing how bad a known editor bug is. **Risk:** low.

### Why it matters

Four parameters are bound to a 129-entry value table and can emit index `128` = `0x80`, which is a
**status byte, not a legal SysEx data byte**. The affected parameters are CV `CLOCK` → Length,
Gate `CLOCK` → Length, Gate `SEQ` → Gate length, and Gate `EUCLIDEAN` → Gate length. The app will
clamp these to 127 regardless; this test only establishes how badly the official editor fails.

### Test

1. Try to send a Gate CLOCK write with Length = 128:
   ```
   F0 06 29 01 00 08 00 00 06 80 00 00 00 00 F7
   ```
   **Many tools will refuse to send this. That refusal is itself a valid finding — record it.**
2. If your tool does send it, immediately read the line back:
   ```
   F0 06 29 00 00 F7
   ```
3. Then send a known-good write and read it back, to check the parser is still in sync:
   ```
   F0 06 29 01 00 08 00 00 06 05 00 00 00 00 F7
   F0 06 29 00 00 F7
   ```

### What each result means

| Result | Meaning |
|---|---|
| Tool refuses to send | The bug manifests as "the editor silently does nothing at max Length". Mild. |
| Device ignores the message | Same practical effect. Mild. |
| Step 3 read-back is wrong or absent | **The parser desynchronises** — one bad message corrupts the next. Serious; means the official editor can corrupt an unrelated parameter. |

**Result:** _(unrecorded)_

---

<a id="oq-9"></a>
## ✅ OQ-9 — Are there 8 presets or 16? — **RESOLVED**

**Answered by firmware disassembly (fw 0.83r). No hardware test needed.**

**Answer: 8.** Manual V0.9 contradicts itself (its introduction says 16, its Getting Started section
says 8). The recall handler rejects any value above `8` and masks the stored index with `& 7`, so
**only 8 slots are addressable over SysEx** — there is no way to name a 9th in any message. The
manual rewrite should say 8; the "16" in the official introduction is wrong.

The one residual (folded into [OQ-3](#oq-3), not kept open here): whether the front-panel buttons
can reach anything the protocol cannot. Given the `& 7` mask sits on the *stored* index, extra
hidden slots would need a second storage path entirely — implausible, but OQ-3's button sweep will
notice if the panel ever shows more than 8.

### Test — optional confirmation only

```
F0 06 29 04 0F F7      (try to load slot 15 — should be rejected outright)
F0 06 29 05 F7         (what does it say is active?)
```

### What each result means

| Result | Meaning |
|---|---|
| Nothing changes | Confirms the disassembly. **Say 8 presets.** The manual's introduction is wrong. |
| Something changes | The disassembly was misread — re-run `research/fw-analyse.py` and re-examine the opcode `0x04` handler. |

**Result:** ✅ resolved statically, as above.

---

<a id="oq-10"></a>
## ⚪ OQ-10 — The undocumented opcodes — **closed; the app needs none of them**

**Blocks:** nothing. **Do not probe.**

The firmware implements 16 opcodes the official editor never uses. The disassembly already
established what the app needs to know, and **the app sends none of them** — they are excluded by
construction from the send-allowlist ([`protocol.md` §0.9](protocol.md#09-safety-model--can-the-module-be-bricked-over-midi)).

**There is nothing here to test.** Three of these opcodes are **memory-safety defects** (reported
privately to eowave — see [`protocol.md` §9.8](protocol.md#98-three-memory-safety-defects--opcodes-22-0x16-31-0x1f-36-0x24)
and [`SECURITY.md`](../SECURITY.md)); three others write to preset flash; the rest are unknown in
purpose. **Probing the undocumented opcode space is unnecessary and unsafe — don't.** If a future
feature ever seems to need one (e.g. sequencer-step editing, [OQ-13](#oq-13)), treat that as its own
carefully-scoped investigation, not a blind sweep.

The two safe, documented device operations the app *does* use — reading and writing the config,
recalling and saving presets — are covered by the confirmed opcodes in
[`protocol.md` §3](protocol.md#3-opcode-table).

**Result:** closed — no hardware probe recommended.

---
<a id="oq-11"></a>
## 🟢 OQ-11 — Does SysEx configuration work over the TRS MIDI input?

**Blocks:** one sentence of manual accuracy. **Risk:** none.

### Why it matters

Determines whether the app and manual can honestly say "configuration is USB-only", or whether TRS
is a supported path.

### Test

1. Connect a USB-MIDI interface's output to the Portail's **TRS MIDI in** (Type A). Leave USB
   disconnected, or at least don't send over it.
2. Send the version request through the TRS interface:
   ```
   F0 06 29 22 F7
   ```
3. Watch the Portail's **MIDI out** for a reply.

### What each result means

| Result | Meaning |
|---|---|
| Reply arrives | TRS configuration works. Note that at 31,250 baud each 15-byte message takes ~4 ms, so a full sync is slow but viable. Manual can mention it. |
| No reply | Configuration is USB-only. Say so plainly in the manual — it's a reasonable question a user will ask. |

**Result:** _(unrecorded)_

---

<a id="oq-12"></a>
## 🟢 OQ-12 — Do the hidden FX types work?

**Blocks:** nothing, but could unlock advertised features. **Risk:** low.

### Why it matters

eowave's product page advertises **Velocity VCA** and **Math operations** as available modifiers.
Both are fully defined in the editor's tables (`vel vca`, `maths`) but **commented out of the shipped
menu**, along with `conditional`, `modulate`, `mod_lfo` and `mod_cc`. If the firmware still
implements them, the app could expose features the official editor cannot.

### Test

Set up something observable first: CV 1 = `NOTE` on channel 1, CV 2 = `LFO`, and a scope or a VCO on
CV 1. Play a held note.

Then sweep the FX mode byte one value at a time through the gap between the note-domain and
gate-domain blocks:

```
F0 06 29 09 00 09 00 03 01 40 00 00 00 00 F7      (FX 1, mode byte 0x09)
F0 06 29 08 00 F7                                  (read it back)
```

Repeat with mode byte `0x0A`, `0x0B` … `0x1F`. After each write, read back and watch CV 1.

### What each result means

| Result | Meaning |
|---|---|
| Reads back as `00`, nothing happens | Mode not implemented. Expected for most values. |
| Reads back **unchanged** and CV 1 audibly changes | **A live hidden feature.** Record the mode byte and work out its parameter layout by varying bytes 7–9 one at a time. |
| The module misbehaves | Power-cycle. Record which value did it and stop sweeping. |

**Result:** _(unrecorded)_

---

<a id="oq-13"></a>
## 🟡 OQ-13 — Can the sequencer step buffers be read and written? — **new, from the firmware**

**Blocks:** nothing today. **Unlocks:** a feature the official editor does not have. **Risk:** low.

### Why it matters

The firmware implements four undocumented opcodes over a region with a **192-byte stride**, split
into two 64-byte halves ([`protocol.md` §9.4](protocol.md#92-the-sequencer-data-group--opcodes-27-37-38-39)).
64 is exactly the Portail's maximum sequence length. **[inferred]** these read and write **SEQ and
CC RECORDER step contents** — something the official editor cannot do at all.

If that is right, the replacement app could show and edit sequences directly, which is a substantial
capability the official editor lacks.

### Test

1. Set **CV 1** to `SEQ` with a length of 8 steps, and let it record some distinguishable values via
   CC 1–8 (per the manual's CC-per-step scheme).
2. Read the two halves for index 0:
   ```
   F0 06 29 27 00 F7      opcode 39 — base + 0*192
   F0 06 29 1B 00 F7      opcode 27 — base + 0*192 + 0x40
   ```
3. Change one step's value via its CC, then re-read and diff.

### What each result means

| Result | Meaning |
|---|---|
| A long reply whose bytes track the CC values you set | **Confirmed.** Record the layout — this becomes a real app feature and a manual section. |
| A reply that doesn't change when you change a step | Right region, wrong interpretation. Record it anyway. |
| No reply | These are write-only, or the index argument is elsewhere. Try index in `msg[5]`. |

**Result:** _(unrecorded)_

---

<a id="oq-14"></a>
## ✅ OQ-14 — Is opcode 6 a factory reset? — **RESOLVED**

**Answered by firmware disassembly (fw 0.83r), independently confirmed. No hardware test needed.**

**Answer: yes — `0x06` `SYS_INIT_ALL` restores defaults, re-serialises all 8 presets, and writes
them to the preset flash region.** It erases all 8 presets and touches nothing else; it cannot reach
code flash ([`protocol.md` §0.9](protocol.md#09-safety-model--can-the-module-be-bricked-over-midi),
[§9.6](protocol.md#94-individually-identified)).

**What this gives the project:**

- **The manual gains a documented recovery procedure** for a module whose configuration has become
  unusable: a full factory reset over SysEx (or, more safely for most users, re-flashing the `.uf2`).
- **The app must gate it behind an explicit, clearly-worded confirmation** — it is unrecoverable
  without a backup. It is on the deny-by-default list and only ever sent on deliberate user action.

If you want to see it in action anyway (with all 8 presets backed up): send `F0 06 29 06 F7`, then
re-read CV 1 and the active preset — they should return to defaults.

---

<a id="oq-15"></a>
## 🟢 OQ-15 — Exact LED state colours and level curve — **new, mostly resolved from firmware**

**Blocks:** the manual's LED description and an optional app level-meter. **Risk:** none.

### Why it matters

The firmware disassembly already established the **whole LED architecture** — see
[`spec/led-colors.md`](led-colors.md) and `spec/model.json → led_colors`. The headline is that the
per-output LEDs are a **state + live-level display, not a per-mode colour indicator**, so there is no
mode→colour map to mirror in the editor. Confirmed: WS2812 over PIO0, 24-bit GRB, a 10-entry primary
palette, brightness = output level, preset = red, mapping = cycling colours.

What is **not** settled statically: the exact trigger for the less-common palette entries (yellow,
cyan, warm-white), the value→brightness curve, and animation timings.

### Test — film it

In a dim room, film the LED column while doing each of the following, then read colours off single
frames (compare against `led_colors.palette` swatches):

1. Power-up — boot animation and the idle colour of unused outputs.
2. Load each preset 1–8 — marker colour and which LED it lands on.
3. Play a sustained note / rising LFO / fast gate on a few outputs — confirm brightness tracks level.
4. Send MIDI clock + start/stop — the activity colour.
5. Enter MIDI-learn and map a CC — the colour cycle.
6. Every front-panel button and menu combination — the feedback colour (ties into [OQ-3](#oq-3)).

### What each result means

| Result | Meaning |
|---|---|
| Brightness rises with signal level | Confirms the level-meter model. The app can mirror it as per-card brightness. |
| A palette colour maps to a specific state | Fill in `led_colors.states` and upgrade the tag in `led-colors.md`. |
| Colours don't match the palette | Re-check the byte order in `research/fw-analyse.py` against the frame. |

**Result:** _(unrecorded)_


# Behavioural questions

These are about musical behaviour rather than the wire protocol. None risk the device — you can
answer them by patching, playing, and listening. They mostly affect the manual's accuracy.

| # | Question | Status | How to settle |
|---|---|---|---|
| **B-1** | Do Note FX really only affect CV outputs in NOTE / ARP / RANDOM / SEQ modes? | 🟡 | Point a `SCALE` FX at a CV output set to `LFO`, then `CC`. Scope it. If nothing changes, the app should warn on that combination instead of silently allowing it. |
| **B-2** | Does MICROTONAL really always apply last, whatever slot it's in? | 🟡 | Put `MICROTONAL` in FX 1 and `TRANSPOSE` in FX 2, both targeting CV 1. Note the pitches. Swap the two slots. Identical result ⇒ order-independent, as the manual claims. |
| **B-3** | What are the 8 microtonal tables, and how do you edit them? | ✅ | **Resolved from firmware** — see [`microtonal-tables.md`](microtonal-tables.md). Format: 8 tables × 12 pitch-class values, 14-bit, unit = **cents**; expansion `octave*1200 + template[pc]`. **All 8 factory tables are identical 12-TET** — no exotic tunings ship; they are user slots. The table *writer* opcode is a firmware memory-safety defect, but the editor's Tuning tab writes it safely by rejecting any table slot outside 0–7 ([§9.8](protocol.md#98-three-memory-safety-defects--opcodes-22-0x16-31-0x1f-36-0x24)); the firmware bug is unfixed so disclosure stands. A *user-customised* module's tables live in device flash and can only be read off hardware. |
| **B-4** | What is the firmware's built-in "default CC map"? | 🔴 | Global byte 7 disables it, and the manual's only description is *"disable the cc control grid (see p#)"* — pointing at a page that was never written. Enable it, sweep CC 0–127 on the global CC channel, and log what moves. Or **ask eowave**. |
| **B-5** | Exact clock latency / phase offset. | 🟡 | ModWiggler users report the clock output's leading edge lagging the source. Scope a `CLOCK` output against the incoming clock and measure. The manual should quote a number. |
| **B-6** | `ACCUMULATE` — what do Amount and Reset actually do? | 🟡 | Manual V0.9 literally prints `Amount : ?` and `Reset : ?`. Set CV 1 = `NOTE`, add `ACCUMULATE`, play one note repeatedly and watch the pitch walk. Amount is presumably a per-note interval, Reset a note count. |
| **B-7** | `REPEATS` — is Amount a clock division and Repeats a count? | 🟡 | The manual says so, but both parameters have a `0–127` domain, which is not a division table. Test by ear against a running clock. |
| **B-8** | `CHANCE` — what does it actually do? | 🟡 | The manual's description is copy-pasted from RANDOM OCTAVE and talks about octaves. Vary Probability and Velocity-to-probability independently and observe which notes drop. Rewrite from observation. |
| **B-9** | Gate `RANDOM` — Probability vs Random depth. | 🟡 | Two percentage controls, one of which the manual leaves undefined. Sweep each with the other at zero. |
| **B-10** | What does `note scale` mean as a Level range? | 🟡 | Appears on CC and CC RECORDER. Presumably makes the output track V/oct so a `SCALE` FX can quantise it. Confirm with a scope and a tuner. |
| **B-11** | LFO waveform order — code and manual disagree. | 🟡 | **[confirmed from source]** the code order is `saw up, saw down, square, triangle, sine, noise, random`; the manual says `… Sine, Random, noise`. Scope each of the 7 indices. The code order is authoritative unless the scope disagrees. |

---

# Confirmed errors in official manual V0.9

Verified by reading the manual against the editor source. Listed here so none of them gets carried
into the rewrite.

| Where | Error | Correct |
|---|---|---|
| Introduction | *"It can stock up to 16 configuration preset"* | **8** — the same manual says 8 two sections later ([OQ-9](#oq-9)) |
| Note → Poly/Mono Group | *"mono high will prioritize the **lowest** midi note"* — identical to its own definition of "mono low" | Mono high prioritises the **highest** note |
| D-GATE FX list | Lists **EUCLIDEAN** as a Gate FX | Euclidean is a Gate output **mode**. There are **7** Gate FX, not 8 |
| LFO → Type | Waveform order given as `… Sine, Random, noise` | Code order is `… sine, noise, random` (B-11) |
| ACCUMULATE | `Amount : ?` and `Reset : ?` | Never written (B-6) |
| CHANCE | Opens *"Randomly changes the octave of the note being played"* — copy-paste from RANDOM OCTAVE. Parameter list says "Probability / Vel pro" but the body then defines "Range: select the octave range" | Rewrite from observation (B-8) |
| DELAY, LOGIC, ACCUMULATE | All three open with *"Randomly add a note interval to the note being played"* — copy-paste from RANDOM NOTE | Rewrite each |
| HUMANIZE | Opens *"Randomly add a note delay to the note being played"* (a Gate FX described as acting on notes), then `Amount : set the amount of` — sentence stops mid-word | Rewrite |
| RANDOM → "Length (only for cv)" | Contradicts its own parameter list four lines earlier, which says Length is D-Gate only | Length is a **Gate** parameter |
| RANDOM → "Random level (only for D-Gate)" | Definition is blank | Never written (B-9) |
| Global → Speed | *"you can also control the speed with the CC#"* — sentence stops mid-word | Never written |
| Throughout | Cross-references read `Page#`, `chapter#`, `CC##`, `(see p#)` | **Never filled in anywhere in the document** |
| Throughout | *"the note who is played"*, *"a sequencer who output gates"* | French-English artefacts; rewrite silently |

**The placeholder cross-references are the headline finding.** Manual V0.9 is structurally a draft:
its entire per-mode reference section is a contents list pointing at `Page#`, and several parameter
definitions are literally `?`. Most of the "the manual is unclear" complaint is this — the document
was shipped unfinished, not written badly.

---

# Questions for eowave

Worth asking directly; not answerable by experiment in reasonable time.

1. **Is there a registered manufacturer SysEx ID?** `F0 06 29` collides with Moog Music's registered
   single-byte ID — see [`protocol.md` §1.2](protocol.md#12-about-06-29--this-is-not-a-valid-manufacturer-id).
2. **How are the 8 microtonal tables defined and loaded?** (B-3)
3. **What is the built-in default CC map?** (B-4)
4. **Are the calibration opcodes safe, and what is the calibration procedure?** ([OQ-10](#oq-10))
5. **Are Velocity VCA and Math operations coming back?** Advertised on the product page,
   present-but-disabled in the editor ([OQ-12](#oq-12)).
6. **Is there a firmware changelog?** None was found. Modules reportedly shipped on `0.8x` with known
   mod-matrix bugs; without a changelog we cannot tell which behaviours are version-specific.
7. **✅ Responsible disclosure — three memory-safety defects (already reported).** Three undocumented
   opcodes (`0x16` out-of-bounds RAM write, `0x1F` out-of-bounds RAM read, `0x24` the tuning-table
   writer) are memory-safety defects ([`protocol.md` §9.8](protocol.md#98-three-memory-safety-defects--opcodes-22-0x16-31-0x1f-36-0x24)).
   None can brick the module or write firmware (RAM only). They were **reported privately to eowave
   on 2026-08-26**, before this repo was made public; the technical detail is withheld here — see
   [`SECURITY.md`](../SECURITY.md).
8. **Are preset names planned?** There is no storage for them today ([`protocol.md`
   §0.5](protocol.md#05-presets-what-exists-and-what-does-not)), so the app will store them
   client-side. If firmware support is coming, we'd rather match it than migrate later.

---

# Sources that resisted capture

| Source | Status |
|---|---|
| ModWiggler thread [t=294973](https://modwiggler.com/forum/viewtopic.php?t=294973) | Bot-blocked (challenge page to `curl`, 403 to automated fetch). **Worth reading manually** — the richest source of shipping-firmware bug reports. |
| [Perfect Circuit](https://www.perfectcircuit.com/eowave-portail.html), [SchneidersLaden](https://schneidersladen.de/en/eowave-portail-midi-cv-interface) | 403 to automated fetch. Retail copy; low value, already summarised via search. |
| [ModularGrid](https://modulargrid.net/e/eowave-portail) | Not fetched. Specs only; nothing the product page lacks. |
| Firmware release notes | **Do not appear to exist.** A single `.uf2` is linked with no version history. |
