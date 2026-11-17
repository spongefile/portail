# eowave Portail — Device Communication Protocol

**Status:** reverse-engineered from three independent sources — the shipping web editor's source, the
official manual V0.9, and **a disassembly of the official firmware image**.
**Spec version:** 2.0.0
**Firmware analysed:** `usb-cv_3.uf2`, which reports itself as **0.83r** — the version constant is
compiled in and was read directly out of the image ([§0.2](#02-firmware-version)).

Every claim below carries one of three tags:

| Tag | Meaning |
|---|---|
| **[confirmed from firmware]** | Recovered by disassembling the official firmware image itself (`research/fw-analyse.py`). This is what the device actually does — the strongest tag available. The load-bearing firmware claims (45-entry dispatch table, 43 opcodes implemented, `(n-1)&7` recall, 8-byte FX stride, the flash-write reachability set) were **independently re-derived by a second analyst from a separate disassembly** and agree. |
| **[confirmed from source]** | Read directly out of the official editor's JavaScript or the official manual. The official editor demonstrably sends/parses exactly this — strong evidence about the firmware, but evidence about the *client*. |
| **[inferred]** | A conclusion drawn from that source, not stated by it. Highly likely, but not proven against hardware. |
| **[unknown]** | Not determinable from any source we have. Every one is listed in [`open-questions.md`](open-questions.md) with a hardware test recipe. |

> **Important scope note.** The editor is the *only* known implementation. "Confirmed from source"
> means *the official editor does this*, which is strong evidence about the firmware but not proof:
> the firmware may accept more than the editor sends, and may tolerate the editor's bugs. Anywhere
> that distinction matters, it is called out.

Primary sources, all captured under `research/`:

- `research/original-editor/` — full unminified editor (`index.html` + `js/*.js`), fetched 2026-08-26.
  No bundler, no minifier, no source maps needed; the shipped code is the original code, comments included.
- `research/portail-manual.pdf` / `.txt` — official manual V0.9.
- `research/firmware/firmware.bin` — official firmware image, unpacked from the `.uf2`.

None of it is redistributed in this repository; `research/fetch-sources.sh` downloads it on demand.
`research/fw-analyse.py` reproduces every firmware claim below.

---

## 0. Implementing against this document

This section answers, directly, the questions an implementer of a replacement editor will ask first.
**Four of them have negative answers.** The Portail's SysEx is not a conventional
handshake-and-checksum design, and an implementer who assumes it is will write code that never works.
Each negative below is stated with the evidence for it.

| Requirement | Answer | Detail |
|---|---|---|
| **Identity / handshake** | ⚠️ Minimal — a bare ping, no identity data | [§0.1](#01-identity-and-handshake) |
| **Config blob layout** | ✅ Fully mapped, field by field | [§2](#2-configuration-memory-layout), [`model.json`](model.json) |
| **Read config from module** | ✅ Fully mapped | [§0.3](#03-reading-the-whole-configuration) |
| **Write config to module** | ✅ Fully mapped | [§0.4](#04-writing-the-whole-configuration) |
| **Preset read / write** | ✅ Recall and save exist — **asymmetric numbering** | [§0.5](#05-presets-what-exists-and-what-does-not) |
| **Preset *names*** | ❌ **Do not exist** | [§0.5](#05-presets-what-exists-and-what-does-not) |
| **Preset *enumerate*** | ❌ **No such opcode** — must be done by brute force | [§0.5](#05-presets-what-exists-and-what-does-not) |
| **7-bit encoding of 8/16-bit values** | ❌ **No packing scheme exists** — one exception | [§0.6](#06-there-is-no-7-bit-packing-scheme) |
| **Checksum** | ❌ **There is no checksum** | [§0.7](#07-there-is-no-checksum) |
| **Undocumented opcodes** | ⚠️ 16 implemented, unknown to the official editor | [§9](#9-undocumented-opcodes) |

### 0.1 Identity and handshake

**[confirmed from source]** There is no identity exchange. The only handshake is a bare ping:

```
Host → F0 06 29 23 00 F7        # SYS_CHECK_CONNECTION
Dev  → F0 06 29 23 ... F7       # any reply with opcode 0x23 means "alive"
```

The editor sets a flag when it sends and clears it when any opcode-`0x23` message arrives, checking
50 ms later. **The reply carries no manufacturer, model, or serial information** — it is a liveness
probe, nothing more.

The closest thing to identity is the version query ([§0.2](#02-firmware-version)).

**[confirmed from source]** The official editor identifies the module purely by **MIDI port name**,
which the *user* selects from a dropdown. There is no automatic discovery, and nothing stops a user
pointing the editor at unrelated gear and writing configuration SysEx into it.

> **This is a real safety problem for a public release.** Because the message prefix `F0 06 29`
> collides with Moog Music's registered manufacturer ID
> ([§1.2](#12-about-06-29--this-is-not-a-valid-manufacturer-id)), a mis-selected port can send
> Portail configuration data to a Moog device. **The app should require a successful version
> handshake before enabling any write**, i.e.:
>
> 1. Send `F0 06 29 22 F7`.
> 2. Require a well-formed `F0 06 29 22 <maj> <min> <rev> F7` reply within ~200 ms.
> 3. Only then unlock write operations for that port.
>
> That is strictly better than what the official editor does, costs one message, and is the single
> highest-value protocol-level improvement available. [OQ-7](open-questions.md#oq-7) tests whether a
> standard MIDI Identity Request also works, which would be better still.

### 0.2 Firmware version

**Host → device:** `F0 06 29 22 F7`
**Device → host:** `F0 06 29 22 <major> <minor> <rev> F7` — 8 bytes.

**[confirmed from source]** Rendered by the editor as
`major + "." + minor + String.fromCharCode(rev)`. The third byte is an **ASCII character**, not a
number: `00 09 61` displays as `0.9a`. An implementer must not format it as `0.9.97`.

**[confirmed from source]** Community reports have modules shipping on `0.8x`; the manual is V0.9.
The app should display the version prominently and record it alongside any saved configuration file,
because behaviour is known to differ between revisions.

### 0.3 Reading the whole configuration

A complete read is **59 request/reply exchanges** (8+8+8 lines + 1 globals + 32 CC-map slots +
version + active preset). There is no bulk-dump opcode. A complete *write* is 57 — it omits the two
queries.

| Step | Messages | Request | Reply |
|---|---:|---|---|
| CV outputs | 8 | `F0 06 29 02 <0-7> F7` | `F0 06 29 02 <i> <9 bytes> F7` |
| Gate outputs | 8 | `F0 06 29 00 <0-7> F7` | `F0 06 29 00 <i> <9 bytes> F7` |
| FX slots | 8 | `F0 06 29 08 <0-7> F7` | `F0 06 29 08 <i> <8 bytes> F7` — **8, not 9** |
| Globals | 1 | `F0 06 29 0B F7` | `F0 06 29 0B <8 bytes> F7` |
| CC map slots | 32 | `F0 06 29 13 <0-31> F7` | `F0 06 29 13 <slot> <7 bytes> F7` |
| Version | 1 | `F0 06 29 22 F7` | `F0 06 29 22 <3 bytes> F7` |
| Active preset | 1 | `F0 06 29 05 F7` | `F0 06 29 05 <preset> F7` |

**[confirmed from source]** The index in a per-line request is always `line & 7` — the index *within
the family*, never the absolute line number. Family is selected by the opcode.

**Reply correlation:** every reply repeats its index in the same byte position as the request, so
replies are self-identifying and may arrive out of order. Match on `(opcode, index)`, not on arrival
order.

### 0.4 Writing the whole configuration

| Step | Messages | Message |
|---|---:|---|
| CV outputs | 8 | `F0 06 29 03 <0-7> <9 bytes> F7` |
| Gate outputs | 8 | `F0 06 29 01 <0-7> <9 bytes> F7` |
| FX slots | 8 | `F0 06 29 09 <0-7> <8 bytes> F7` — **8, not 9** |
| Globals | 1 | `F0 06 29 0A <8 bytes> F7` |
| CC map slots | 32 | `F0 06 29 12 <slot> <7 bytes> F7` |

**[confirmed from source]** Writes affect **volatile memory only** and take effect immediately.
They are lost at power-off unless followed by `F0 06 29 07 F7` (`SYS_SAVE_ALL`).

**[confirmed from firmware]** No *documented* write is acknowledged. There is no reply, no error
code, and no way to tell a successful write from a dropped one **except by reading the line back**.
(The one exception is an undocumented opcode the app must never send — `0x16`, a memory-safety
defect whose reply frame is withheld here; see [§9.8](#98-three-memory-safety-bugs--opcodes-22-0x16-31-0x1f-36-0x24).) For a public release
this matters: the app should offer a **verify** step that re-reads and diffs after writing, because
that is the only integrity mechanism the protocol permits. See [§0.7](#07-there-is-no-checksum).

> **[confirmed on hardware, 2026-08-27]** The verify must compare only the bytes the current mode
> uses — the mode byte plus that mode's parameters — **not** all 9 line bytes. A line's PADDING bytes
> (positions the mode doesn't use) do not round-trip byte-identically from an editor-built config, so
> an all-bytes diff falsely reports "didn't take" on untouched outputs after a send. Reading a line
> first makes its bytes match the module's on the wire; comparing mode-meaningful bytes makes an
> unread config verify correctly too, while still catching a value the module clamped or rejected
> (that lands in a meaningful byte).

### 0.5 Presets: what exists, and what does not

**[confirmed from firmware]** Presets are **numbered only**. There is:

- ✅ **Recall** — `F0 06 29 04 <preset> F7`
- ✅ **Save** — `F0 06 29 07 F7`, which overwrites the **currently active** preset with live memory
- ✅ **Query active** — `F0 06 29 05 F7` → `F0 06 29 05 <preset> F7`

and there is **not**:

- ❌ **A preset name field.** No opcode reads or writes one, and the firmware's preset storage has no
  room for one. The editor's dropdown is hard-coded to the strings `"preset 1"` … `"preset 8"`.
- ❌ **A "save to preset N" opcode.** Save always targets the active preset. To write preset 5 you
  must recall preset 5 first, which **discards unsaved live edits**. *Evidence: the `SYS_SAVE_ALL`
  handler takes no operand.*
- ❌ **An enumerate/list opcode.** Nothing returns a summary of all 8 slots.

#### Preset numbering is asymmetric — and the official editor gets it right

**[confirmed from firmware]** The recall handler is, in effect:

```c
n = msg[4];
if (n > 8) return;          /* silently ignored */
active_preset = (n - 1) & 7; /* 1-based in, 0-based stored */
```

and the query handler returns `active_preset` — the **0-based** stored value.

So the wire protocol really is asymmetric: **recall takes 1–8, query returns 0–7.** The official
editor sends 1–8 and displays `reply + 1`, which is **correct on both sides**.

> An earlier revision of this document inferred an off-by-one bug in the official editor from the
> JavaScript alone. **That inference was wrong**, and the firmware disproves it. The asymmetry is in
> the protocol, not the editor. Recorded here because it is exactly the kind of plausible-but-false
> conclusion a second source exists to catch.

**Edge cases the app must handle** — **[confirmed from firmware]**:

| Sent | Result |
|---|---|
| `1`–`8` | Recalls presets 1–8. Normal. |
| `0` | `(0 − 1) & 7` = `7` → **recalls preset 8.** Not an error, and easy to trigger if you assume 0-based. |
| `9`–`127` | Rejected by the `n > 8` bound; the message is ignored entirely. |

**Consequences the app must handle:**

1. **Preset names must be stored client-side** (browser storage or the exported file), not on the
   module. The manual must say so, or users will expect names to travel with the hardware.
2. **"Save to a different slot" is destructive and multi-step**: recall target → re-send the entire
   configuration → save. Warn that recalling discards unsaved edits, and re-send from the app's own
   in-memory copy rather than trusting the module.
3. **Enumerating all 8 presets means recalling each and reading it back** — 8 recalls plus 8 × 57
   line/global/CC-map reads, and it
   leaves a different preset active than when it started. Offer it as an explicit "scan module"
   action, never silently on connect.

### 0.6 There is no 7-bit packing scheme

**[confirmed from source]** Every configuration parameter is **a single 7-bit byte**, and it carries
a **menu index**, not a physical value.

There is no nibble-splitting, no MSB-block encoding, no 8-in-7 packing anywhere in the protocol. The
reason there does not need to be one is that no parameter's value space exceeds 128 entries — the
device stores indices into look-up tables, and the tables live in the *editor*, not the firmware.

> An envelope attack byte of `50` does not mean 50 ms. It means `env_times[50]`, which is `15.6 ms`.
> **Never do arithmetic on a stored parameter value. Look it up in
> [`model.json`](model.json) → `domains`.**

**The single exception is tempo**, which is the only value in the protocol wider than 7 bits:

```
BPM   = (msb << 7) | (lsb & 0x7F)
msb   = bpm >> 7
lsb   = bpm & 0x7F
```

**[confirmed from source]** — used identically in `refresh_globals()` (decode) and `update_change()`
(encode). Tempo occupies global bytes 2–3, and has its own setter,
`F0 06 29 17 <msb> <lsb> F7`.

**The 16-bit CV outputs are not exposed as 16-bit values.** The "16-bit" in the product description
refers to the **DAC resolution**, not to anything in the protocol. No message ever carries a raw
output level; the firmware computes output voltages from the mode and its parameters. There is
nothing to pack.

> **[confirmed from firmware]** There *is* one 14-bit (7-bit pair) value encoding in the protocol, but
> it lives entirely outside the configuration path — in the undocumented **microtonal tuning-table**
> writer (opcode `0x24`), which carries twelve 14-bit values, one per pitch class. Nothing in the
> config, preset or CC-map path uses it. That opcode is a firmware memory-safety defect; the editor
> sends it safely by rejecting any table slot outside `0`–`7`
> ([§0.9](#09-safety-model--can-the-module-be-bricked-over-midi), [§9.8](#98-three-memory-safety-defects--opcodes-22-0x16-31-0x1f-36-0x24)).
> The read-side result — all 8 factory tables are 12-TET — is in [`microtonal-tables.md`](microtonal-tables.md).

> ⚠️ **The one place 7-bit safety is actually violated**, in the *opposite* direction from packing:
> four parameters have value tables of 129 entries and can emit index `128` = `0x80`, which is not a
> legal SysEx data byte. See [§1.3](#13-data-width-encoding-checksums). **Clamp to 0–127.**

### 0.7 There is no checksum

**[confirmed from source]** No checksum, no CRC, no parity, no length field, no sequence number, and
no ACK/NAK — in either direction. Every message is bare: prefix, opcode, payload, `F7`.

**[inferred]** Message integrity therefore rests entirely on USB-MIDI's own transport-level
guarantees. *This inference rests on:* the complete absence of any verification field in all 27
message layouts, and the absence of any retry, timeout, or error path in the editor's send code
(`update_line`, `sendMapping`, `update_global` all call `output.send()` and return).

**What an implementer must do instead**, since the protocol offers nothing:

1. **Validate on receive.** Check the `F0 06 29` prefix, the opcode, and the **exact expected
   length** for that opcode before using a reply. A short read is otherwise undetectable.
2. **Range-check every field** against `model.json` before applying it. A corrupted mode byte will
   otherwise index past the end of a table.
3. **Read back after write.** The only way to know a write landed is to re-read the line and diff it.
   Offer this as an explicit verify step.
4. **Never send a value you have not clamped.** The protocol will happily carry a byte the firmware
   cannot interpret.

### 0.8 Out of scope for this project

**Firmware update is not implemented by this project.** The module is updated by dragging a `.uf2`
onto the RP2040 bootloader volume; there is no SysEx path. [§8](#8-firmware-update) documents the
procedure for completeness only — the app should link to eowave's file and reproduce the steps as
instructions, and must not attempt to flash the module.

The opcodes that plausibly relate to bulk transfer (`0x0E` `SYS_RECEIVE_FILE`, `0x10`
`SYS_VIEW_FILE`) and to output calibration (`0x0C` `SYS_SET_CALIB`, `0x0F` `SYS_SET_CALIB_DAC`) are
implemented in firmware but of **[unknown]** payload format, unused by the official editor, and
**out of scope**. (`0x0D` `SYS_SET_CALIB2` is named by the editor but **not implemented** in the
firmware at all — see [§3](#3-opcode-table).) All are catalogued so that nobody has to rediscover
them, and probed read-only in [OQ-10](open-questions.md#oq-10).

---

## 0.9 Safety model — can the module be bricked over MIDI?

**Short answer: no. [confirmed from firmware].** Nothing an app can send over SysEx can overwrite the
firmware, and every configuration write is recoverable by a power-cycle. This section states that as
a provable claim and derives the app's sending rules from it.

### The invariant

**[confirmed from firmware, two independent disassemblies]**

> **Flash writes occur at two fixed 4 KB offsets (`0x1FC000` erase+program, `0x1FD000` erase),
> 1.9 MB clear of the firmware image, reachable only from opcodes `0x06`, `0x07`, and one sub-case
> of `0x28`, with no message-derived operand.**

Every clause of that sentence is checkable:

- **Two flash-write functions, four call sites.** The image contains exactly two flash-writing
  wrappers — an erase+program at `0x30A0` (target `0x1FC000`) and an erase at `0x30CC` (target
  `0x1FD000`). Both targets are loaded as **compile-time immediates/literals**, never from the
  message. The four call sites are: a non-SysEx boot/settings path (`0x10001B1A`), `SYS_INIT_ALL`
  (`0x06`), `SYS_SAVE_ALL` (`0x07`, which calls both), and `0x28` sub-case 3.
- **1.9 MB of clearance.** The firmware code image is **78,592 bytes (`0x13300`)**; the config
  sectors sit at `0x1FC000` = 2,080,768 — about **1.9 MB above the end of code**. Nothing an app
  sends can move the write address, so **no opcode — documented, undocumented, or malformed — can
  reach the code region.** The worst any flash write can do is corrupt *preset data*.
- **Only three SysEx opcodes reach flash at all.** `0x06` (factory reset — erases all 8 presets),
  `0x07` (save), and `0x28` with `msg[4]==3` (a persist sub-command). All three write only the
  fixed preset region.

**Enumeration is complete — no hidden indirect path.** The Pico-SDK's own
`flash_range_erase`/`flash_range_program` at `0x10010A2C`/`0x10010AE4` have **zero callers** (dead
code the linker pulled in — which is why their assert strings appear in the image). The *live*
routines are RAM-resident copies at `0x20000321`/`0x200003D9`, reached only through the two veneers
at `0x1000E6B0`/`0x1000E690`. Those RAM addresses appear as literals **only** in the two veneer
slots, so a search for references to them is exhaustive: there is no computed or indirect flash-write
path. *These two facts are recorded so nobody re-does the work chasing the dead SDK copies.*

*How to reproduce:* `research/fw-analyse.py` locates the wrappers; disassembling `0x30A0`/`0x30CC`
shows the immediate target, and a call-site scan of both wrappers yields exactly the four sites
above.

### Consequences

- **(a) Config writes are volatile.** `SYS_WRITE_*` (`0x01`/`0x03`/`0x09`), `SYS_SET_CLOCK`
  (`0x0A`) and the single-global setters change RAM only. **A power-cycle restores the last saved
  state.** Nothing an app writes is durable until a preset save. **[confirmed from firmware]**
- **(c) Preset save goes through the firmware's own flash routine.** `SYS_SAVE_ALL` (`0x07`)
  erases and reprograms the fixed preset region via the routines above. It is the only durable
  write an app should ever issue, and it can only overwrite preset data. **[confirmed from firmware]**
  (`0x06` factory-reset and the `0x28` sub-case-3 persist reach the same region; the app sends
  none of the three except `0x07`, and only on explicit user action.)
- **(d) No SysEx→code-flash path exists.** Consistent with eowave distributing firmware as a `.uf2`:
  updates go through the RP2040 **BOOTSEL mask-ROM bootloader** (hold ▼ at power-up → `RPI-RP2`
  drive → drag `.uf2`), never over MIDI. **[confirmed from firmware]** — the firmware exposes no
  opcode that writes the code region.
- **RP2040 recovery story.** The BOOTSEL bootloader lives in **mask ROM and cannot be
  overwritten**. Even a fully corrupted application image cannot remove it. **Worst case for the
  user is re-entering BOOTSEL and re-dragging the `.uf2`** — the module cannot be permanently
  bricked by anything at the firmware or MIDI level.

### (b) The app's sending rule — allowlist, deny by construction

Because most opcodes are either unnecessary, unknown, or destructive-to-data, the app must treat
sending as an **allowlist**, not a blocklist: **it may emit only opcodes it fully understands, and
every other opcode is unreachable by construction** (no code path in the app constructs them).

**ALLOWED to send** — the complete set an editor needs:

| Purpose | Opcodes |
|---|---|
| Read config | `0x00` `0x02` `0x08` `0x0B` `0x13` (line/global/CC-map reads) |
| Read status | `0x05` `0x22` `0x23` (preset / version / ping) |
| Write config | `0x01` `0x03` `0x09` `0x0A` `0x11` `0x17` `0x18` `0x19` `0x1A` `0x20` |
| Write CC map | `0x12` **in its 13-byte per-slot form only** |
| MIDI learn | `0x1D` |
| Recall preset | `0x04` (payload `1`–`8`) |
| **Save preset** | `0x07` — the only durable write; gate it behind explicit user confirmation |
| Write tuning table | `0x24` — **only with a table slot in `0`–`7`, rejected otherwise** (see below) |

**DENIED by construction** — the app contains no code that emits any of these:

- `0x06` `SYS_INIT_ALL` — **confirmed factory reset**; erases all 8 presets ([§9.6](#94-individually-identified)).
- `0x0C` `0x0D` `0x0F` — calibration; wrong values degrade V/oct tracking, `0x0D` isn't even implemented.
- `0x0E` `0x10` — file transfer; purpose unknown.
- **`0x12` in its 192-byte form** — the legacy CC-grid message ([§6](#6-the-legacy-192-byte-cc-grid)).
- **The undocumented opcodes** — `0x14`–`0x16`, `0x1B`–`0x1C`, `0x1E`, `0x1F`, `0x25`–`0x2C` ([§9](#9-undocumented-opcodes)). `0x16` and `0x1F` are memory-safety defects, and `0x28`/sub-case 3 writes the preset region; **none is ever sent, not even to probe**.
- **Anything above `0x2C`** — silently dropped by the firmware's bound check anyway.

> **The one guarded exception — `0x24`.** `0x24` (write tuning table) is also a firmware
> memory-safety defect ([§9.8](#98-three-memory-safety-defects--opcodes-22-0x16-31-0x1f-36-0x24)), but
> unlike `0x16`/`0x1F` it has a legitimate use: the editor's Tuning tab authors microtonal tables.
> The app therefore *does* send `0x24`, but **only through a writer that rejects any table slot
> outside `0`–`7` — it never clamps or wraps** — which keeps the write in bounds and makes an
> out-of-range message unrepresentable from the app. The firmware bug is unfixed, so the disclosure
> stands; the app self-bounds so it cannot be the vector.

None of these can brick the module (see above), but several can destroy *presets* or put the module
in an undocumented state, so the app simply never constructs them. The allowlist is the mechanism;
the flash-address proof is why even a bug that violated it could not be catastrophic.


### What this proof does and does not cover

The bricking question is **settled: no**. It rests only on the flash-write enumeration above, which
two independent disassemblies agree on.

**Not** covered by that proof, and deliberately out of its scope (none bear on bricking):

- The *bodies* of the RAM-resident flash routines were not disassembled — only their call sites and
  the constant offsets they are handed. That is sufficient for the reachability proof.
- The *semantics* of 14 of the 16 undocumented opcodes are inferred, not confirmed
  ([§9](#9-undocumented-opcodes)). Only `0x16`, `0x1C`, `0x1F`, `0x28` were fully read.
- **A handler-robustness audit is a separate, still-open task.** The dispatcher reserves
  `sub sp, #0x134` and several handlers `memcpy` message-derived lengths into that stack frame.
  The only two opened so far (`0x16`, `0x1F`) were *both* memory-safety defects ([§9.8](#98-three-memory-safety-defects--opcodes-22-0x16-31-0x1f-36-0x24)),
  so the remaining handlers deserve a systematic bounds/stack-overflow review before the app trusts
  any reply length. This affects **robustness against a malicious or buggy device**, not bricking —
  a corrupted RAM read cannot damage the module. Tracked as a future task; it does not gate the app.

## 1. Transport

**[confirmed from source]** The Portail is configured entirely over **MIDI System Exclusive**, in both
directions, on its ordinary MIDI ports. There is no separate control endpoint, no HID, no WebUSB, no
serial protocol.

- **USB-C**: the module enumerates as a standard USB-MIDI class device. **[confirmed from source]**
  The firmware is built with the Raspberry Pi Pico SDK and TinyUSB (`tud_midi_n_stream_write`,
  `midid_open`, `midid_xfer_cb` appear in the firmware image), on an **RP2040**.
- **TRS MIDI in** (Type A): **[confirmed from firmware, 2026-09-09]** SysEx config does **NOT**
  arrive over TRS/DIN. The opcode dispatcher (`0x10006534`) has exactly three callers —
  `0x10006fec`, `0x10007010`, `0x1000703c` — and all three are **USB-MIDI CIN packet handlers**.
  No UART/DIN path calls the dispatcher anywhere in the image. TRS carries performance MIDI only;
  configuration is USB-exclusive.
  *(This corrects an earlier `[inferred]` claim here that TRS "should work identically" because the
  editor makes no distinction. It does not — and the practical consequence is that there is no
  send-`0x06`-over-DIN escape hatch when USB SysEx is unreachable. Inference from "the editor
  doesn't distinguish" was never evidence about what the FIRMWARE listens to.)*
- The editor requests WebMIDI with `sysex: true` and sends to a user-picked output port.
  **[confirmed from source]** It identifies the device only by the human-readable port name
  (`Portail`) chosen by the user from a dropdown — there is no automatic discovery.

### 1.1 Message framing

**[confirmed from source]** Every message, in both directions:

```
F0  06  29  <opcode>  [ payload ... ]  F7
```

| Byte | Value | Name |
|---|---|---|
| 0 | `F0` | SysEx start |
| 1 | `06` | `MSB_ADD` |
| 2 | `29` | `LSB_ADD` |
| 3 | `00`–`7F` | opcode |
| 4… | `00`–`7F` | payload |
| last | `F7` | SysEx end |

### 1.2 About `06 29` — this is not a valid manufacturer ID

**[confirmed from source]** The editor names these two bytes `MSB_ADD` / `LSB_ADD` — "address MSB/LSB"
— not "manufacturer ID". They are treated as a fixed device address, and both are matched exactly on
receive:

```
accept the message only if  msg[0] == 0xF0  and  msg[1] == 0x06  and  msg[2] == 0x29
```

**[inferred]** `0x06` is a **single-byte MIDI manufacturer ID registered to Moog Music** in the MMA
American block (`0x01`–`0x1F`). A conforming SysEx parser reading `F0 06 …` will interpret the
message as a *Moog* message whose first data byte is `0x29`, not as an eowave message with a
two-byte ID. eowave does not appear to hold a registered ID and has not used the three-byte
extended form (`F0 00 xx yy`) that exists for exactly this case.

**Practical consequences, and they are real:**

1. On a shared MIDI bus, a Moog device may attempt to parse Portail configuration traffic. Whether
   any given Moog device misbehaves is **[unknown]**.
2. Conversely, Moog SysEx whose first data byte happens to be `0x29` would be accepted by a Portail
   as a valid message. **[unknown]** whether that can corrupt a preset.
3. A replacement editor **must not** "fix" this by using a different ID — the firmware only answers
   to `06 29`. Document it; don't change it.

**Recommendation for the app:** default to sending configuration over **USB only**, and treat the
TRS port as input-for-music. If the app ever offers "send over DIN", warn about item 1.

### 1.3 Data width, encoding, checksums

**[confirmed from source]** There is **no checksum, no CRC, no length field, and no sequence number**
anywhere in the protocol. A truncated or corrupted message is undetectable by either side.

**[confirmed from source]** There is **no 7-bit packing scheme** for wide values. Every configuration
parameter is a single 7-bit byte carrying a **menu index**, not a physical value. (E.g. an envelope
attack of `50` does not mean 50 ms; it means "entry 50 of the `env_times` table", which is 15.6 ms.
See [`spec/model.json`](model.json) for every table.)

The single exception is tempo, which is split across two bytes:

```
BPM = (msb << 7) | (lsb & 0x7F)
```

**[confirmed from source]** — `refresh_globals()` and `update_change()` both use exactly this.

> ### ⚠ Protocol violation in the official editor
>
> **[confirmed from source]** Four parameters are bound to the `ms_128_menu` value table, which has
> **129 entries** (indices 0–128). The editor sends the raw menu index as a SysEx data byte. Index
> `128` is `0x80` — **a status byte, not a legal SysEx data byte**. Selecting the maximum value on
> any of these four parameters emits a malformed message:
>
> - CV `CLOCK` → `length`
> - Gate `CLOCK` → `length`
> - Gate `SEQ` → `gate_length`
> - Gate `EUCLIDEAN` → `gate_length`
>
> The table is also off by one at the bottom: index 0 and index 1 both read `"1 ms"`.
>
> This is mechanically detected by `research/extract-model.js` and recorded in
> `model.json → validation.seven_bit_violations`. **A replacement editor must clamp these domains to
> 0–127.** What the *firmware* does when it receives the malformed message is **[unknown]** — see
> [Open questions](open-questions.md#oq-8).

---

## 2. Configuration memory layout

**[confirmed from firmware]** The configuration is **not** one flat array. CV and Gate share a
single array with a **9-byte stride**; FX slots live in a **separate array with an 8-byte stride**.
The official editor models all three as 9-byte rows, which is why it writes a 9th byte to FX slots
that the firmware never reads.

| Family | Array | Stride | Addressing (from the firmware) |
|---|---|---:|---|
| CV 1–8 | shared | **9** | `base + index * 9` |
| Gate 1–8 | shared | **9** | `base + (index + 8) * 9` |
| FX 1–8 | separate | **8** | `fx_base + index * 8` |

The conceptual line numbering the editor uses — and which this document keeps, because the CC map
addresses parameters by it — is:

| Line | Family | Meaning |
|---:|---|---|
| `0`–`7` | CV | CV outputs 1–8 (16-bit, −5 V … +10 V) |
| `8`–`15` | Gate | Gate / "D-Gate" outputs 1–8 (12-bit, 0 V … +10 V) |
| `16`–`23` | FX | FX slots 1–8 (MIDI processors, **not** outputs) |
| `24` | Global | 8 global parameters |
| `25` | *(legacy)* | 192-byte per-parameter CC grid — vestigial, see [§6](#6-the-legacy-192-byte-cc-grid) |

Plus a separate **32-slot CC map** (`mod_matrix`), 7 bytes per slot — see [§5](#5-cc-map-midi-learn).

### 2.1 Line layout

CV and Gate lines are **9 bytes**; FX lines are **8 bytes**. **[confirmed from firmware]**

```
byte 0 : mode          (which function this line performs)
byte 1 : channel       (CV/Gate lines: MIDI channel 0-15)
         target        (FX lines: destination output 0-7)
byte 2 : parameter 2  ┐
...                   ├─ meaning depends entirely on byte 0
byte 8 : parameter 8  ┘
```

**The meaning of bytes 1–8 changes completely with byte 0.** There is no common header beyond the
mode byte. `spec/model.json` is the machine-readable table of every (family, mode) → parameter list,
value domain, range and default; the app should import it rather than re-transcribe it.

Unused trailing bytes are sent as `0`. **[inferred]** The firmware ignores parameters beyond the
current mode's parameter count. *This inference rests on* the write handlers storing a fixed number
of bytes per line regardless of mode, with no mode-dependent branching.

**[confirmed from firmware]** The FX write handler masks the target field to 3 bits (`& 7`) before
storing it, so a malformed target cannot address outside the 8 outputs of its domain.

### 2.2 Mode byte encoding — CV and Gate

**[confirmed from source]** For CV (lines 0–7) and Gate (lines 8–15) the mode byte is the plain menu
index. CV has 15 modes (0–14), Gate has 14 (0–13). See `model.json → modes.cv` / `modes.gate`.

**[confirmed from source]** On *receive*, the editor masks the Gate mode byte:

```
gate_line.mode = received_mode & 0x0F     // upper bits discarded
```
The editor's own comment beside this line translates as *"for the gates we bring it back to 0–15."*

**[inferred]** The firmware therefore sets bits above the low nibble in the Gate mode byte for some
purpose the editor discards. What lives in bits 4–6 is **[unknown]** — see [Open questions](open-questions.md#oq-2).
This mask exists only on the Gate read path, not on CV or FX.

### 2.3 Mode byte encoding — FX (the one real subtlety)

**[confirmed from source]** FX types split into two domains, and the wire encoding reflects it:

| UI index | Domain | Wire byte |
|---:|---|---:|
| `0` | — (OFF) | `0` |
| `1`–`8` | **Note FX** — process MIDI notes before they reach a CV output | `1`–`8` (identity) |
| `9`–`15` | **Gate FX** — process gates at a Gate output | `32`–`38` (`0x20 \| (idx − 9)`) |

Encode (from `update_change`):

```
encode:  wire = (ui_index >= 9) ? (ui_index - 9) + 32 : ui_index
```

Decode (from `analyse_midi_in`):

```
decode:  ui_index = (wire >= 9) ? (wire & 0x1F) + 9 : wire
```

So **bit 5 (`0x20`) of the FX mode byte is a "gate-domain FX" flag**, and the low 5 bits are the
offset from the first gate FX. This is the single most easily-missed detail in the whole protocol and
it is documented nowhere official.

> **[confirmed from source] Latent bug, worth not reproducing:** the two decode paths disagree.
> `analyse_midi_in` (SysEx receive) tests `wire >= 9`; `refresh_labels` and `file.js` (file load)
> test `wire > 0x1F`. For every value the editor itself produces (`0`–`8`, `32`–`38`) both agree.
> For a wire value in `9`–`31` they diverge, and one of them decodes garbage. The firmware should
> never emit `9`–`31` in an FX mode byte, but nothing enforces that. **A replacement editor should
> use the `>= 0x20` test consistently and reject `9`–`31` as malformed.**

**[confirmed from source]** `debut_mod_fx = 32` and two further FX types (`mod_lfo`, `mod_cc`) are
fully defined in the editor's tables but commented out of the shipped menu — as are `conditional`,
`modulate`, `vel vca` and `maths`. Note that `vel vca` and `maths` **are advertised on the official
product page** but are not reachable in the shipped editor. See [Open questions](open-questions.md#oq-12).

### 2.4 Global parameters (line 24)

**[confirmed from source]** 8 bytes:

| Byte | Meaning | Values |
|---:|---|---|
| 0 | Clock run | `0` stop, `1` start |
| 1 | Clock source | `0` internal, `1` external |
| 2 | Tempo MSB | `BPM = (msb << 7) \| (lsb & 0x7F)` |
| 3 | Tempo LSB | " |
| 4 | MIDI out copy (thru) | `0` off, `1` on |
| 5 | Reset on continue | `0` off, `1` on |
| 6 | Global CC channel | `1`–`16` (**one-based**, unlike per-line channels) |
| 7 | Disable default CC map | `0` off, `1` on |

**[confirmed from source]** Manual V0.9 gives the tempo range as **30–250 BPM**. Note byte 6 is
one-based while every per-line `channel` byte is zero-based (`ch_menu` index 0 = "ch 1"). That
inconsistency is in the protocol, not a transcription error — preserve it.

---

## 3. Opcode table

**[confirmed from firmware]** The dispatcher is a 45-entry jump table indexed by `msg[3]`. Opcodes
**above 44 (`0x2C`) are rejected outright** — the message is dropped without a reply. Of the 45
slots, **43 are implemented**; only opcodes **13** and **33** point at the default (do-nothing) case.

That is considerably more than the official editor knows about: the editor names **28** opcodes, one
of which (`0x0D`, `SYS_SET_CALIB2`) **the firmware does not implement**, and **16 implemented
opcodes have no name in the editor at all**.

Names are the official editor's, where it has one. "Editor" = the official editor actually sends it.

| Opcode | Dec | Name | Dir | Editor | Firmware | Summary |
|---:|---:|---|---|---|---|---|
| `0x00` | 0 | `SYS_READ_GATE` | ⇄ | ✔ | ✅ | Request / return a Gate line (9 bytes) |
| `0x01` | 1 | `SYS_WRITE_GATE` | → | ✔ | ✅ | Write a Gate line (9 bytes) |
| `0x02` | 2 | `SYS_READ_CV` | ⇄ | ✔ | ✅ | Request / return a CV line (9 bytes) |
| `0x03` | 3 | `SYS_WRITE_CV` | → | ✔ | ✅ | Write a CV line (9 bytes) |
| `0x04` | 4 | `SYS_LOAD_PRESET` | → | ✔ | ✅ | Recall a preset — **takes 1–8** |
| `0x05` | 5 | `SYS_GET_PRESET` | ⇄ | ✔ | ✅ | Active preset — **returns 0–7** |
| `0x06` | 6 | `SYS_INIT_ALL` | → | ✘ | ✅ | **Factory reset — confirmed: erases all 8 presets** ([§9.6](#94-individually-identified)) |
| `0x07` | 7 | `SYS_SAVE_ALL` | → | ✔ | ✅ | Commit live config to flash |
| `0x08` | 8 | `SYS_READ_FX` | ⇄ | ✔ | ✅ | Request / return an FX line — **8 bytes** |
| `0x09` | 9 | `SYS_WRITE_FX` | → | ✔ | ✅ | Write an FX line — **8 bytes** |
| `0x0A` | 10 | `SYS_SET_CLOCK` | → | ✔ | ✅ | Write all 8 global bytes |
| `0x0B` | 11 | `SYS_READ_CLOCK` | ⇄ | ✔ | ✅ | Return all 8 global bytes |
| `0x0C` | 12 | `SYS_SET_CALIB` | → | ✘ | ✅ | Implemented. Output calibration — **untested, risky** |
| `0x0D` | 13 | `SYS_SET_CALIB2` | — | ✘ | ❌ | **Declared by the editor, absent from firmware.** No-op. |
| `0x0E` | 14 | `SYS_RECEIVE_FILE` | → | ✘ | ✅ | Implemented. Bulk upload |
| `0x0F` | 15 | `SYS_SET_CALIB_DAC` | → | ✘ | ✅ | Implemented. DAC trim — **untested, risky** |
| `0x10` | 16 | `SYS_VIEW_FILE` | → | ✘ | ✅ | Implemented. Bulk read |
| `0x11` | 17 | `SYS_SET_MIDI_COPY` | → | ✔ | ✅ | Set MIDI-thru flag |
| `0x12` | 18 | `SYS_SET_MAPPING` | → | ✔ | ✅ | Write one CC-map slot |
| `0x13` | 19 | `SYS_READ_MAPPING` | ⇄ | ✔ | ✅ | Read one CC-map slot |
| `0x14` | 20 | — | → | ✘ | ✅ | **Undocumented** — tuning-table apply, see [§9.1](#91-the-tuning-table-group--opcodes-22-0x16-31-0x1f-36-0x24-and-202130) |
| `0x15` | 21 | — | → | ✘ | ✅ | **Undocumented** — tuning-table apply, see [§9.1](#91-the-tuning-table-group--opcodes-22-0x16-31-0x1f-36-0x24-and-202130) |
| `0x16` | 22 | — | ⇄ | ✘ | ✅ | **⚠️ DEFECT — do not send** ([§9.8](#98-three-memory-safety-defects--opcodes-22-0x16-31-0x1f-36-0x24)) |
| `0x17` | 23 | `SYS_SET_TEMPO` | → | ✔ | ✅ | Set tempo (14-bit, MSB/LSB) |
| `0x18` | 24 | `SYS_SET_START` | → | ✔ | ✅ | Start/stop clock |
| `0x19` | 25 | `SYS_SET_SYNC` | → | ✔ | ✅ | Internal / external clock |
| `0x1A` | 26 | `SYS_SET_RESET` | → | ✔ | ✅ | Reset-on-continue flag |
| `0x1B` | 27 | — | ⇄ | ✘ | ✅ | **Undocumented** — see [§9.2](#92-the-sequencer-data-group--opcodes-27-37-38-39) |
| `0x1C` | 28 | — | ⇄ | ✘ | ✅ | **Undocumented** — reads back the MIDI-thru flag |
| `0x1D` | 29 | `SYS_SET_MAP_MODE` | → | ✔ | ✅ | Arm / disarm MIDI learn |
| `0x1E` | 30 | — | → | ✘ | ✅ | **Undocumented** — tuning-table apply, see [§9.1](#91-the-tuning-table-group--opcodes-22-0x16-31-0x1f-36-0x24-and-202130) |
| `0x1F` | 31 | — | ⇄ | ✘ | ✅ | **⚠️ DEFECT — do not send** ([§9.8](#98-three-memory-safety-defects--opcodes-22-0x16-31-0x1f-36-0x24)) |
| `0x20` | 32 | `SYS_GLOBAL_CC_CH` | → | ✔ | ✅ | Global CC channel — **takes 1–16** |
| `0x21` | 33 | — | — | ✘ | ❌ | Not implemented. No-op. |
| `0x22` | 34 | `SYS_GET_VERSION` | ⇄ | ✔ | ✅ | Firmware version |
| `0x23` | 35 | `SYS_CHECK_CONNECTION` | ⇄ | ✔ | ✅ | Ping — replies `F0 06 29 23 01 F7` |
| `0x24` | 36 | — | → | ✘ | ✅ | Tuning-table writer — firmware **⚠️ DEFECT**, sent by the app only with slot `0`–`7` ([§9.8](#98-three-memory-safety-defects--opcodes-22-0x16-31-0x1f-36-0x24)) |
| `0x25` | 37 | — | → | ✘ | ✅ | **Undocumented** — see [§9.2](#92-the-sequencer-data-group--opcodes-27-37-38-39) |
| `0x26` | 38 | — | → | ✘ | ✅ | **Undocumented** — see [§9.2](#92-the-sequencer-data-group--opcodes-27-37-38-39) |
| `0x27` | 39 | — | ⇄ | ✘ | ✅ | **Undocumented** — see [§9.2](#92-the-sequencer-data-group--opcodes-27-37-38-39) |
| `0x28` | 40 | — | ⇄ | ✘ | ✅ | **Undocumented** — 5-way sub-dispatch; **sub-case 3 writes preset flash** |
| `0x29` | 41 | — | ⇄ | ✘ | ✅ | **Undocumented** — see [§9.3](#93-other-undocumented-opcodes--41-42-43) |
| `0x2A` | 42 | — | → | ✘ | ✅ | **Undocumented** — see [§9.3](#93-other-undocumented-opcodes--41-42-43) |
| `0x2B` | 43 | — | ⇄ | ✘ | ✅ | **Undocumented** — see [§9.3](#93-other-undocumented-opcodes--41-42-43) |
| `0x2C` | 44 | — | → | ✘ | ✅ | **Undocumented** — small stub into shared code |
| `0x2D`+ | 45+ | — | — | — | ⛔ | **Rejected.** Bound check drops the message. |

> **[confirmed from source] Opcode collision in the editor.** `js/midi.js` also defines `SET_PRM = 0`
> and a `sendPrm()` that transmits a 13-byte message with opcode `0` — the same opcode as
> `SYS_READ_GATE`. Nothing calls it. It is dead code. **Do not reimplement it.**

## 4. Message reference

Notation: `<n>` = one byte. All examples are literal hex, ready to paste into a SysEx tool.

### 0x02 / 0x00 / 0x08 — Read a line

**Host → device**

| Byte | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| | `F0` | `06` | `29` | opcode | index `0`–`7` | `F7` |

Opcode is `02` for CV, `00` for Gate, `08` for FX. **[confirmed from source]** The index is always
`line & 7`, i.e. `0`–`7` within the family — *not* the absolute line number.

**Device → host** (same opcode)

| Byte | 0 | 1 | 2 | 3 | 4 | 5…13 | 14 |
|---|---|---|---|---|---|---|---|
| | `F0` | `06` | `29` | opcode | index `0`–`7` | 9 config bytes | `F7` |

15 bytes total for CV and Gate. **[confirmed from firmware]**

**FX lines are 8 bytes, not 9** — **[confirmed from firmware]**. The FX read handler copies 8 bytes
from an array with an 8-byte stride and replies with 8; the FX write handler stores 8. The official
editor writes 9 and reads 8, so its extra 9th byte is simply never read. An FX reply is therefore
**14 bytes**, not 15.

```
# Read CV 1
F0 06 29 02 00 F7
# Read Gate 3
F0 06 29 00 02 F7
# Read FX 8
F0 06 29 08 07 F7
```

### 0x03 / 0x01 / 0x09 — Write a line

**Host → device**

| Byte | 0 | 1 | 2 | 3 | 4 | 5… | last |
|---|---|---|---|---|---|---|---|
| | `F0` | `06` | `29` | opcode | index `0`–`7` | config bytes | `F7` |

**[confirmed from firmware]** Opcode `03` CV and `01` Gate carry **9** config bytes (15 bytes
total); opcode `09` FX carries **8** (14 bytes total).

**[confirmed from source]** Writes affect **live/volatile** memory only. They take effect
immediately and are lost at power-off unless followed by `SYS_SAVE_ALL`.

```
# CV 1 = NOTE, ch 1, mono last, bend ±2, no vibrato, no glide,
# legato off, note range C-2..G8   (the factory default for NOTE)
F0 06 29 03 00  01 00 00 01 00 00 00 00 7F  F7
#             ^  ^  ^  ^  ^  ^  ^  ^  ^  ^
#             |  |  |  |  |  |  |  |  |  note_high = 127 (G8)
#             |  |  |  |  |  |  |  |  note_low = 0 (C-2)
#             |  |  |  |  |  |  |  legato = 0 (off)
#             |  |  |  |  |  |  glide = 0 (OFF)
#             |  |  |  |  |  vibrato_rate = 0 (OFF)
#             |  |  |  |  bend_range = 1 (±2 semitones)
#             |  |  |  voice_mode = 0 (mono last)
#             |  |  channel = 0 (ch 1)
#             |  mode = 1 (NOTE)
#             CV index 0
```

```
# FX 1 = SCALE targeting CV 1, major scale, root C
F0 06 29 09 00  07 00 01 00 00 00 00 00 00  F7
#               ^  ^  ^  ^
#               |  |  |  root = 0 (C)
#               |  |  scale = 1 (major)
#               |  target = 0 (CV 1)
#               mode = 7 (SCALE, note-domain, wire == index)

# FX 2 = INVERT targeting Gate 4  -- note the 0x20 flag
F0 06 29 09 01  25 03 00 00 00 00 00 00 00  F7
#               ^  ^
#               |  target = 3 (GATE 4)
#               mode = 0x25 = 37 = (14 - 9) + 32   [UI index 14 = INVERT]
```

### 0x0B — Read globals

**Host → device:** `F0 06 29 0B F7` (5 bytes, no index)

**Device → host**

| Byte | 0 | 1 | 2 | 3 | 4…11 | 12 |
|---|---|---|---|---|---|---|
| | `F0` | `06` | `29` | `0B` | 8 global bytes | `F7` |

13 bytes. **[confirmed from source]**

```
F0 06 29 0B F7
# → F0 06 29 0B  00 00 00 78 00 00 01 00  F7
#                 ^  ^  ^  ^  ^  ^  ^  ^
#                 |  |  |  |  |  |  |  disable_default_cc_map = 0
#                 |  |  |  |  |  |  global_cc_channel = 1
#                 |  |  |  |  |  reset_on_continue = 0
#                 |  |  |  |  midi_thru = 0
#                 |  |  |  tempo LSB = 0x78 = 120  -> BPM = (0<<7)|120 = 120
#                 |  |  tempo MSB = 0
#                 |  clock_source = 0 (internal)
#                 clock_running = 0 (stopped)
```

### 0x0A — Write globals

| Byte | 0 | 1 | 2 | 3 | 4…11 | 12 |
|---|---|---|---|---|---|---|
| | `F0` | `06` | `29` | `0A` | 8 global bytes | `F7` |

13 bytes. **[confirmed from source]**

### Single-global setters

**[confirmed from source]** Convenience opcodes that set one global without rewriting all eight.
All are 6 bytes: `F0 06 29 <op> <value> F7`.

| Opcode | Sets | Value |
|---|---|---|
| `0x17` (23) | Tempo | **7 bytes total**: `F0 06 29 17 <msb> <lsb> F7` |
| `0x18` (24) | Clock run | `0` stop, `1` start |
| `0x19` (25) | Clock source | `0` internal, `1` external |
| `0x1A` (26) | Reset on continue | `0` / `1` |
| `0x11` (17) | MIDI out copy | `0` / `1` |
| `0x20` (32) | Global CC channel | `1`–`16` |

```
F0 06 29 17 01 0E F7   # tempo = (1<<7)|14 = 142 BPM
F0 06 29 18 01 F7      # start clock
F0 06 29 19 01 F7      # external sync
```

**[unknown]** There is no single-setter for global byte 7 (`disable_default_cc_map`); the editor
updates its local copy and relies on the next full `SYS_SET_CLOCK`. A UI that only toggles that
checkbox and never runs "update all" will silently not apply it — **[confirmed from source]** bug in
the official editor.

### 0x05 — Get active preset

**Host → device:** `F0 06 29 05 F7`
**Device → host:** `F0 06 29 05 <preset> F7`

**[confirmed from source]** The editor displays `data[4] + 1`, so the device reports a **zero-based**
preset number (`0`–`7`).

### 0x04 — Load preset

| Byte | 0 | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|---|
| | `F0` | `06` | `29` | `04` | preset | `F7` |

**[confirmed from firmware]** The payload is **1-based**: `1`–`8` recalls presets 1–8. The handler
computes `active_preset = (n - 1) & 7` after rejecting `n > 8`, so:

| Sent | Result |
|---|---|
| `1`–`8` | Recalls presets 1–8 |
| `0` | Wraps to **preset 8** (`(0 − 1) & 7 = 7`) |
| `9`–`127` | Message silently dropped |

Note the asymmetry with [`0x05`](#0x05--get-active-preset), which returns the stored **0-based**
value. Both are firmware behaviour; the official editor handles both sides correctly. Full analysis
in [§0.5](#05-presets-what-exists-and-what-does-not).

**[confirmed from source]** The editor follows a preset load with a full `request_all()` to re-sync.

### 0x07 — Save all

**Host → device:** `F0 06 29 07 F7`

**[confirmed from source]** Commits the current live configuration to non-volatile memory, replacing
the **currently active preset**. Per manual V0.9: *"This saves the settings from the editor into the
Portail internal non-volatile memory and replaces the current portail preset."*

**[confirmed from source]** The editor always re-sends the complete configuration immediately before
saving (see [§7](#7-bulk-transfer-choreography)) — it never saves whatever the device happens to hold.
**A replacement editor should preserve that discipline**: write everything, then save.

**[inferred]** This writes RP2040 flash. Do not send it in a loop; flash endurance is finite.

### 0x22 — Get version

**Host → device:** `F0 06 29 22 F7`
**Device → host:** `F0 06 29 22 <major> <minor> <rev> F7` (8 bytes)

**[confirmed from source]** Rendered as `major "." minor String.fromCharCode(rev)` — the third byte
is an **ASCII character**, not a number. So `00 09 61` displays as `0.9a`.

**[confirmed from source]** Community reports have modules shipping on `0.8x`; the manual is V0.9.

### 0x23 — Check connection (ping)

**Host → device:** `F0 06 29 23 00 F7` (6 bytes — note the dummy `00` payload)
**Device → host:** `F0 06 29 23 01 F7` — **[confirmed from firmware]**, a fixed `01` payload.

**[confirmed from source]** The editor sets `connected = 0` when it sends, and any inbound message
with opcode `35` sets `connected = 1`. It checks 50 ms later and shows "lost connection !!" if
nothing came back.

**[confirmed from firmware]** The reply's payload byte is the constant `01`; it carries no
information beyond liveness.

This is the **only handshake**. **[confirmed from source]** There is no MIDI Universal Identity
Request (`F0 7E 7F 06 01 F7`) handler in the editor, and **[unknown]** whether the firmware
implements one. If it does, it would be a much better discovery mechanism than a port-name match —
see [Open questions](open-questions.md#oq-7).

---

## 5. CC map (MIDI learn)

**[confirmed from source]** 32 slots. Each maps an incoming Note or CC message to one parameter of
one line, with a scaled min/max. The editor calls this the "MOD MATRIX"; this spec calls it the
**CC map** (see [glossary](glossary.md) — "mod matrix" collides with "modifier/FX").

### 0x12 — Write one CC-map slot

| Byte | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| | `F0` | `06` | `29` | `12` | slot `0`–`31` | status hi | channel | number | target line | target param | min | max | `F7` |

13 bytes. **[confirmed from source]**

| Field | Meaning |
|---|---|
| **status hi** | MIDI status nibble: `9` = Note On, `11` (`0x0B`) = CC |
| **channel** | `0`–`15` |
| **number** | CC number, or note number |
| **target line** | `0`–`7` CV, `8`–`15` Gate, `16`–`23` FX, `24` Global |
| **target param** | Parameter index **within that line** (`2`–`8`). `0` means *slot unused*. |
| **min**, **max** | Endpoints, as **indices into the target parameter's own value domain** — not raw values. `min > max` inverts the mapping. |

**[confirmed from firmware]** The target-line field is also a **clear command**. The handler tests it
first, and **any value above 126 zeroes every field of that slot** instead of writing it:

```
if (payload.target_line > 126)  clear slot payload.slot  else  write it
```

The official editor relies on this without documenting it: an unassigned slot is `-1` internally,
which it transmits as `-1 & 0x7F` = **`127`**. So sending `127` as the target line is the supported
way to delete a mapping.

**[confirmed from source]** On *read*, the editor instead treats `target param == 0` as the
"unused" marker. The two directions use different sentinels — write says line `127`, read says
param `0`. Handle both.

**[confirmed from firmware]** Slots are stored 16 bytes apart internally, and the status nibble and
channel are recombined into a single MIDI status byte on arrival. Neither detail is visible on the
wire; the 7-byte payload above is the whole interface.

### 0x13 — Read one CC-map slot

**Host → device:** `F0 06 29 13 <slot> F7`
**Device → host:** identical 13-byte layout as the write. **[confirmed from source]**

### 0x1D — Arm MIDI learn

**Host → device:** `F0 06 29 1D <0|1> F7`

**[confirmed from source]** `1` arms, `0` disarms. **[inferred]** Arming tells the firmware to
*forward* incoming Note/CC messages to the host rather than (or as well as) acting on them — the
editor's learn flow is:

1. Send `F0 06 29 1D 01 F7`.
2. Wait for an inbound **Note On** (`0x90`–`0x9F`) or **CC** (`0xB0`–`0xBF`) message on the MIDI in.
3. Capture `data[0]` (status+channel) and `data[1]` (number) into the slot.
4. Send `F0 06 29 1D 00 F7` to disarm.
5. Send the completed slot with `0x12`.

**[confirmed from source]** Step 2 listens for **ordinary MIDI messages**, not SysEx. So a
replacement editor must keep a raw MIDI listener alive, not only a SysEx parser.

**[unknown]** Whether the firmware suppresses normal processing of that message while armed.

### Scope and persistence

**[confirmed from source]** Per manual V0.9: *"If the type of a cv, midi or effect row where a
mapping has been set is changed, the mapping will be removed from the mapping list."* The editor
enforces this client-side (`clear_mapping()` on mode change). **[inferred]** the firmware does not —
it is the editor's job. **A replacement editor must implement the same invalidation**, or stale
slots will point at parameters that no longer exist.

**[confirmed from source]** CC-map changes are volatile until `SYS_SAVE_ALL`.

> **[confirmed from source]** Community reports on ModWiggler describe the mod matrix as the
> least-reliable part of the module on shipping firmware, with eowave acknowledging a fix in
> progress. Treat CC-map behaviour as the area most likely to differ between firmware revisions.

---

## 6. The legacy 192-byte CC grid

**[confirmed from source]** The editor contains a *second*, older CC-mapping mechanism: `mem[25]`, a
192-entry array (24 lines × 8 parameters) holding one CC number per parameter. `update_cc_mapping()`
attempts to send all 192 bytes in a single message — **reusing opcode `0x12`**, the same opcode as
the 13-byte per-slot write:

```
F0 06 29 12 <192 bytes> F7
```

The editor builds this message by appending all 192 bytes after the opcode and then adding the
terminating `F7`.

**[confirmed from source]** The construction is accidentally well-formed — the editor pre-seeds an
`F7` in the position the payload then overwrites, and appends a second one at the end. But the
message collides with `SYS_SET_MAPPING`'s documented 13-byte form. The buffer is initialised to
**nine zero bytes** (the editor's `init()` gives every `mem` row nine zeroes; the wider 256-entry
initialisation loop is commented out), so entries 9–191 are JavaScript `undefined` — which
WebMIDI's `send()` converts to `0` under WebIDL's octet-conversion rules. **The wire message is
therefore 192 well-formed zero bytes**, not garbage, unless the user has already touched the
per-parameter map UI.

**[confirmed from firmware]** The `SYS_SET_MAPPING` handler reads a **fixed 8 payload bytes** for one
slot and ignores everything after them. A 192-byte message therefore writes **one slot only** — the
one named by its first payload byte. Combining the two findings: an untouched buffer sends all
zeros, so the message **overwrites CC-map slot 0 with an all-zero mapping** (target line 0 = CV 1,
parameter 0 = unused-marker). It cannot corrupt the whole map, but it can silently zero slot 0
every time the user leaves map mode.

`update_cc_mapping()` is called on leaving map mode. **[inferred]** This is dead/withdrawn
functionality superseded by the 32-slot CC map, and it is a plausible cause of corrupted
configurations in the official editor.

**Recommendation: a replacement editor must not implement this at all.** If a 192-byte message
arrives at opcode `0x12`, the firmware's behaviour is **[unknown]** — see [Open questions](open-questions.md#oq-4).

The related "default CC map" (global byte 7, "disable default midi mapping") refers to a
**firmware-resident** default grid mapping CCs to parameters. Its contents are **[unknown]** and the
manual only says *"disable the cc control grid (see p#)"* — a cross-reference to a page that was
never written.

---

## 7. Bulk transfer choreography

**[confirmed from source]** The editor never streams; it fires timed volleys with **5 ms spacing**.

**`request_all()`** — read entire configuration:

| t (ms) | Action |
|---:|---|
| `0, 5, … 115` | `request_line(0…23)` — CV 1–8, Gate 1–8, FX 1–8 |
| `150` | `request_global()` (`0x0B`) |
| `150, 155, … 305` | `request_mapping_line(0…31)` (`0x13`) |
| `400` | `request_version()` (`0x22`) |
| `410` | `request_preset()` (`0x05`) |
| `420` | `check_if_connected()` (`0x23`) |
| `500` | evaluate the connection flag |

**`update_all()`** — write entire configuration:

| t (ms) | Action |
|---:|---|
| `0, 5, … 115` | `update_line(0…23)` |
| `200` | `update_global()` (`0x0A`) |
| `210, 215, … 365` | `sendMapping(0…31)` (`0x12`) |
| `450` / `500` | ping, then check |

**`save_all()`** = `update_all()`, then `F0 06 29 07 F7` at t=500 ms.

**[inferred]** The 5 ms spacing is not decoration. The RP2040 firmware very likely has a small
USB-MIDI receive buffer and no flow control; back-to-back 15-byte SysEx messages risk overrun. Note
the collisions in the schedule above — at t=150 the global request and the first mapping request are
issued together, and `request_all()` overlaps its own volleys. This is fragile.

**Recommendation for the app:** replace fixed timers with a **request/response queue** — send one
message, wait for its reply (or a timeout), then send the next. That is strictly more reliable than
the official editor and removes the guesswork. Keep a conservative minimum gap (**≥5 ms**) between
consecutive *writes*, since writes are not acknowledged at all.

**[unknown]** Whether writes are acknowledged in any way, and the true minimum safe inter-message
gap — see [Open questions](open-questions.md#oq-6).

---

## 8. Firmware update

**[confirmed from source]** Firmware update does **not** use SysEx. Opcodes `0x0E`
(`SYS_RECEIVE_FILE`) and `0x10` (`SYS_VIEW_FILE`) exist but are never used and are
**[unknown]** in purpose (a microtonal-table upload path is a plausible guess).

The documented procedure, from manual V0.9, is the stock **RP2040 BOOTSEL** flow:

1. Download the `.uf2` (the editor links `https://eowave.app/portail/usb-cv_3.uf2`).
2. Connect the module to the computer by USB.
3. Hold the module's **left button (▼)** and power up the rack while holding.
4. The module enumerates as a USB mass-storage volume named **`RPI-RP2`**.
5. Drag the `.uf2` onto it.
6. The volume disconnects and the module reboots on the new firmware.

**[confirmed from source]** The captured image (`research/firmware/usb-cv_3.uf2`, unpacked to
`research/firmware/firmware.bin`) is a UF2 for family *Raspberry Pi RP2040*, load address
`0x10000000`, 307 blocks / 78,592 bytes of payload. Its embedded
build paths (`/Users/marcsirguy/Documents/pico/pico-sdk/...`) confirm a Pico-SDK + TinyUSB build.

**[confirmed from source]** The image contains **no application-level strings** — all menus and
parameter tables are numeric, which is why the editor carries every label. This means the firmware
cannot be mined for label text; `spec/model.json` is the only vocabulary source.

**A replacement editor should link to the official `.uf2` and reproduce these steps.** It cannot and
should not attempt to flash the module itself.

---

## 9. Undocumented opcodes

**[confirmed from firmware]** Sixteen implemented opcodes appear nowhere in the official editor. They
are recorded here as a map so the next person does not have to rediscover them. **None are needed to
build a configuration editor**, and the app never sends any of them (see the send-allowlist,
[§0.9](#09-safety-model--can-the-module-be-bricked-over-midi)).

Three of them are memory-safety defects; their internal addresses, offset arithmetic, and
reproduction are **withheld from this public repository** and held privately for coordinated
disclosure — see [§9.8](#98-three-memory-safety-defects--opcodes-22-0x16-31-0x1f-36-0x24) and
[`SECURITY.md`](../SECURITY.md). What remains below is the high-level *purpose* of each group, which
is useful for future work and is not an exploitation recipe.

### 9.1 The tuning-table group — opcodes 22 (`0x16`), 31 (`0x1F`), 36 (`0x24`), and 20/21/30

**[inferred]** A cluster of undocumented opcodes reads, writes, and applies the module's **microtonal
tuning tables** — the feature the official editor exposes as `table 1`–`table 8` but gives no way to
edit. *This inference rests on:* the opcodes forming a matched read / write / apply set indexed by a
small table number, the count of 8 matching the editor's 8 tables, and the write payloads carrying
twelve values (one per pitch class). The read-side result — that all 8 **factory** tables are plain
12-TET — is documented in [`microtonal-tables.md`](microtonal-tables.md).

> **⚠️ [confirmed from firmware] Three of these are memory-safety defects.** `0x16` (write), `0x1F`
> (read) and `0x24` (write — the table writer) do not bounds-check their index — an out-of-bounds RAM
> read/write. **The app never sends `0x16` or `0x1F`.** `0x24` has a legitimate use (the Tuning tab),
> so the app *does* send it, but **only after rejecting any table slot outside `0`–`7`** — see the
> guarded-exception note in [§0.9](#09-safety-model--can-the-module-be-bricked-over-midi). The
> firmware bug is unfixed; the app self-bounds.
> [details withheld — see [§9.8](#98-three-memory-safety-defects--opcodes-22-0x16-31-0x1f-36-0x24)]

### 9.2 The sequencer-data group — opcodes 27, 37, 38, 39

**[inferred] Sequencer step data.** Two read/write pairs over a per-output region; *this inference
rests on:* the region size being a multiple of the editor's 64-step sequencer length, a split that
matches a "value per step" plus "flag per step" layout, and the write handlers being the only
variable-length (`F7`-terminated) messages in the protocol. If correct, these would let an app read
and write **SEQ / CC RECORDER step contents** — which the official editor cannot do at all, and the
single most interesting future-feature possibility here.

*(Exact addressing is withheld from this public repo — it is unnecessary for the app, and probing
undocumented opcodes is unsafe.)*

### 9.3 Other undocumented opcodes — 41, 42, 43

**[inferred]** A read/write set over a per-note-sized table (128 entries), plausibly a note-remap or
per-note lookup. Purpose **[unknown]**; addressing withheld. Not needed by the app.

### 9.4 Individually identified

| Opcode | Finding |
|---:|---|
| `28` (`0x1C`) | **[confirmed from firmware]** Returns the MIDI-thru flag — the read counterpart to opcode `17`. The one undocumented opcode with an unambiguous, safe, useful meaning. |
| `40` (`0x28`) | **[confirmed from firmware]** A nested 5-way sub-dispatch on `msg[4]` (`0`–`4`); higher values are rejected. **[inferred]** clock/PPQN timing configuration; one sub-case is a **third preset-save path** alongside `0x06`/`0x07` (it writes the same fixed preset region — see [§0.9](#09-safety-model--can-the-module-be-bricked-over-midi)). Still on the never-send list — undocumented and unnecessary. |
| `44` (`0x2C`) | A short stub sharing code with opcode `32`. Not independently characterised. |
| `6` (`0x06`) | `SYS_INIT_ALL` — **implemented** despite being unused by the editor. **[confirmed from firmware]** A genuine **factory reset**: it restores defaults and rewrites all 8 presets, and touches nothing outside the preset region (it cannot reach code flash). **Never send without explicit user confirmation and a backup.** |
| `12` (`0x0C`), `15` (`0x0F`) | `SYS_SET_CALIB`, `SYS_SET_CALIB_DAC` — **implemented**. Output / DAC calibration. **[unknown]** payload format. A wrong value could degrade V/oct tracking in a way only eowave can undo — never sent by the app. |
| `14` (`0x0E`), `16` (`0x10`) | `SYS_RECEIVE_FILE`, `SYS_VIEW_FILE` — **implemented**. **[unknown]** purpose. Never sent by the app. |

<a id="98-two-memory-safety-bugs"></a>
<a id="98-three-memory-safety-defects--opcodes-22-0x16-31-0x1f-36-0x24"></a>
<a id="98-three-memory-safety-bugs--opcodes-22-0x16-31-0x1f-36-0x24"></a>
### 9.8 Three memory-safety defects — opcodes 22 (`0x16`), 31 (`0x1F`), 36 (`0x24`)

**[confirmed from firmware]** Three undocumented handlers contain memory-safety defects, all from an
unchecked index byte:

- **`0x16`** — out-of-bounds RAM **write**.
- **`0x1F`** — out-of-bounds RAM **read**.
- **`0x24`** — out-of-bounds RAM **write** (the microtonal-table writer). Unlike `0x16`/`0x1F` it has
  a legitimate use, so the editor sends it — but **only with a table slot in `0`–`7`, rejected
  otherwise** (never clamped/wrapped), which keeps the write in bounds. The firmware defect is
  unfixed; the app self-bounds.

**The app never sends `0x16` or `0x1F`** — they are excluded by construction from the send-allowlist
in [§0.9](#09-safety-model--can-the-module-be-bricked-over-midi), which is why
[OQ-10](open-questions.md#oq-10) forbids range-sweeping undocumented opcodes. **`0x24` is the one
guarded exception**: the editor's Tuning tab sends it, but only after rejecting any table slot
outside `0`–`7`, so the app cannot emit an out-of-range write ([§0.9](#09-safety-model--can-the-module-be-bricked-over-midi)).

**Impact is limited.** They touch RAM only; **none can write code flash**, so the brick-safety proof
in [§0.9](#09-safety-model--can-the-module-be-bricked-over-midi) is unaffected. Worst case is a
corrupted saved preset or a read of non-secret device RAM — both recoverable by a power-cycle,
re-save, or factory reset. Exploiting any of them requires the ability to send SysEx to the module in
the first place (physical/USB access or a malicious file); there is no network exposure.

> **Responsible disclosure.** These defects were reported privately to eowave (2026-08-26), before
> this repository was made public. The full technical analysis — addresses, mechanism, and
> reproduction — is deliberately **withheld from this public repository** until eowave has had the
> opportunity to address them, and is retained privately by the maintainer. Please see
> [`SECURITY.md`](../SECURITY.md) and contact the maintainer rather than reverse-engineering the
> specifics.

### 9.5 What the app should do with all this

**Nothing, for now.** The configuration editor needs opcodes `0`–`11`, `17`–`19`, `23`–`26`, `29`,
`32`, `34`, `35` and no others. The undocumented opcodes are recorded only as a map for possible
later work (§9.2, if sequencer-content editing ever becomes a goal).

Two things to adopt immediately:

- **Opcode 13 must not be sent** (the firmware does not implement it), and **opcodes above 44 are
  silently dropped**, so blind probing yields no feedback either way.
- **Opcodes `0x16` and `0x1F` must never be sent, not even to probe** — they are memory-safety
  defects ([§9.8](#98-three-memory-safety-defects--opcodes-22-0x16-31-0x1f-36-0x24)), excluded from
  the send-allowlist by construction. **`0x24`** is the same class of defect but is sent (Tuning tab)
  **only with a table slot in `0`–`7`** — see [§0.9](#09-safety-model--can-the-module-be-bricked-over-midi).

## 10. Front-panel buttons

**[confirmed from firmware]** The two front-panel buttons are read and handled entirely in firmware;
this reverses the biggest documentation gap eowave left. The vendor documents only "▼ held at
power-up → bootloader". Everything below is from the disassembly (`research/fw-analyse.py`
reproduces the map). The **▲/▼ silkscreen mapping is [inferred]** from the press direction and the
manual's naming of the bootloader button as **▼**; the firmware itself only knows the GPIO numbers.

### Hardware

| Button | GPIO | Read | Debounce |
|---|---|---|---|
| **▲** (up) *[inferred label]* | **GPIO 23** | SIO `GPIO_IN` bit 23 | 4-sample stable, edge-fires once (`0x100006e8`) |
| **▼** (down) *[inferred label]* | **GPIO 22** | SIO `GPIO_IN` bit 22 | " |

State is polled in the main loop (`0x10001940`+). There is a per-button edge detector, a hold timer
(`0x2000fdf4`), and a both-buttons "save" latch (`0x20011302`).

### Gesture → action

| Gesture | Action | Tag | Evidence |
|---|---|---|---|
| **Short-press ▲** (GPIO23) | **Active preset + 1** (wrap 7→0), recalled immediately | confirmed from firmware | handler `0x10001aae` → `0x1000340c` |
| **Short-press ▼** (GPIO22) | **Active preset − 1** (wrap 0→7), recalled immediately | confirmed from firmware | handler `0x10001adc` → `0x1000340c` |
| **Hold ▲ / ▼** (> ~2 s) | **Auto-repeat** the increment / decrement | inferred | hold timer `0x2000fdf4`, thresholds `2 s` (`0x1E8480`) and `5 s` (`0x4C4B40`); exact repeat rate not pinned |
| **Both buttons, then release** | **Save the active preset to flash** (overwrites it) | confirmed from firmware | latch `0x20011302` armed at `0x10001a48`, save at `0x10001b0c` → `0x100030a0` |
| **▼ held at power-up** | Firmware takes a special init branch (skips clearing outputs; sets flag `0x2001130a`). The **UF2 bootloader (`RPI-RP2`) itself is separate RP2040 hardware BOOTSEL**, caught by the mask ROM before firmware runs. | confirmed from firmware (firmware branch); inferred (relation to BOOTSEL) | boot check `0x100016fe`, branch `0x10000338` |
| **▲ held at power-up / both at power-up** | No distinct firmware boot branch found (only ▼ is tested at boot) | inferred | only `GPIO_IN` bit 22 is tested at `0x100016fe` |

### Two facts worth stating plainly

1. **The buttons are a preset selector + save — not a menu/mode editor.** The product page calls them
   "menu and mode", but the firmware exposes no on-module edit menu or mode-cycling state: the only
   actions are preset up, preset down, and save. [confirmed from firmware — the polled handler at
   `0x10001940`–`0x10001b3a` contains no other state.]
2. **The buttons share the SysEx paths.** Preset recall from a button calls `0x1000340c` — the exact
   routine SysEx `0x04` (`SYS_LOAD_PRESET`) uses. The both-buttons save calls `0x100030a0` — the exact
   flash routine SysEx `0x07` (`SYS_SAVE_ALL`) uses, writing the fixed preset region at `0x1FC000`
   ([§0.9](#09-safety-model--can-the-module-be-bricked-over-midi)). So a panel save is identical to an
   editor save, and cannot touch code flash.

### Corroboration with the LED map

Every preset action writes palette index **1 (red)** as a marker to the LED layer at the preset's
position (`0x200034d8`) — exactly the red-on-recall behaviour documented in
[`led-colors.md` §3](led-colors.md#3-what-actually-drives-each-led-confirmed-from-firmware). The
button→preset link and the LED→preset link independently agree.

### Still needs a physical press-test

- Exact hold-to-repeat rate and the 2 s vs 5 s threshold roles.
- Whether an isolated first press *shows* the current preset before the next press *changes* it (a
  ~5 s gate at `0x2000c05c` hints at this) — [inferred], not proven.
- What the ▼-at-boot flag `0x2001130a` ultimately changes downstream.

These are folded into [OQ-3](open-questions.md#oq-3).


## Open questions

Twelve things this document could not settle are catalogued in
**[`spec/open-questions.md`](open-questions.md)**, each written as a self-contained test recipe —
which tool to use, what to do on the module, what to look for, and what each possible result means.
They are ordered by how much they unblock. Five are marked 🔴: they block a correct implementation
and should be run first.


## What this means for the app and the manual

- **FX lines are 8 bytes, CV and Gate lines are 9.** Do not model all three as 9.
- **Import `spec/model.json`.** Do not re-transcribe enumerations; they are mechanically extracted
  and regenerating them is one command (`node research/extract-model.js`).
- **Clamp the four `ms_128_menu` parameters to 0–127.** The official editor does not.
- **Use a request/response queue**, not fixed timers.
- **Never send the 192-byte legacy CC-grid message.**
- **Use the `>= 0x20` test** for the FX gate-domain flag, consistently, and reject `9`–`31`.
- **Preset recall takes 1–8; the active-preset query returns 0–7.** Sending `0` recalls preset 8.
- **Re-invalidate CC-map slots** whenever a line's mode changes.
- **Gate a port behind a successful version handshake before writing anything** ([§0.1](#01-identity-and-handshake)).
- **Never send opcode 13** (not implemented) or anything above 44 (silently dropped).
- **The manual needs an on-module UI chapter** that does not currently exist anywhere
  ([OQ-3](open-questions.md#oq-3)).
