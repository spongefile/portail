# eowave Portail — Canonical Vocabulary

**This file is binding.** The app's UI strings and the manual's prose both use the terms in the
**Canonical** column, spelled exactly as written here. If a term is not in this file, it has not been
agreed; add it here first.

Why this exists: the official editor, the official manual and the official product page use *three
different names* for several concepts, and reuse *one name* for several unrelated concepts. Most of
the "the manual is unclear" complaint is this, not missing information.

---

## 1. The hard rules

1. **One term per concept.** No synonyms "for variety". Repeating the same word is correct.
2. **One concept per term.** If a word means two things, at least one gets renamed.
3. **Legacy names get a redirect, once.** The manual mentions the old editor's word once, in the
   relevant section, as *"(the official editor calls this …)"*. It does not then keep using it.
4. **Machine names are `snake_case`, human labels are Sentence case.** `level_range` / "Level range".
   The machine name is what appears in `model.json` and in app code; the label is what a user sees.
5. **Never say "type" for an output's function.** It is a **mode**. See §3.

---

## 2. Core objects

| Canonical | Machine name | Definition | Do **not** use |
|---|---|---|---|
| **Portail** | — | The module. Always capitalised, never "the portail". | portal, Portail module |
| **CV output** | `cv` | One of the 8 sixteen-bit outputs, −5 V to +10 V. Numbered **CV 1**–**CV 8**. | CV line, CV row, CV track, CV channel |
| **Gate output** | `gate` | One of the 8 twelve-bit outputs, 0 V to +10 V. Numbered **GATE 1**–**GATE 8**. | D-Gate, gate line, gate row, dynamic gate |
| **FX slot** | `fx` | One of the 8 MIDI processors. Numbered **FX 1**–**FX 8**. **Not an output.** | effect row, FX line, modifier, MIDI effect |
| **CC map** | `cc_map` | The 32-slot table mapping incoming MIDI to parameters. | mod matrix, modulation matrix, MIDI mapping |
| **CC map slot** | `cc_map_slot` | One of the 32 entries in the CC map. | mapping row, mod line |
| **Preset** | `preset` | One of the 8 stored configurations. Numbered **Preset 1**–**Preset 8**. | patch, bank, memory |
| **Configuration** | `config` | The complete set of 24 lines + globals + CC map, live in RAM. | patch, state, settings |
| **Line** | `line` | Internal term for one 9-byte configuration record. **Protocol/spec only — never shown to users.** | row |

### 2.1 "D-Gate"

The official manual calls the gate outputs **D-GATE** ("Dynamic Gate"). The front panel says
**GATE**. The editor's tab says **GATE**.

**Canonical: "Gate output".** The manual introduces the vendor's term exactly once —

> The Gate outputs are labelled **GATE** on the panel. eowave's own documentation sometimes calls
> them **D-Gates**, for "dynamic gates", because unlike a plain on/off gate their voltage can follow
> note velocity. They are the same eight outputs.

— and then says "Gate output" everywhere after. Do not alternate between the two.

### 2.2 Why "CC map" and not "mod matrix"

The editor's tab is labelled **MOD MATRIX**, but the thing has nothing to do with modulation in the
modular sense — it maps incoming MIDI CCs to editor parameters. Worse, "mod" collides with
**modifier** (eowave's marketing word for FX) and with the LFO/envelope modulation the module
genuinely does produce. **Canonical: CC map.** Mention "MOD MATRIX" once, when pointing at the
official editor's tab.

### 2.3 Why "FX" and not "modifier"

eowave's product page calls these **Modifiers**; the manual calls them **MIDI Effects**; the editor
says **FX**. "Modifier" collides with "MOD MATRIX" and reads as a modulation source, which these are
not. **Canonical: FX**, because it matches the panel-adjacent editor label users already know and
collides with nothing.

---

## 3. Mode vs. type — the worst collision

The editor uses the word **"type"** for **four different things**, sometimes two of them in one row:

| Where | What it actually means | Canonical |
|---|---|---|
| First dropdown of a CV/Gate row | The output's function (NOTE, LFO, ENV…) | **Mode** |
| First dropdown of an FX row | Which effect this is | **FX type** |
| `ENV` → parameter 4 | AR / AD / ADSR / Loop | **Shape** |
| Gate `SEQ` → parameter 2 | Whether steps emit gates or CC values | **Step output** |
| `RANDOM VEL` → parameter 3 | Add / subtract / replace | **Blend** |

So: an output has a **mode**; an FX slot has an **FX type**; an envelope has a **shape**.
A sentence like "set the type of the type" cannot occur.

---

## 4. Range — the second-worst collision

The editor labels **five unrelated parameters** "range". Each gets its own canonical name, chosen so
the unit is obvious from the word:

| Canonical | Machine name | Unit | Appears in |
|---|---|---|---|
| **Level range** | `level_range` | volts | Every mode with a voltage output |
| **Level min** | `level_min` | volts | TRIG (the floor when velocity-sensitive) |
| **Bend range** | `bend_range` | semitones | NOTE |
| **Interval range** | `interval_range` | semitones | CV RANDOM, RANDOM NOTE |
| **Octave range** | `octave_range` | octaves | ARP, RANDOM OCT |

"Range" alone is **never** a parameter name. In prose, "range" may be used in its ordinary English
sense ("the range of a control"), but never as the name of a control.

---

## 5. Source — the third collision

| Canonical | Machine name | Meaning | Appears in |
|---|---|---|---|
| **Trigger source** | `trigger_source` | What fires this output: incoming notes on a channel, another CV output, or the clock | GATE, TRIG, VEL, ENV, RANDOM |
| **Clock event** | `clock_event` | Which clock event to emit: clock pulses, start/stop, or reset | CLOCK |
| **Clock source** | `clock_source` | Global: internal generator or incoming MIDI clock | Global settings |
| **Operand** | `operand` | The second input to a LOGIC operation | LOGIC |

**[Note]** The editor labels the CLOCK mode's second parameter "source", which is actively
misleading — it selects *what kind of event* to output, not where the clock comes from. That is
`clock_source`, a *global* setting. This rename is one of the highest-value fixes in this document.

---

## 6. Slew, glide, filter, smooth — all one idea

The editor uses **"filter"**, **"smooth"** and **"glide"** for what is, in three of four cases, the
same thing: how fast the output is allowed to move toward its target.

| Canonical | Machine name | Applies to | Editor's word |
|---|---|---|---|
| **Glide** | `glide` | Pitch. Portamento between notes. | glide |
| **Slew** | `slew` | Everything else. Smoothing on a CV. | filter, smooth |

Keep **Glide** for pitch because it is the established musical term and users expect it on a NOTE
output. Use **Slew** everywhere else. The manual states the relationship once: *"Glide is slew
applied to pitch."*

---

## 7. Timing vocabulary

| Canonical | Machine name | Definition |
|---|---|---|
| **Clock division** | `division` | The master-clock subdivision a generator runs at (`1/16`, `1/4`, `4/1T`…). Editor says "div". |
| **Master clock** | — | The clock all generators follow: internal generator or external MIDI clock, per **Clock source**. |
| **Length** | `length` | For TRIG/gates: duration in ms, or **Latch**. For sequencers: the number of steps. *Disambiguated by context; where both appear in one mode the step count is* **Steps**. |
| **Gate length** | `gate_length` | Duration of each emitted gate, in ms. Used where **Length** already means step count. |
| **Steps** | `steps` | Number of steps in a sequence. |
| **Fills** | `fills` | Euclidean: how many of the steps are active. Editor says "events". |
| **Rotate** | `rotate` | Euclidean: rotation of the pattern. |
| **Latch** | — | A **Length** setting where the gate stays high while the note is held. |
| **Hold** | `hold` | Arpeggiator: keep playing after keys are released. Distinct from Latch. |
| **Swing** | `swing` | Shuffle amount. |

**Latch vs Hold** are genuinely different mechanisms and must never be swapped: **Latch** is a gate
length behaviour, **Hold** is an arpeggiator behaviour.

---

## 8. Voice assignment

| Canonical | Machine name | Definition |
|---|---|---|
| **Voice mode** | `voice_mode` | How a NOTE output picks notes: **Mono last**, **Mono low**, **Mono high**, or **Poly group 1–4**. Editor says "out type". |
| **Poly group** | — | A set of NOTE outputs sharing a group number; incoming notes are distributed round-robin across them. The number of CV outputs in a group *is* the polyphony. |
| **Voice** | — | One CV output within a poly group. |

**[Note]** Manual V0.9 has a copy-paste error here: it defines *"mono high"* as "will prioritize the
**lowest** midi note", identical to its definition of "mono low". **Mono high prioritises the
highest note.** The manual rewrite must fix this.

---

## 9. FX domains

| Canonical | Definition |
|---|---|
| **Note FX** | FX that process MIDI notes before they reach a **CV output**. Target a CV output. FX types 1–8. |
| **Gate FX** | FX that process gates at a **Gate output**. Target a Gate output. FX types 9–15. |
| **FX chain** | Multiple FX slots targeting the same output, applied in **slot order** (FX 1 first). |
| **Target** | `target` — the output an FX slot acts on. Editor says "dest". |

An FX slot's domain determines which outputs it can target; the two sets do not overlap. This is
enforced by the wire encoding — see [`protocol.md` §2.3](protocol.md#23-mode-byte-encoding--fx-the-one-real-subtlety).

**[Note]** Manual V0.9 lists **EUCLIDEAN** among the Gate FX. That is wrong: Euclidean is a Gate
output **mode**, not an FX. There are 7 Gate FX, not 8.

---

## 10. Terms to retire outright

| Never write | Write instead |
|---|---|
| line, row, track (user-facing) | CV output / Gate output / FX slot |
| dest, destination | Target |
| div | Clock division |
| prm, param | Parameter |
| vel sens | Velocity sensitive |
| rnd | Random |
| out type | Voice mode *(NOTE)* / Step output *(SEQ)* |
| note in dest | Note action |
| events *(Euclidean)* | Fills |
| amout | Amount *(typo in the editor)* |
| continious | Continuous *(typo in the editor)* |
| substracted | Subtracted *(typo in the editor)* |
| ocatves | Octaves *(typo in the editor)* |

The bottom four are misspellings in the original editor's source. They appear in `model.json` only as
`legacy_label` / `domain` values, never as canonical labels. **The app must not display them.**

---

## 11. Units

Always write the unit. Always with a space before it, except `%`.

| Quantity | Written as |
|---|---|
| Voltage | `5 V`, `-5 V`, `+/-5 V` |
| Time | `2.1 ms`, `1.5 s` (switch to seconds above 1000 ms) |
| Frequency | `0.42 Hz` |
| Pitch interval | `+/-12 semitones`, `2 octaves` |
| Probability | `50%` |
| Note | `C3`, `F#-1` — scientific pitch, **C-2 = MIDI note 0**, so **C3 = MIDI 60** |
| MIDI channel | `ch 1`–`ch 16`, one-based in all user-facing text |
| Clock division | `1/16`, `1/4T` (triplet), `1/8.` (dotted) |

**[Note] The Portail's octave numbering is non-standard.** MIDI note 0 is `C-2` and middle C
(MIDI 60) is `C3`. Much of the industry calls MIDI 60 `C4`. The manual must state this explicitly
once, near the front — it is a common source of "my notes are an octave off" confusion.

---

## 12. Voice and register

- **Second person, present tense.** "Set the clock division." Not "the user should set…".
- **Say what it does before how to set it.** One sentence of purpose, then the control.
- **No exclamation marks. No "simply", "just", "easy".** If it were easy the manual would be shorter.
- **French-English artefacts get fixed silently.** The original text has many ("the note who is
  played", "a sequencer who output gates"). Do not preserve them, and do not mock them.
- **Version everything.** Any behaviour that is firmware-dependent says which firmware it was
  observed on.
