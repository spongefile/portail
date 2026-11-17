# CC recorder

**Available on:** CV outputs only.

CC recorder records the movement of one CC into a step grid and plays it back in
time. Where [Sequencer](seq.md) reads one CC per step live, CC recorder captures a
single CC over time and loops what it captured.

The official manual heads this section "CV & D-Gate". It is CV-only — it does not
appear in the Gate mode list. See [audit §6](../audit.md).

---

## What comes out of the jack

A **stepped voltage**, one value per step, looping at **Steps** steps and
advancing one step per **Clock division**.

With **Level range** `= note scale` the steps are 1 V/oct pitches instead of a continuous
voltage, which turns the recorder into a note sequencer.

With **Glide** above `OFF` the output slides between steps.

Before anything is recorded the output sits at 0 V.

---

## What MIDI drives it

- **The master clock** advances the steps.
- **The CC set by **CC number, on the selected **Channel**, is what gets recorded.
- **The note set by `Note`**, on the selected **Channel**, triggers the transport
  action chosen by **Note action**.

### Recording

Recording is armed and started by playing the `Note` you have assigned, with
**Note action** set appropriately. The four transport actions are:

| **Note action** | What playing `Note` does |
|---|---|
| `clear seq` | Erases the recorded sequence |
| `arm record` | Arms recording; capture begins at the next loop start |
| `start record` | Begins recording immediately |
| `gate start/stop` | Starts and stops playback |

Only one action can be assigned at a time, so a full workflow means changing
**Note action** between takes — or mapping the parameter to a CC through the
[CC map](../concepts.md#7-the-cc-map-controls-parameters-from-cc) so you
can switch actions from a controller.

`TODO(verify)`: whether recording overwrites the whole loop or only the steps
that pass while you are moving the CC, and whether `arm record` stops
automatically after one pass. **Test:** record a sequence, then set
**Note action** `start record`, trigger it, and move the CC for only the first half
of the loop. If the second half retains its old values, recording is
punch-in style; if it is zeroed, each take replaces the whole loop.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **CC number** — the editor says `number`
> - **Clock division** — the editor says `div`
> - **Level range** — the editor says `range`
> - **Note action** — the editor says **Note** `in dest`
> - **Steps** — the editor says `length`



| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Channel** | `ch 1` … `ch 16` | `ch 1` | |
| **CC number** | `0` … `127` | `1` | Which CC to record |
| **Clock division** | `4/1` … `1/32`, triplets, dotted | `1/16` | Clock division per step |
| **Steps** | `1` … `64` | `16` | Steps in the loop |
| **Glide** | `OFF`, `1` … `100` | `OFF` | Slide between steps |
| `Note` | `all`, then `C#-2` … `G8` | `C3` | Note that triggers the transport action |
| **Note action** | `clear seq`, `arm record`, `start record`, `gate start/stop` | `clear seq` | Transport action |
| **Level range** | `+/-5 V`, `10 V` … `1 V`, `-1 V` … `-5 V`, **Note** `scale` | `10 V` | Output scaling |

Leaving `Note` at `all` means every note on the channel triggers the transport
action, which is rarely what you want. Set a specific note — ideally one outside
your playing range, like `C-1`.

---

## What it's for

**Capturing a filter sweep you performed, and looping it.**

- CV 4: **Mode** `CC recorder`, **Channel** `ch 1`, **CC number** `74`, **Clock division** `1/16`,
  **Steps** `32`, **Glide** `10`, **Note** `C-1`, **Note action** `start record`,
  **Level range** `5 V`.

Patch CV 4 to a filter cutoff. Play C-1 to start recording, sweep the CC 74 knob
for two bars, and the movement loops from then on — quantised to sixteenths, with
a little glide to smooth the steps.

Change **Note action** to `clear seq` and play C-1 again to wipe it and start
over.
