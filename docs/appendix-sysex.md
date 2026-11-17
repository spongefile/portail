# Appendix: SysEx notes

Portail is configured entirely over MIDI System Exclusive. The official manual
tells you this is possible — "you can configure it via your phone/tablet/computer
(or SYSEX messages)" — and then documents not one message. See
[audit §13](audit.md).

**The full protocol lives in `spec/protocol.md`.** That file is the authority —
it was reverse-engineered from the editor's source, the manual, **and a
disassembly of the official firmware image**, and it tags every claim with how it
was confirmed. This page gives the shape of it, enough to know what is possible
and where to look.

The firmware analysed reports itself as version **0.83r**.

---

## Message format

Every message follows the same frame:

```
F0  06  29  <command>  <payload…>  F7
```

- `F0` — SysEx start
- `06 29` — the two address bytes Portail responds to. The editor's source calls
  them `MSB_ADD` and `LSB_ADD`.

  **This is not a valid MIDI manufacturer ID**, and `06` collides with the ID
  registered to Moog Music. A tool pointed at the wrong MIDI port can therefore
  send Portail configuration data to unrelated gear. Any editor should require a
  successful version handshake before enabling writes — `spec/protocol.md` §1.2
  covers this.
- `<command>` — one byte, see below
- `<payload>` — command-dependent, always 7-bit values
- `F7` — SysEx end

All data bytes are 7-bit, as SysEx requires. Values above 127 are split into
MSB and LSB pairs — the tempo is the one place this shows up in normal use.

---

## What the commands do

Grouped by purpose. Command numbers are from the editor's source.

### Reading and writing output configuration

| Command | Purpose |
|---|---|
| 0 | Read a Gate output |
| 1 | Write a Gate output |
| 2 | Read a CV output |
| 3 | Write a CV output |
| 8 | Read an FX row |
| 9 | Write an FX row |

A row is **9 bytes**: the mode, then eight parameter values. Which parameters
those eight are depends on the mode — see
[Appendix: parameter tables](appendix-parameter-tables.md) and the mode pages.

Rows are addressed 0–7 within each family. The editor's internal numbering treats
them as one flat list of 24: 0–7 are CV, 8–15 are Gate, 16–23 are FX.

### Presets

| Command | Purpose |
|---|---|
| `0x04` | Recall a preset |
| `0x05` | Query the active preset |
| `0x06` | Initialise everything |
| `0x07` | Save live memory to the **active** preset |

Three things about presets that no other source states, all confirmed from the
firmware:

- **Presets have no names.** No opcode reads or writes one, and the storage has
  no room for one. The editor's dropdown strings are hard-coded.
- **There is no "save to preset N".** Save always targets the active preset. To
  write preset 5 you must recall preset 5 first — which discards unsaved edits.
- **The numbering is asymmetric.** Recall takes `1`–`8`; the query returns `0`–`7`.
  Recall with `0` does not error — it wraps and recalls preset 8.

There is also no way to enumerate presets. Reading all eight means recalling each
in turn and reading it back, which leaves a different preset active than when you
started.

Command `0x06` is a full reset. Treat it with care — there is no published way to
restore factory presets afterwards. See
[the editor](editor.md#backing-up).

### Global settings

| Command | Purpose |
|---|---|
| 10 | Set all global parameters |
| 11 | Read global parameters |
| 17 | Set MIDI out copy |
| 23 | Set tempo |
| 24 | Set start/stop |
| 25 | Set clock sync source |
| 26 | Set reset-on-continue |
| 29 | Set default-mapping mode |
| 32 | Set the global CC channel |

The global block is **8 bytes**:

| Byte | Meaning |
|---|---|
| 0 | Clock start/stop |
| 1 | Clock source — internal or external |
| 2 | Tempo MSB |
| 3 | Tempo LSB |
| 4 | MIDI out copy on/off |
| 5 | Reset on continue on/off |
| 6 | Global CC channel, 1–16 |
| 7 | Disable default MIDI mapping |

Tempo is reassembled as `(MSB << 7) | (LSB & 0x7F)`, in BPM.

### The CC map

| Command | Purpose |
|---|---|
| `0x12` | Write a CC map slot |
| `0x13` | Read a CC map slot |

A mapping slot is 7 fields: the MIDI message type, the channel, the CC or note
number, the destination row, the parameter index within that output, and the **Low note**
and **High note** scaling values. There are 32 slots.

### Housekeeping

| Command | Purpose |
|---|---|
| `0x22` | Get firmware version |
| `0x23` | Check connection |

`0x23` is a bare liveness ping. **The reply carries no manufacturer, model or
serial information** — there is no identity exchange in this protocol at all. The
editor sends it periodically and shows "lost connection !!" when no reply
arrives.

There is also **no checksum, no length field and no ACK** on any message in
either direction. The only way to know a write landed is to read the line back
and compare.

### Calibration and file transfer — undocumented

| Command | Name in the editor's source | Status |
|---|---|---|
| `0x0C` | `SYS_SET_CALIB` | Implemented in firmware. No editor control sends it |
| `0x0D` | `SYS_SET_CALIB2` | **Declared by the editor, absent from the firmware.** A no-op |
| `0x0F` | `SYS_SET_CALIB_DAC` | Implemented in firmware. No editor control sends it |
| `0x0E` | `SYS_RECEIVE_FILE` | Implemented. No editor control sends it |
| `0x10` | `SYS_VIEW_FILE` | Implemented. No editor control sends it |

Unreachable from any editor's interface. The calibration opcodes are the only
sign that [calibration](specifications.md#calibration) exists at all.

`TODO(verify)`: the payload format for all of them. Nothing documents them.

**Opcode `0x24` (36) writes a microtonal tuning table** — confirmed from the
firmware. It carries **twelve 14-bit cents values**, one per pitch class. This is
the format the editor's [Tuning tab](editor.md#the-tuning-tab) uses to send a
tuning to table 1–8.

`TODO(verify)`: the write format is firmware-derived, not yet hardware-confirmed —
the Tuning tab gates the first send behind a confirmation and marks the tuning
Unverified until it is checked on hardware. A sent table writes to working memory;
there is no confirmed save-to-flash path, so it may not survive a power-cycle.

**Do not experiment with the calibration commands on a working module.** A
mis-formed calibration payload is the one plausible way to leave the outputs
producing wrong voltages with no documented route back. See
[Can I break my module?](troubleshooting.md#can-i-break-my-module).

---

## Firmware update does not use SysEx

There is no SysEx path for firmware. Updates use the RP2040's built-in
bootloader and a drag-and-dropped `.uf2` file, so nothing sent over MIDI can
corrupt the firmware — and a failed update is recoverable by repeating the
drag-and-drop. See
[Can I break my module?](troubleshooting.md#can-i-break-my-module) and
[the editor](editor.md#firmware-updates).

---

## Timing

The editor spaces its messages deliberately: 5 ms between row writes, and a
pause before the save command. A full configuration is 24 rows plus globals plus
32 mappings — around 57 messages.

If you write your own tool, do the same. Sending the whole configuration as fast
as your MIDI stack allows risks overrunning the module's input buffer.

---

## Backup file format

The official editor's **save to file** produces plain text:

- 24 lines, one per row, nine semicolon-separated values each
- one line of global parameters
- 32 lines of CC map slots, six values each

Readable, diffable, and reasonable to keep in version control. This is the only
backup of a preset that lives off the module — see
[the editor](editor.md#backing-up).

The companion editor in `app/` uses JSON for import and export instead. Both
describe the same underlying 9-byte rows.

---

## Related

- `spec/protocol.md` — the authoritative protocol description
- `spec/model.json` — the parameter model, mechanically derived
- [Appendix: parameter tables](appendix-parameter-tables.md) — what the values in
  each output byte mean
- [Appendix: default CC map](appendix-cc-map.md)
