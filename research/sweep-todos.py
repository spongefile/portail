#!/usr/bin/env python3
"""Sweep TODO(verify) markers in docs/ and check unverified.md indexes them all.

Usage:
  python3 research/sweep-todos.py           # report coverage
  python3 research/sweep-todos.py --chapters # print a by-chapter index
"""
import os, re, sys, collections

DOCS = 'docs'
INDEX = 'docs/unverified.md'

CHAPTER = [
    ('docs/quick-start.md', 'Quick start'),
    ('docs/concepts.md', 'Concepts'),
    ('docs/modes/', 'Mode reference'),
    ('docs/fx/', 'FX reference'),
    ('docs/recipes/', 'Recipes'),
    ('docs/editor.md', 'The editor'),
    ('docs/on-module.md', 'On-module controls'),
    ('docs/troubleshooting.md', 'Troubleshooting'),
    ('docs/specifications.md', 'Specifications'),
    ('docs/appendix', 'Appendices'),
]

def chapter_of(p):
    for prefix, name in CHAPTER:
        if p.startswith(prefix):
            return name
    return 'Other'

def markers():
    for r, _, fs in os.walk(DOCS):
        for f in sorted(fs):
            if not f.endswith('.md'):
                continue
            p = os.path.normpath(os.path.join(r, f))
            if p == INDEX:
                continue
            for i, line in enumerate(open(p), 1):
                if 'TODO(verify)' in line:
                    ctx = line.strip()
                    ctx = re.sub(r'^[>\-\*\|\s]*', '', ctx)
                    # neutralise markdown links so the generated index does not
                    # carry relative paths that are wrong in its own location
                    ctx = re.sub(r'\[([^\]]*)\]\([^)]*\)', r'\1', ctx)
                    yield p, i, ctx

found = list(markers())
by_chapter = collections.defaultdict(list)
for p, i, ctx in found:
    by_chapter[chapter_of(p)].append((p, i, ctx))

idx = open(INDEX).read()
# every file carrying a marker must be referenced somewhere in the index
files_with = sorted({p for p, _, _ in found})
missing = []
for p in files_with:
    rel = os.path.relpath(p, DOCS)
    stem = os.path.splitext(os.path.basename(p))[0]
    if rel not in idx and stem not in idx:
        missing.append(p)

if '--chapters' in sys.argv:
    for name, _ in CHAPTER:
        pass
    for name in [c for _, c in CHAPTER] + ['Other']:
        items = by_chapter.get(name)
        if not items:
            continue
        print(f"\n## {name}\n")
        for p, i, ctx in items:
            print(f"- `{os.path.relpath(p, DOCS)}:{i}` — {ctx[:110]}")

print(f"\n{len(found)} TODO(verify) markers across {len(files_with)} files")
for name in [c for _, c in CHAPTER] + ['Other']:
    if by_chapter.get(name):
        print(f"  {name:22} {len(by_chapter[name]):3}")
if missing:
    print("\nNOT REFERENCED IN unverified.md:")
    for p in missing:
        print("  " + p)
    sys.exit(1)
print("\nAll files carrying markers are referenced in docs/unverified.md.")
