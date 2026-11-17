# LFO

**Available on:** CV outputs and Gate outputs.

LFO produces a repeating modulation waveform locked to the master clock. There is
no free-running rate control — the speed is always a division of the clock, so
an LFO is always in time.

---

## What comes out of the jack

A **repeating waveform** of the shape set by **Waveform**, at a rate set by
**Clock division**, with amplitude set by **Level range**.

On a CV output with **Level range** `= +/-5 V` the waveform is bipolar, swinging through
0 V. With a unipolar range like `5 V` it runs from 0 V to 5 V. On a Gate output
only unipolar ranges exist.

The waveforms:

| **Waveform** | Shape |
|---|---|
| `Saw up` | Ramps up, resets down |
| `Saw down` | Ramps down, resets up |
| `Square` | Alternates between the extremes |
| `Triangle` | Linear up then linear down |
| `Sine` | Smooth |
| `Noise` | Continuously random, changing every clock division |
| `random` | Sample-and-hold: a new random level held for each division |

`Noise` and `random` are both random, and the difference between them is not
documented. `TODO(verify)`: **test:** set both in turn with **Clock division** `1/4` and watch
on a scope. If one steps once per beat and the other changes continuously, the
stepping one is `random` and the other is `Noise`.

`Square` on a Gate output makes a usable clock divider — a square wave at `1/4`
is a quarter-note gate.

---

## What MIDI drives it

Two things:

- **The master clock** sets the rate, via **Clock division**. Internal or external — see
  [Concepts §8](../concepts.md#8-one-master-clock-feeds-everything-time-based).
- **Note-on messages** on the selected **Channel** affect the phase, if **Phase mode** is
  not `Continuous`.

---

## Parameters

> **If you are using the official editor**, some of these controls have different names on screen. This manual uses the vocabulary in `spec/glossary.md`, which gives one name to each concept; the official editor reuses several names for unrelated things. On this page:
>
> - **Clock division** — the editor says `div`
> - **Level range** — the editor says `range`



| Parameter | Values | Default | Notes |
|---|---|---|---|
| **Channel** | `ch 1` … `ch 16` | `ch 1` | Only used by `Note reset` and `Gated` modes |
| **Waveform** | `Saw up`, `Saw down`, `Square`, `Triangle`, `Sine`, `Noise`, `random` | `Saw up` | |
| **Clock division** | `32/1`, `16/1`, `4/1` … `1/32`, triplets, dotted — 25 options | `4/1` | Division of the master clock |
| **Phase mode** | `Continuous`, `Note reset`, `Gated` | `Continuous` | Phase behaviour |
| **Level range** | CV: `+/-5 V`, `10 V` … `1 V`, `-1 V` … `-5 V`<br/>Gate: `10 V` … `1 V` | CV: `+/-5 V`<br/>Gate: `10 V` | Amplitude |

The editor spells the first mode `Continuous`. That is the on-screen string.

### Clock division

The LFO's division list is not the same as [Clock](clock.md)'s. It starts two
steps slower, with `32/1` (thirty-two bars) and `16/1` (sixteen bars) at the top,
for very slow evolving modulation. The default `4/1` is one cycle every four
bars.

Full list in
[Appendix: parameter tables](../appendix-parameter-tables.md#lfo-divisions).

### Phase mode

- **`Continuous`** — the LFO free-runs, locked to the clock but never restarted.
  Two LFOs at the same division stay in a fixed phase relationship with each
  other. Use this for background movement.
- **`Note reset`** — every note-on on **Channel** restarts the waveform from its
  beginning. This makes the LFO behave like a repeating envelope, and it is what
  you want when the modulation should feel attached to each note.
- **`Gated`** — the LFO runs only while a key is held, and stops when released.

`TODO(verify)`: what the output does in `Gated` mode between notes — whether it
holds its last value or falls to 0 V. **Test:** set `Gated` with a slow **Clock division**
like `1/1`, hold a note until the waveform is partway up, release, and measure
the jack.

---

## What it's for

**Tempo-locked filter movement that resets with each phrase.**

- CV 7: **Mode** `LFO`, **Channel** `ch 1`, **Waveform** `triangle`, **Clock division** `1/2`,
  **Phase mode** `note reset`, **Level range** `5 V`.

Patch CV 7 to a filter cutoff. The filter sweeps up and down over a half-note,
in time, and restarts cleanly every time you play a new note rather than
wandering out of phase with the music.

**A second one, free:** set a Gate output to `LFO`, **Waveform** `square`,
**Clock division** `1/4`, **Level range** `10 V`. That is a quarter-note clock, produced without
spending a [Clock](clock.md) output — useful when you have run out of jacks and
need one more steady pulse.
