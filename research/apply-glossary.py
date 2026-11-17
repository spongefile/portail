#!/usr/bin/env python3
"""Rewrite docs/ to the canonical vocabulary in spec/glossary.md.

audit.md is excluded from parameter renames because it quotes the official
manual verbatim and discusses the editor's own labels deliberately.
"""
import os, re, sys

DOCS = 'docs'
SKIP_PARAM_RENAME = {'docs/audit.md'}

# (pattern, replacement) applied everywhere except SKIP_PARAM_RENAME
GLOBAL = [
    # --- paths / chapter name ---
    (r'\bmodifiers/', 'fx/'),
    (r'Modifier reference', 'FX reference'),
    (r'\bmodifier reference\b', 'FX reference'),
    (r'\bnote-domain modifiers\b', 'Note FX'),
    (r'\bgate-domain modifiers\b', 'Gate FX'),
    (r'\bnote-domain modifier\b', 'Note FX slot'),
    (r'\bgate-domain modifier\b', 'Gate FX slot'),
    (r'\bNote-domain\b', 'Note FX'),
    (r'\bGate-domain\b', 'Gate FX'),
    (r'\bmodifier slots\b', 'FX slots'),
    (r'\bmodifier slot\b', 'FX slot'),
    (r'\bModifiers\b', 'FX'),
    (r'\bmodifiers\b', 'FX slots'),
    (r'\bModifier\b', 'FX'),
    (r'\bmodifier\b', 'FX slot'),
    # --- CC map ---
    (r'\bmod matrix\b', 'CC map'),
    (r'\bMod matrix\b', 'CC map'),
    (r'\bMOD MATRIX\b', 'MOD MATRIX'),  # keep when naming the editor's tab
    (r'\bmod-matrix\b', 'CC map'),
    # --- Gate output casing / D-Gate ---
    (r'\bGATE outputs\b', 'Gate outputs'),
    (r'\bGATE output\b', 'Gate output'),
    (r'\bGATE bank\b', 'Gate bank'),
    (r'\bD-Gates\b', 'Gate outputs'),
    (r'\bD-Gate\b', 'Gate output'),
    # --- retired user-facing words ---
    (r'\bCV rows\b', 'CV outputs'),
    (r'\bCV row\b', 'CV output'),
    (r'\bGATE rows\b', 'Gate outputs'),
    (r'\bGATE row\b', 'Gate output'),
    (r"\brow's\b", "output's"),
    (r'\bthat row\b', 'that output'),
    (r'\beach row\b', 'each output'),
    (r'\bthe row\b', 'the output'),
    # --- editor typos ---
    (r'`continious`', '`Continuous`'),
    (r'\bcontinious\b', 'Continuous'),
    (r'`substracted`', '`Subtracted`'),
    (r'\bsubstracted\b', 'subtracted'),
    (r'\bamout\b', 'Amount'),
    (r'\bocatves\b', 'Octaves'),
]

# backticked parameter tokens -> canonical label, applied per file
PARAM = {
    '`dest`': '**Target**',
    '`div`': '**Clock division**',
    '`vel sens`': '**Velocity sensitive**',
    '`note in dest`': '**Note action**',
    '`events`': '**Fills**',
    '`gate len`': '**Gate length**',
    '`rnd level`': '**Random level**',
    '`steps`': '**Steps**',
    '`rotate`': '**Rotate**',
    '`swing`': '**Swing**',
    '`hold`': '**Hold**',
    '`glide`': '**Glide**',
    '`legato`': '**Legato**',
    '`retrig`': '**Retrigger**',
    '`rise`': '**Rise**',
    '`fall`': '**Fall**',
    '`attack`': '**Attack**',
    '`decay`': '**Decay**',
    '`sustain`': '**Sustain**',
    '`release`': '**Release**',
    '`channel`': '**Channel**',
    '`number`': '**CC number**',
    '`waveform`': '**Waveform**',
    '`speed`': '**Clock division**',
    '`mode`': '**Phase mode**',
    '`base note`': '**Base note**',
    '`probability`': '**Probability**',
    '`distribution`': '**Probability**',
    '`amount`': '**Amount**',
    '`numbers`': '**Repeats**',
    '`reset`': '**Reset after**',
    '`semitone`': '**Semitones**',
    '`octave`': '**Octaves**',
    '`scale`': '**Scale**',
    '`root note`': '**Root note**',
    '`scale tab`': '**Tuning table**',
    '`lower`': '**Lowest note**',
    '`higher`': '**Highest note**',
    '`function`': '**Function**',
    '`modulator`': '**Operand**',
    '`vel prob`': '**Velocity influence**',
    '`vel control`': '**Velocity influence**',
    '`min`': '**Low note**',
    '`max`': '**High note**',
    '`out type`': '**Voice mode**',
    '`filter`': '**Slew**',
    '`smooth`': '**Slew**',
    '`minimum`': '**Level min**',
    '`pb range`': '**Bend range**',
    '`length`': '**Length**',
    '`source`': '**Trigger source**',
    '`range`': '**Level range**',
    '`type`': '**Mode**',
}

# per-file overrides applied BEFORE the generic PARAM map
OVERRIDE = {
    'docs/modes/clock.md':   {'`source`': '**Clock event**'},
    'docs/modes/arp.md':     {'`range`': '**Octave range**', '`dir`': '**Direction**'},
    'docs/modes/random.md':  {'`range`': '**Level range**'},
    'docs/modes/poly-at.md': {'`source`': '**Note**'},
    'docs/modes/env.md':     {'`type`': '**Mode**'},
    'docs/modes/seq.md':     {'`dir`': '**Direction**'},
    'docs/modes/cc-recorder.md': {'`dir`': '**Direction**'},
    'docs/fx/random-oct.md': {'`range`': '**Octave range**'},
    'docs/fx/random-note.md':{'`range`': '**Interval range**'},
    'docs/fx/random-vel.md': {'`range`': '**Velocity range**', '`type`': '**Blend**'},
    'docs/fx/random-trig-length.md': {'`range`': '**Length range**'},
    'docs/fx/logic.md':      {'`dest`': '**Target**'},
}

def files():
    for r, _, fs in os.walk(DOCS):
        for f in sorted(fs):
            if f.endswith('.md'):
                yield os.path.normpath(os.path.join(r, f))

changed = 0
for path in files():
    src = open(path).read()
    out = src
    # links must be fixed even in audit.md
    out = out.replace('modifiers/', 'fx/')
    if path not in SKIP_PARAM_RENAME:
        for pat, rep in GLOBAL:
            out = re.sub(pat, rep, out)
        for tok, rep in OVERRIDE.get(path, {}).items():
            out = out.replace(tok, rep)
        for tok, rep in sorted(PARAM.items(), key=lambda kv: -len(kv[0])):
            out = out.replace(tok, rep)
        # voltage unit style: `+/- 5V` -> `+/-5 V`, `10 V` already fine
        out = re.sub(r'\+/-\s*(\d+)\s*V', r'+/-\1 V', out)
        out = re.sub(r'`(-?\d+)V`', r'`\1 V`', out)
    if out != src:
        open(path, 'w').write(out)
        changed += 1
print(f"rewrote {changed} files")
