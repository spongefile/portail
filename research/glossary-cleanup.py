#!/usr/bin/env python3
"""Second pass: fix headings, missed tokens and value strings after apply-glossary.py."""
import os, re

SKIP = {'docs/audit.md'}

PER_FILE = {
    'docs/modes/note.md': [('`vibrato`', '**Vibrato rate**')],
    'docs/modes/seq.md': [('**Length**', '**Steps**')],
    'docs/modes/cc-recorder.md': [('**Length**', '**Steps**')],
    'docs/recipes/expression.md': [('`vibrato`', '**Vibrato rate**')],
    'docs/recipes/daw-mono.md': [('`vibrato`', '**Vibrato rate**')],
    'docs/troubleshooting.md': [('`vibrato`', '**Vibrato rate**')],
}

VALUES = [
    ('`mono last`', '`Mono last`'), ('`mono low`', '`Mono low`'),
    ('`mono hi`', '`Mono high`'),
    ('`poly group 1`', '`Poly group 1`'), ('`poly group 2`', '`Poly group 2`'),
    ('`poly group 3`', '`Poly group 3`'), ('`poly group 4`', '`Poly group 4`'),
    ('`note reset`', '`Note reset`'), ('`gated`', '`Gated`'),
    ('`saw up`', '`Saw up`'), ('`saw down`', '`Saw down`'),
    ('`square`', '`Square`'), ('`triangle`', '`Triangle`'),
    ('`sine`', '`Sine`'), ('`noise`', '`Noise`'),
    ('`ar`', '`AR`'), ('`ad`', '`AD`'), ('`adsr`', '`ADSR`'), ('`loop`', '`Loop`'),
    ('`forward`', '`Forward`'), ('`backward`', '`Backward`'),
    ('`pendulum`', '`Pendulum`'),
    ('`latch`', '`Latch`'),
    ('`start/stop`', '`Start/stop`'), ('`reset`', '`Reset`'),
    ('`internal`', '`Internal`'), ('`external`', '`External`'),
    ('`added`', '`Added`'), ('`replaced`', '`Replaced`'),
    ('`gates`', '`Gates`'),
    ('`transpose`', '`Transpose`'),
    ('`note`', '`Note`'),
    ('`clock`', '`Clock`'),
    ('`off`', '`Off`'), ('`on`', '`On`'),
]

def fix_headings(t):
    # strip ** emphasis inside ATX headings
    def f(m):
        return m.group(1) + m.group(2).replace('**', '')
    return re.sub(r'^(#{1,6}\s+)(.*)$', f, t, flags=re.M)

n = 0
for r, _, fs in os.walk('docs'):
    for fn in sorted(fs):
        if not fn.endswith('.md'):
            continue
        p = os.path.normpath(os.path.join(r, fn))
        if p in SKIP:
            continue
        s = open(p).read()
        o = s
        for a, b in PER_FILE.get(p, []):
            o = o.replace(a, b)
        for a, b in VALUES:
            o = o.replace(a, b)
        o = fix_headings(o)
        # tidy: "**X** …" at start of a table cell is fine; collapse doubled bold
        o = o.replace('****', '')
        if o != s:
            open(p, 'w').write(o)
            n += 1
print(f"cleaned {n} files")
