# Envelope

**Available on:** CV outputs and Gate outputs.

Envelope generates a full envelope inside Portail. In a small system this is the mode
that saves the most space — every output can be an envelope, so 5 HP can supply
eight of them.

---

## What comes out of the jack

An **envelope voltage** that rises and falls in the shape set by **Shape**, peaking
at **Level range**.

| **Shape** | What it does |
|---|---|
| `AR` | Attack to peak, then release. **Decay** and **Sustain** are unused |
| `AD` | Attack to peak, then decay to zero. Ignores note-off entirely |
| `ADSR` | Attack, decay to **Sustain**, hold while the note is held, then release |
| `Loop` | The envelope restarts as soon as it finishes, running as an LFO |

`AD` is the drum envelope: it completes regardless of how long the key is held,
so a short trigger gives the same shape as a long one.

`Loop` turns Envelope into a shape-adjustable LFO whose rate is set by the time
parameters rather than by a clock division — the one modulation source on
Portail that is *not* locked to the master clock.

The output rests at 0 V when idle.

---

## What MIDI drives it

Depends on **Trigger source**:

- ****Trigger source** `= note`** — note-ons on the selected **Channel**, filtered by `Note`.
- ****Trigger source** `= CV 1` … `CV 8`** — the envelope fires with whatever note is
  assigned to that CV output. This is how each voice in a polyphonic group gets
  its own envelope.

The `Note` parameter filters further: `all` means any note, or set a specific
pitch so only that note fires the envelope. That makes an Envelope output work as a
per-drum-voice envelope from a single channel.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Level range** — the editor says `range`
> - **Trigger source** — the editor says `source`
> - **Shape** — the editor says `type` (its second one, on the same output)



| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Channel** | `ch 1` … `ch 16` | `ch 1` | Hidden when **Trigger source** is a CV output |
| **Trigger source** | `Note`, `CV 1` … `CV 8` | `Note` | What triggers the envelope |
| `Note` | `all`, then `C#-2` … `G8` | `all` | Which note triggers it |
| **Shape** | `AR`, `AD`, `ADSR`, `Loop` | `ADSR` | Envelope shape |
| **Attack** | 128 steps, `2.1 ms` … `134217.7 ms` | `2.2 ms` | Exponential scale |
| **Decay** | 128 steps, `2.1 ms` … `134217.7 ms` | `15.6 ms` | Exponential scale |
| **Sustain** | `0` … `100` | `100` | Level, as a percentage of **Level range** |
| **Release** | 128 steps, `2.1 ms` … `134217.7 ms` | `15.6 ms` | Exponential scale |
| **Level range** | CV: `+/-5 V`, `10 V` … `1 V`, `-1 V` … `-5 V`<br/>Gate: `10 V` … `1 V` | CV: `+/-5 V`<br/>Gate: `10 V` | Peak level |

### The time scale

**Attack**, **Decay** and **Release** share one 128-entry exponential table. The
extremes are worth knowing:

| Step | Time |
|---|---|
| 0 | 2.1 ms |
| 41 | 10.0 ms |
| 50 | 15.6 ms |
| 76 | 80.0 ms |
| 101 | 1.07 s |
| 110 | 5.59 s |
| 120 | 26.8 s |
| 127 | 134.2 s |

The official manual says the range is "between 0 ms and 13 secondes". Both ends
are wrong: the floor is 2.1 ms and the ceiling is over two minutes. See
[audit §6](../audit.md). Full table in
[Appendix: parameter tables](../appendix-parameter-tables.md#envelope-times).

Because the scale is exponential, the low steps are closely spaced — steps 0 to
20 cover only 2.1 ms to 4.2 ms — and the top steps jump enormously. Fine control
lives in the lower two-thirds.

### Sustain

A percentage of **Level range**, not an absolute voltage. With **Level range** `5 V` and
**Sustain** `50`, the sustain level is 2.5 V.

Only used by `ADSR`. In `AR` and `AD` it is ignored.

---

## What it's for

**A drum envelope from a single trigger.**

- GATE 3: **Mode** `Envelope`, **Channel** `ch 10`, **Trigger source** `note`, **Note** `C1`, **Shape** `ad`,
  **Attack** `2.1 ms`, **Decay** around step 76 (`80 ms`), **Level range** `10 V`.

Patch GATE 3 to a VCA controlling a noise source. Every C1 on channel 10 gives a
percussive click whose length you set with **Decay**, independent of how long the
MIDI note lasts.

**A polyphonic use:** with CV 1–3 in a poly group, set three Envelope outputs with
**Trigger source** `CV 1`, `CV 2`, `CV 3` and **Shape** `adsr`. Each voice gets its own envelope
that starts and releases with its own note.
