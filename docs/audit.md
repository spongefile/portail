# Audit of the official Portail manual

**Source audited:** `portail_manual_v1.pdf`, 30 pages, title page reads
"Portail MIDI to CV Converter: User Manual V0.9". Retrieved from the Google Drive
link on <https://www.eowave.com/modules/portail> and saved to
`research/portail_manual_v1.pdf`. A plain-text extraction is at
`research/portail_manual_v1.txt`.

**Cross-checked against:** the shipped web editor's source
(`research/original-editor/`), which contains the canonical parameter tables
(`js/menu.js`, `js/notes.js`), the SysEx command set (`js/midi.js`), and the
editor's per-type default values (`js/about.js`); plus the product page
(`research/eowave-portail-page.html`).

Everything below is a defect in the *document*, not in the module. The hardware
is more capable than its manual manages to convey. That gap is the whole reason
this rewrite exists.

---

## 1. It is an unfinished draft, and it says so

The version string is **V0.9**. More to the point, the placeholder
cross-references were never filled in. The manual ships with them intact:

- `"start using one of the 8 preset of the Portail ( see p# or connect it to the editor)"`
- `"Disable default midi mapping: disable the cc control grid ( see p#)"`
- `"See chapter # at the end of the manual for upgrade details."`
- `"If you want to reassign the CC, see the chapter#"`

The output-type index on page 6 is a table of seventeen rows in which **every
single page number is the literal string `Page#`**:

```
Note    CV   Page#
Gate    D-GATE   Page#
Trig    CV & D-GATE  Page#
...
CC RECORDER (Sequencer) CV              Page#
```

The effect index on page 21 does the same thing for all eight entries listed
there. So the two tables whose only job is navigation navigate nowhere.

The same applies to the CC assignments. The manual promises:

> "By default, each parameter except the channel is assigned to a cc mapping who
> will be specified next to it."

and then writes the placeholder `(CC##)` next to six parameters — Length,
Velocity sensitive, Minimum, Range, Range, Filter — and nothing at all next to
the rest. **The default CC map is never given.** This is the single most
frequently promised and never-delivered item in the document.

**What the rewrite does:** [Appendix: default CC map](appendix-cc-map.md) explains
what the map actually is, how to read it out of your own module, and marks the
values `TODO(verify)` because they live in firmware and are not in any primary
source I could obtain.

---

## 2. It contradicts itself about how many presets exist

Page 2:

> "It can stock up to **16** configuration preset"

Page 3:

> "start using one of the **8** preset of the Portail"

The editor source settles it — `inline-script.js` builds the preset menu with
`for (let i = 1; i <= 8; i++)` — and the product page's feature list agrees:
"8 preset configurable via the app". The number is 8. A reader who only has the
manual has no way to know which of its two answers to trust.

---

## 3. Mode descriptions do not say what comes out of the jack

This is the deepest structural problem. The manual describes each mode in terms
of the MIDI message going in, and then describes each parameter as a restatement
of the parameter's own name. It almost never states the voltage, the polarity,
the timing, or the shape of the signal that appears at the jack.

The pattern repeats verbatim across nine modes:

> **Range :**
> Set the range of the CV output

> **Filter :**
> Choose the amount of filtering on the cv output (glide time)

"Set the range of the CV output" is not a description of a range. The reader
wants to know: *which* ranges? The editor's `range_cv_menu` answers it — the
choices are `+/-5V, 10V, 5V, 4V, 3V, 2V, 1V, -1V, -2V, -3V, -4V, -5V`, twelve
options, and a Gate output gets a completely different list
(`range_gate_menu`: `10V` down to `1V`, ten options). **Neither list appears
anywhere in the manual.** Nor does the fact that the two output banks have
different range menus at all.

Likewise:

- **Glide** on a Note output. The manual says "Set the glide time between two
  notes" and stops. It never says the control is 0–127 with no unit shown.
- **Vibrato.** "the vibrato parameter will set the frequency" — but not that the
  range is roughly 0.06 Hz to 37 Hz over 99 steps, nor that the *depth* comes
  from CC#1 and is therefore zero until you move a mod wheel. A reader who sets
  Vibrato and hears nothing has been given no way to work out why.
- **Rise / Fall** on a Gate ("Up" and "Down" in the manual, "rise" and "fall" in
  the editor — see §7). "Set the time of a small attack envelope for the gate."
  The word "small" is doing a lot of work: the actual table runs from 13 ms to
  **67 seconds**.
- **Trig Length.** "set a fixed time between 1 and 127 ms" — this one is
  correct and specific, which shows the document knew how to do it and mostly
  didn't.

**What the rewrite does:** every mode page opens with a section literally titled
"What comes out of the jack", and every parameter is given with its range, its
unit, and its default. See [the mode reference](modes/index.md).

---

## 4. Whole paragraphs are copy-paste of the wrong mode

Several effect descriptions describe a different effect. These are not subtle:

| Effect | What the manual says it does | What it does |
|---|---|---|
| **CHANCE** | "Randomly changes the octave of the note being played." | Sets the probability that a note plays at all |
| **ACCUMULATE** | "Randomly add a note interval to the note being played." | Adds a running transposition each time it fires |
| **DELAY** | "Randomly add a note interval to the note being played." | Delays a gate by 0–1041 ms |
| **LOGIC** | "Randomly add a note interval to the note being played." | Combines two gates with a boolean function |
| **HUMANIZE** | "Randomly add a note delay to the note being played." | (correct, unusually) |

CHANCE is the worst of them, because the error propagates. Its parameter list
correctly names `Probability` and `Vel pro`, but the body below then documents a
parameter called **`Range : Select the octave range`** that CHANCE does not have,
copied wholesale from RANDOM OCTAVE, and defines `Probability` as "the
probability of the new note to be played at another randomized octave" — which is
RANDOM OCTAVE's meaning, not CHANCE's. A reader following this text will
configure the wrong thing and have no idea.

---

## 5. Some parameters are documented as a question mark

Page 24, ACCUMULATE, in full:

```
Amount :
?

Reset :
?
```

Page 26, HUMANIZE, the sentence simply stops:

```
Amount :
set the amount of
```

Page 15, RANDOM, the heading is present and the body is empty:

```
Random level (only for D-Gate) :

Range :
set the range of the CV output
```

---

## 6. Direct factual errors

- **Mono modes.** "mono low will prioritize the lowest midi note received on the
  CV output / mono high will prioritize the **lowest** midi note received on the
  CV output". Both say lowest. `mono hi` takes the highest.
- **Envelope times.** "set the attack time between 0 ms and 13 secondes". The
  editor's `env_times` table is 128 entries running from `2.1 ms` to
  `134217.7 ms` — that is 134 *seconds*, an order of magnitude past what the
  manual claims, and the floor is 2.1 ms, not 0.
- **RANDOM's Length parameter** is attributed to both banks in the same section.
  The parameter list says "Length (only for **D-Gate**)"; four paragraphs later
  the heading reads "Length (only for **cv**)". The editor puts `length_menu` on
  the Gate version only, so the parameter list was right and the body is wrong.
- **RANDOM's Source.** The manual offers three sources: "from a midi channel
  note / from another CV line / from the master clock". The editor's
  `source_menu` has exactly two entries: `note` and `clock`. There is no CV-line
  option.
- **CC RECORDER** is headed "CV & D-GATE". It exists only on CV outputs — it is
  absent from the editor's `menus["gate"]` list. The manual's own index on page 6
  gets this right ("CC RECORDER (Sequencer) CV"), so the document disagrees with
  itself two pages apart.
- **EUCLIDEAN is listed as a gate effect.** Page 25's "D-GATE FX" list reads
  `DELAY / HUMANIZE / LOGIC / RANDOM VELOCITY / RANDOM TRIG LENGTH / EUCLIDEAN /
  INVERT / REPEAT`. Euclidean is an output *mode*, not an effect; it is not in
  the FX menu. Meanwhile the real gate effect **CHANCE** is filed under "NOTE FX",
  and the FX index omits five effects the editor actually has.
- **XNOT.** The logic table defines "XNOT". The operator is XNOR, and the editor
  labels it `XNOR`.

---

## 7. The manual and the editor use different words for the same control

A reader with the manual open beside the editor has to translate. Every one of
these is a mismatch between the manual's heading and the editor's on-screen label:

| Manual says | Editor shows | Mode |
|---|---|---|
| Up / Down | `rise` / `fall` | Gate |
| Val min / Val max, then Minimum / Range | `minimum` / `range` | Trig |
| Poly/Mono Group | `out type` | Note |
| Type | `waveform` | LFO |
| Speed | `div` | LFO |
| Steps | `length` | Sequencer, Euclidean |
| Note in function | `note in dest` | Sequencer |
| Probability | `distribution` | Random Octave, Random Note |
| MOD MATRIX / "cc mapping" / "the cc control grid" | `MOD MATRIX` | — |

The Trig section is the clearest case: the parameter list calls them "Val min"
and "Val max", the headings below call them "Minimum" and "Range", and the editor
calls them "minimum" and "range". Three names, two controls, one page.

**What the rewrite does:** uses the editor's label as the canonical name
everywhere, because that is the string the reader is actually looking at, and
gives the manual's alternative names in a glossary entry so search still works.

---

## 8. The on-module controls are never documented

The module has two buttons and per-output LEDs. The manual mentions a button
exactly once, in the firmware-update procedure on the last page:

> "press the left button of the portail (▼) and power up your module"

And even that one gesture is under-specified. It does not say how long to hold
the button, whether it must be held until the `RPI-RP2` volume mounts, or whether
releasing early aborts the attempt. This is the module's only documented button
press, it is the recovery path from a failed firmware update, and it is described
in a single subordinate clause.

That is the entire coverage. It never says:

- what either button does in normal operation
- how to select one of the 8 presets without a computer, despite page 3
  instructing the reader to "start using one of the 8 preset of the Portail"
- what the LEDs indicate
- that a reduced on-module editor exists at all

The product page and press coverage both describe on-module preset recall and a
simple embedded MIDI-learn. The manual describes neither.

**What the rewrite does:** [On-module controls](on-module.md) documents what is
confirmed and marks the rest `TODO(verify)` with an explicit button-press test
the reader can run, rather than guessing at a key combination.

---

## 9. Features are advertised that the editor does not expose

The product page lists **Velocity VCA** ("use an output to modify the amplitude of
another output") and **Math** ("binary operation on midi notes") among the
available effects. The task brief for this rewrite lists them too.

In the shipped editor they are commented out of the menu:

```js
menus["fx"]=["OFF","NOTE FILTER","RANDOM OCT","RANDOM NOTE","CHANCE","ACCUMULATE",
  "TRANSPOSE","SCALE","MICROTONAL","DELAY","HUMANIZE","LOGIC","RANDOM VEL",
  "RANDOM TRIG LENGTH","INVERT","REPEATS"];//,"LFO MOD","CC MOD"];//"CONDITIONAL","MODULATE","VCA","MATHS",
```

Their parameter definitions still exist in `menu_labels` and `fx_select`, so the
firmware may well implement them — they are simply unreachable from the editor.
The manual does not mention them at all, in either direction: it neither
documents them nor warns that the advertised features are unavailable.

**What the rewrite does:** [Modifier reference](fx/index.md) documents the
15 reachable modifiers and carries an explicit note about the six that are
defined but not exposed. Listed in [unverified.md](unverified.md).

---

## 10. Ordering assumes what it has not yet given

The document's running order is: Introduction → D-Gate concept → Installation →
Editor connection → Editor UI tour → Global settings → Output types → Effects →
CC mapping → Firmware.

Two problems follow from that.

**The central concept arrives before the reader knows there are jacks.** Page 2,
the second paragraph the reader ever sees, is:

> "But first , we need that small bite of explanation:
> What are D-GATEs outputs and what are the differences between D-GATE and CV
> outputs?"

At this point the manual has not said how many outputs there are, where they are,
what a Eurorack CV output does, or that the module is not yet in a rack. It
explains a distinction before establishing the things being distinguished.

**Global settings come before the reader knows what they affect.** The GLOBAL tab
is documented on page 5. It sets the master clock source and tempo. The modes
that consume the master clock — Clock, LFO, Sequencer, Euclidean, Arpeggiator,
Random — are documented on pages 12 through 19. So the reader is asked to choose
between "Internal" and "External" clock roughly ten pages before encountering
anything that uses a clock.

The same inversion applies to the polyphony instructions on page 7, which tell
the reader to "link D-gates outputs (with the gate, trig, velocity and envelope
types) to these CV voices by selecting one of the CV who is in the polyphonic
group in their source parameter" — a sentence that depends on the Gate mode's
`source` parameter, documented on the following page, and on Envelope's `source`,
documented seven pages later.

**What the rewrite does:** [Concepts](concepts.md) establishes outputs, banks,
modes, modifiers, the clock, and presets once, before any reference material.
Reference pages then assume only Concepts.

---

## 11. Jargon used before (or without) definition

Terms the manual uses as though they were already understood:

- **D-Gate / "Dynamic Gate"** — expanded once, in the introduction, then used
  throughout with the outputs also called "Gate", "D-GATE", "dynamic gates" and
  "gates rows" interchangeably.
- **latch** — appears in Trig ("Latch will make the trig output act as a gate"),
  in Euclidean's Gate Length, and in Random's Length, where it is described as
  "latch is always random change the time every gate", which is not parsable.
- **note in dest / "Note in function"** — the same parameter under two names,
  defined only as "Choose if an inputted note transpose or randomise the
  sequence", which does not cover the CC Recorder's four options (`clear seq`,
  `arm record`, `start record`, `gate start/stop`).
- **poly group** — used before the polyphony mechanism is explained, and the
  explanation never states the obvious limit, that four groups exist and the
  voice count equals the number of CV rows you assign to a group.
- **source** — means three different things depending on mode: a CV row (Gate,
  Trig, Velocity, Envelope), a MIDI note number (Poly AT), or a trigger origin
  (Random). Never disambiguated.
- **post FX** — never mentioned in the manual at all, though the editor's source
  distinguishes note-domain effects from gate-domain "post" effects
  (`debut_post_fx = 9`) and this determines what an effect can be applied to.
- **"note scale"** — an option in the CC and CC Recorder Range menus, mentioned
  once in passing ("select note scale if you want v/oct notes"), never explained.
- **PPQN** — never mentioned. The manual gives clock divisions as `1/16`, `1/4`
  and so on without stating what they divide, so a reader wiring Portail to a
  sequencer that wants 24 PPQN has nothing to go on.

---

## 12. There is not one worked example

The manual contains no patch, no cabling diagram, no "do this, then this, and you
will hear that". The closest it comes are four scattered "Use case" sentences of
one line each, e.g.:

> "Use case : it can avoid clicks when the gate is for example used to control
> VCA"

and one abstract FX-chaining example on page 20 (FX1 → FX2 → FX5 into CV1) that
uses no concrete values.

For a module whose entire premise is that 16 jacks can be *anything*, the absence
of worked configurations is the difference between a feature list and a manual.
The most common things a buyer will want on day one — a polyphonic voice, drum
triggers from a groovebox, a correctly-divided clock, velocity into a VCA —
require assembling information from four to six separate pages, and in the
polyphony case require a parameter documented later than the instruction to use
it (§10).

**What the rewrite does:** [Recipes](recipes/index.md) — eight worked patches,
each with goal, cabling, exact settings, expected result, and what to check when
it fails.

---

## 13. Nothing on specifications, calibration, or the protocol

Absent entirely:

- **A specifications table.** No HP, no depth, no current draw. (The product page
  has them: 5 HP, 110 mA +12 V, 20 mA −12 V, 0 mA 5 V.)
- **Output voltage specs.** One sentence in the introduction gives "−5 and +10V"
  for CV and "0 and 10V" for D-Gate, and it is never restated, tabulated, or
  reconciled with the per-mode range menus, whose most negative option is −5 V and
  most positive is 10 V.
- **Calibration.** The firmware exposes three calibration SysEx commands
  (`SYS_SET_CALIB`, `SYS_SET_CALIB2`, `SYS_SET_CALIB_DAC`). The manual never
  mentions that calibration exists.
- **The SysEx protocol.** Page 2 tells the reader they can configure the module
  "or by sending SYSEX messages" and then never documents a single message. The
  manual is the only document eowave publishes, so there is no other place to
  look.
- **The scale list.** SCALE offers 24 scales; the manual says "Select the scale".
- **The microtonal tables.** MICROTONAL offers 8 tables; the manual says "Select
  the table where the notes will go thru" and never says what is in them, whether
  they are user-loadable, or how.
- **MIDI THRU output.** The global settings describe copying MIDI to "the MIDI
  OUT port on the back of the module". No connector list anywhere mentions a MIDI
  output, and the product page lists inputs only. Either there is an undocumented
  rear connector or the feature description is wrong; the manual gives the reader
  no way to tell.

---

## 14. Troubleshooting is one bullet

The manual's entire troubleshooting section:

> "**Possible Troubleshoot:**
> If you are using the Portail with your phone and the USB cable is disconnected,
> you might need to reload the page to reconnect to the Portail once replugged
> (even if the portail is selected in the interface menu)."

Nothing on: no sound, wrong pitch, notes stuck on, gates too short to trigger
anything, clock running at the wrong speed, settings lost at power-off, editor
not seeing the module. The last of these is especially conspicuous because the
editor has a "lost connection !!" state built into it.

**What the rewrite does:** [Troubleshooting](troubleshooting.md), organised by
symptom — what you observe — rather than by cause, since a reader in trouble
knows the symptom and not the cause.

---

## 15. Smaller things, collected

- **Typos and grammar that impede meaning**, not merely polish: "continious",
  "Higer", "substracted", "secondes", "afilter", "the maser clock", "the envelope
  retire itself at its end", "a high gate when the a midi start message is
  received who stay high until a midi stop message is received", "limits the
  maximum value that a sort will take into account" (product page, describing
  Note Filter).
- **The Sequencer's CC collision is never flagged.** Sequencer steps read CC1,
  CC2, CC3 … on the selected channel. CC1 is also the mod wheel, which the Note
  mode uses for vibrato depth. A reader who has both on the same channel gets
  interference the manual gives no warning about.
- **"Speed: A slider and number box to set the tempo of the internal clock, from
  30 to 250 BPM. ( you can also control the speed with the CC#"** — the sentence
  ends mid-word, and the range is wrong for the mapped parameter: the editor's
  slider is capped at 250, but `clock_speed_menu` is 128 steps of 2 BPM starting
  at 30, i.e. 30–284 BPM when reached via a CC mapping.
- **Firmware update section never states what the current version is**, how to
  read the version off the module, or what changed. The editor requests a version
  string over SysEx and displays it, so the information exists.

---

## What this drove in the rewrite

| Audit finding | Response |
|---|---|
| §3 modes don't say what comes out | Every mode page answers the same four questions, in the same order, starting with the jack |
| §1, §13 numbers missing or placeholder | Every range, unit and default stated; anything unconfirmed is `TODO(verify)` with a test |
| §7 manual/editor vocabulary mismatch | Editor labels are canonical; alternatives cross-referenced |
| §10 ordering | One Concepts page before all reference |
| §12 no examples | Eight worked recipes |
| §14 one-bullet troubleshooting | Symptom-first troubleshooting |
| §8 on-module UI undocumented | Dedicated page, gaps marked with tests |
| §9 phantom features | Documented as unreachable, listed in `unverified.md` |
