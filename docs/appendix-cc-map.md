# Appendix: the default CC map

Portail has two separate ways for an incoming CC to change a parameter. They are
easy to confuse, and the official manual describes one of them and promises the
other without delivering it.

---

## Two mechanisms

### 1. The CC map — 32 slots you build yourself

Explicit mappings. Each binds one CC on one channel to one parameter of one row,
with **Low note** and **High note** scaling. You create them by MIDI learn in the editor.

This is fully documented: see
[Concepts §7](concepts.md#7-the-cc-map-controls-parameters-from-cc) and
[the editor](editor.md#the-cc-map).

### 2. The default CC map — built into the firmware

A pre-assigned CC for most parameters, active without you configuring anything.
The official manual describes it as:

> "By default, each parameter except the channel is assigned to a cc mapping who
> will be specified next to it."

and then writes the placeholder `(CC##)` next to six parameters and nothing at
all next to the rest. **The map itself is never given.** It is the most
frequently promised and never-delivered item in the document — see
[audit §1](audit.md).

---

## What is confirmed about the default map

- **It exists**, and it is stored in firmware rather than in the editor.
- **It is readable over SysEx.** The editor requests it with command 19 and
  displays a CC number next to each parameter once connected.
- **It is indexed by row and parameter.** The editor's storage is a flat array
  addressed as `(row × 8) + (parameter − 2)`, covering 24 rows of 8 parameters —
  192 entries. The offset of 2 skips the **Mode** and **Channel** parameters, which
  matches the manual's "each parameter except the channel".
- **It can be switched off**, with the global **Disable default midi mapping**
  setting.
- **The global CC channel** selects which MIDI channel it listens on.

---

## What is not confirmed

`TODO(verify)`: **the actual CC number assigned to each parameter.**

The values live in firmware and appear in no primary source. They are not in the
editor's source, because the editor reads them from the module.

### Reading your module's map

This is the reliable way to find out, and it takes a few minutes:

1. Connect the module to the editor and select it.
2. Read the current configuration from the module. The editor requests the
   mapping table as part of this.
3. **Look at the parameter labels.** Once the map has been read, the official
   editor appends the assigned CC number in brackets to each parameter's label —
   the label text becomes the first five characters of the name followed by the
   CC number in parentheses.
4. Work through the rows and write down what you see.

The map is per row *and* per parameter, so a full readout is up to 192 entries.
In practice you only need the rows you are using.

### Recording it

If you produce a full readout, it belongs here. A useful format:

| Row | Parameter | Default CC |
|---|---|---|
| CV 1 | **Voice mode** | `TODO(verify)` |
| CV 1 | **Bend range** | `TODO(verify)` |
| … | … | |

---

## Why this matters even if you never use it

**The default map is active unless you disable it.** So a CC you send for some
other purpose may be changing a Portail parameter you did not intend to change.

If a parameter drifts while you play, or a patch behaves differently after you
touch a controller, the default map is a strong suspect. Two things to try:

- **Turn on Disable default midi mapping** in the global settings, then save.
  If the problem stops, the default map was the cause.
- **Move the global CC channel** to a channel nothing else uses. That leaves the
  map active but out of the way of your playing.

---

## CC numbers that are spoken for

Regardless of the default map, these CCs already have jobs on Portail:

| MIDI CC | Used by | Notes |
|---|---|---|
| 1 | [Note](modes/note.md) vibrato depth | On every Note output, on its own channel. Not optional and not configurable |
| 1 upward | [Sequencer](modes/seq.md) step values | A Sequencer output with **Steps** `8` consumes CC1–CC8 on its channel |
| Whatever you map | CC map | 32 slots, on the global CC channel |
| Unknown | Default map | Until you read it or disable it |

**The safe range is CC 20–31.** Those are conventionally undefined in the MIDI
specification, so most controllers and DAWs leave them alone. Use them for your
own [MIDI CC](modes/cc.md) outputs and CC map slots and you will avoid nearly
all collisions.

**Avoid CC 1** for anything general-purpose. It will make your pitch wobble on
any channel that has a Note output with `vibrato` set.

---

## Related

- [Concepts §7](concepts.md#7-the-cc-map-controls-parameters-from-cc)
- [The editor → the CC map](editor.md#the-cc-map)
- [Appendix: SysEx notes](appendix-sysex.md)
- [unverified.md](unverified.md)
