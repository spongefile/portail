# Appendix: scales and microtonal tables

---

## The 24 scales

Available in [Scale](fx/scale.md)'s **Scale** parameter, in menu order.

| # | Name | Notes |
|---|---|---|
| 0 | `chromatic` | All twelve. The default, and a no-op |
| 1 | `major` | Ionian |
| 2 | `minor` | Natural minor / Aeolian |
| 3 | `harmonic minor` | Minor with a raised seventh |
| 4 | `pentatonic major` | Five notes, no semitone clashes |
| 5 | `pentatonic minor` | Five notes, the safest choice for random sources |
| 6 | `blues` | Minor pentatonic plus the flat fifth |
| 7 | `dorian` | Minor with a raised sixth |
| 8 | `phrygian` | Minor with a flattened second |
| 9 | `lydian` | Major with a raised fourth |
| 10 | `mixolydian` | Major with a flattened seventh |
| 11 | `locrian` | Diminished fifth; unstable by design |
| 12 | `whole note` | Whole-tone. Six notes, no tonal centre |
| 13 | `diminished` | Alternating semitone and tone |
| 14 | `whole half diminished` | The other diminished mode |
| 15 | `quint` | Fifths |
| 16 | **Octaves** | Root only, in every octave |
| 17 | `major chord` | Root, third, fifth |
| 18 | `minor chord` | Root, flat third, fifth |
| 19 | `major 7th chord` | Root, third, fifth, seventh |
| 20 | `minor 7th chord` | Root, flat third, fifth, flat seventh |
| 21 | `major 6th chord` | Root, third, fifth, sixth |
| 22 | `minor 6th chord` | Root, flat third, fifth, sixth |
| 23 | `minor dim 7 chord` | Diminished seventh |

The official manual lists none of them, saying only "Select the scale". See
[audit §13](audit.md).

`TODO(verify)`: the exact interval content of each. The names above are standard
and the intervals given are the conventional readings, but the firmware's actual
tables are not published. **Test:** set a CV output to `Note`, add Scale with
**Root note** `C`, select a scale, and play a chromatic octave from `C3` upward while
watching which output pitches appear. Notes that map onto the same output pitch
as their neighbour are not in the scale. That gives you the scale's degrees
directly.

The last seven entries are chords rather than scales, which makes them more
aggressive quantisers — they collapse twelve pitch classes onto three or four.
That is useful: point a [Random](modes/random.md) output at `major chord` and you
get broken-chord arpeggios rather than a melody. **Octaves** collapses everything to
the root, turning randomness into octave jumps.

### Root note

**Root note** is a separate parameter with twelve values: `C`, `C#`, `D`, `D#`,
`E`, `F`, `F#`, `G`, `G#`, `A`, `A#`, `B`.

It sets the key, not the starting note of the part. `pentatonic minor` with
**Root note** `A` is A minor pentatonic wherever in the register you happen to be
playing.

---

## The 8 microtonal tables

[Microtonal](fx/microtonal.md)'s **Tuning table** parameter offers `table 1`
through `table 8`. This was one of the module's biggest unknowns; the firmware
(version 0.83r) has now settled it.

### What they contain

**All eight ship as identical standard 12-tone equal temperament** — 100 cents
per semitone, zero deviation. Confirmed from the firmware.

| Pitch class | C | C♯ | D | D♯ | E | F | F♯ | G | G♯ | A | A♯ | B |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Factory cents, all 8 tables** | 0 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 1000 | 1100 |
| **Deviation from 12-TET** | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

There are **no exotic factory tunings**. The eight tables are **empty,
user-customisable slots** whose reset default is plain equal temperament — which
is why the editor lists them as bare "table 1 … 8" with no names. Nothing is
pre-loaded, so there is nothing to name.

`table 1` is therefore a **confirmed safe standard-tuning default**: you can leave
Microtonal in a chain on `table 1` and it will not change your pitch.

### Format

| Property | Value |
|---|---|
| Count | 8 tables |
| Definition | 12 values, one per pitch class (C, C♯ … B) |
| Unit | **cents**, 14-bit |
| Expansion | `note_cents = (octave × 1200) + table[pitch class]` |
| Persistent storage | device flash — **not** in the firmware image |
| Wire write | SysEx opcode `0x24`, twelve 14-bit cents values |

Because a table lives in the module's own flash rather than in the firmware image,
**a customised table can only be read back off the physical module** — it cannot
be derived from the firmware the way the factory default was.

### Reading a table a module has been given

You only need this if a table has been **customised** away from the default; a
factory table is standard tuning and needs no measuring.

1. Set CV 1 to **Mode** `Note`, **Channel** `ch 1`, no FX slots.
2. Play `C3` through `C4` chromatically, measuring the jack at each semitone. This
   is your **12-TET reference**: twelve equal steps of 83.3 mV, C4 exactly 1.000 V
   above C3.
3. Add `FX 1: Microtonal, Target CV 1, Tuning table` set to the slot to read.
4. Repeat the measurement. Each step that differs from 83.3 mV is that pitch
   class's tuning. Convert with **cents = millivolts × 1.2** (83.3 mV = 100 cents).

A factory table simply measures as even 83.3 mV steps, confirming it is untouched.

### Recording a customised table

If a module carries custom tunings and you measure them, this is a useful format —
this is per-module data, not a fact about all Portails:

| Table | Reads as | Cents per pitch class (C … B) |
|---|---|---|
| 1 | 12-TET (factory) | 0 100 200 … 1100 |
| 2 | (whatever the owner stored) | |
| … | | |

### Editing a table

Author and send tunings from the editor's
**[Tuning tab](editor.md#the-tuning-tab)**: enter twelve cents values per table
(C is normally 0, but the root is editable — a non-zero root transposes the whole
table; the module adds the octave), or import a Scala `.scl` file, then send to
table 1–8. Only 12-note, octave-repeating scales fit the module's tables.

A factory **Quarter-tone (24-TET offset)** tuning ships — every pitch class +50
cents. One table holds only 12 pitch classes, so full 24-TET (24 pitches/octave)
does not fit a single table and a 24-note `.scl` is refused on import; instead
pair one output on 12-TET with a second on the quarter-tone table, and together
they cover the full 24-TET set — the approach for quarter-tone music like
**Angine de Poitrine**.

The write format is firmware-derived and not yet hardware-confirmed, so the first
send asks for confirmation and the tuning stays **Unverified** until you check it
plays in tune; and a sent tuning writes to **working memory**, so it may not
survive a power-cycle — re-send after power-on. Reading a table (the procedure
above) is unaffected. Full detail on the
[Tuning tab](editor.md#honesty-what-the-app-can-and-cannot-promise).

---

## Related

- [Scale](fx/scale.md) — quantising to a scale
- [Microtonal](fx/microtonal.md) — retuning
- [Recipes → microtonal and scale playback](recipes/microtonal.md)
- [unverified.md](unverified.md)
