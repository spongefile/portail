#!/usr/bin/env python3
"""Rewrite terse mode/FX codes to their canonical `display` labels (spec/model.json).

Keeps the terse code only where the manual describes the hardware panel reading it
(there is no such case for modes — Portail has no screen), and leaves audit.md
untouched because it quotes the original manual and the editor's raw strings
verbatim.
"""
import os, re, json

MODEL = json.load(open('spec/model.json'))
disp = {}
for fam in ('cv', 'gate', 'fx'):
    for m in MODEL['modes'][fam]:
        disp[m['name']] = m['display']
# name -> display (union); OFF handled specially
DISPLAY = dict(disp)

# filename -> display, for link-text-by-target
FILE_DISPLAY = {
    'note': 'Note', 'gate': 'Gate', 'trig': 'Trigger', 'cc': 'MIDI CC',
    'vel': 'Velocity', 'at': 'Aftertouch', 'poly-at': 'Poly aftertouch',
    'pb': 'Pitch bend', 'clock': 'Clock', 'lfo': 'LFO', 'env': 'Envelope',
    'seq': 'Sequencer', 'cc-recorder': 'CC recorder', 'random': 'Random',
    'arp': 'Arpeggiator', 'euclidean': 'Euclidean',
    'note-filter': 'Note filter', 'random-oct': 'Random octave',
    'random-note': 'Random note', 'chance': 'Chance', 'accumulate': 'Accumulate',
    'transpose': 'Transpose', 'scale': 'Scale', 'microtonal': 'Microtonal',
    'delay': 'Delay', 'humanize': 'Humanize', 'logic': 'Logic',
    'random-vel': 'Random velocity', 'random-trig-length': 'Random trig length',
    'invert': 'Invert', 'repeats': 'Repeats',
}
# terse names that may appear as exact link text
TERSE = set(DISPLAY)  # includes multi-word like 'POLY AT'

# tokens for backtick + prose conversion, longest first so multi-word wins.
# OFF excluded (it is overwhelmingly the parameter value, not the mode).
CONV = {k: v for k, v in DISPLAY.items() if k != 'OFF'}
TOKENS = sorted(CONV, key=len, reverse=True)

def convert_links(text):
    def repl(m):
        label, target = m.group(1), m.group(2)
        stem = os.path.basename(target.split('#')[0])[:-3]  # strip .md
        if stem in FILE_DISPLAY and label in TERSE:
            return f'[{FILE_DISPLAY[stem]}]({target})'
        return m.group(0)
    return re.sub(r'\[([^\]]+)\]\(((?:\.\./)?(?:modes|fx)/[a-z-]+\.md(?:#[a-z-]+)?)\)',
                  repl, text)

def convert_backticks(text):
    for t in TOKENS:
        # bare token in backticks, not followed by space+digit (that's a jack/value)
        text = re.sub(r'`' + re.escape(t) + r'`', '`' + CONV[t] + '`', text)
    return text

def convert_prose(text):
    for t in TOKENS:
        for suffix in ('mode', 'output', 'outputs', 'source'):
            text = re.sub(r'\b' + re.escape(t) + r' ' + suffix + r'\b',
                          CONV[t] + ' ' + suffix, text)
    return text

def convert_table_leading(text):
    # "| NOTE |" table row leader -> "| Note |"; include OFF here (it is the mode row)
    m = dict(DISPLAY); m['OFF'] = 'Off'
    def repl(mo):
        code = mo.group(1)
        return '| ' + m.get(code, code) + ' |'
    return re.sub(r'^\| (OFF|NOTE|GATE|TRIG|CC|VEL|AT|POLY AT|PB|CLOCK|LFO|ENV|SEQ|CC RECORDER|RANDOM|ARP|EUCLIDEAN|NOTE FILTER|RANDOM OCT|RANDOM NOTE|CHANCE|ACCUMULATE|TRANSPOSE|SCALE|MICROTONAL|DELAY|HUMANIZE|LOGIC|RANDOM VEL|RANDOM TRIG LENGTH|INVERT|REPEATS) \|',
                  repl, text, flags=re.M)

def convert_heading(text, stem):
    # the page's own H1: "# NOTE" -> "# Note"
    if stem in FILE_DISPLAY:
        text = re.sub(r'^# [A-Z][A-Z /]*$',
                      lambda mo: '# ' + FILE_DISPLAY[stem]
                      if mo.group(0)[2:].strip() in TERSE else mo.group(0),
                      text, count=1, flags=re.M)
    return text

n = 0
for r, _, fs in os.walk('docs'):
    for f in sorted(fs):
        if not f.endswith('.md') or f == 'audit.md':
            continue
        p = os.path.join(r, f)
        s = open(p).read()
        o = s
        stem = f[:-3]
        o = convert_heading(o, stem)
        o = convert_links(o)
        o = convert_table_leading(o)
        o = convert_backticks(o)
        o = convert_prose(o)
        # tidy specials
        o = o.replace('MICROTONAL → editing', 'Microtonal → editing')
        o = o.replace('[Modifier reference]', '[FX reference]')
        if o != s:
            open(p, 'w').write(o)
            n += 1
print(f'rewrote {n} files')
