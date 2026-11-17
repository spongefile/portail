import { describe, it, expect } from 'vitest';
import { model, modesFor, familyOfMode, modeColor, iconForMode, bytesForFamily } from '../src/model/model';
import { MODE_FAMILIES, familyOfKey, FAMILY_ORDER, familyColor } from '../src/model/families';
import type { Family } from '../src/model/types';

const families: Family[] = ['cv', 'gate', 'fx'];

describe('model integrity', () => {
  it('has the expected mode counts', () => {
    expect(modesFor('cv')).toHaveLength(15);
    expect(modesFor('gate')).toHaveLength(14);
    expect(modesFor('fx')).toHaveLength(16);
  });

  it('every CV/gate mode key maps to a real family with a colour (except OFF)', () => {
    for (const family of ['cv', 'gate'] as Family[]) {
      for (const mode of modesFor(family)) {
        const fam = familyOfMode(family, mode.index);
        expect(MODE_FAMILIES[fam]).toBeDefined();
        if (mode.key === 'off') expect(modeColor(family, mode.index)).toBeNull();
        // familyColor() returns a CSS var (--fam-<id>) so the palette is restyleable per theme.
        else expect(modeColor(family, mode.index)).toMatch(/^var\(--fam-/);
      }
    }
  });

  it('the six families cover exactly the documented palette (shape, not colour values)', () => {
    expect(Object.keys(MODE_FAMILIES).sort()).toEqual(
      ['clock', 'expression', 'gate', 'modulation', 'off', 'pitch'],
    );
    // Colours live in styles.css as --fam-<id> (the only source of truth); this asserts SHAPE — a
    // hex copy here would just re-arm the drift that removing MODE_FAMILIES.color fixed.
    expect(FAMILY_ORDER.filter((f) => f !== 'off')).toEqual(['pitch', 'expression', 'modulation', 'gate', 'clock']);
    for (const f of FAMILY_ORDER) { expect(MODE_FAMILIES[f].id).toBe(f); expect(MODE_FAMILIES[f].label.length).toBeGreaterThan(0); }
    // non-off families render a colour via a CSS var; off renders none
    expect(familyColor('off')).toBeNull();
    expect(familyColor('pitch')).toMatch(/^var\(--fam-/);
  });

  it('ARP and SEQ are in the Pitch family, not a separate Sequence family', () => {
    expect(familyOfKey('arp')).toBe('pitch');
    expect(familyOfKey('seq')).toBe('pitch');
    expect(familyOfKey('gate_seq')).toBe('pitch');
  });

  it('every mode resolves to an icon id (spec icon or key placeholder)', () => {
    for (const family of families) {
      for (const mode of modesFor(family)) {
        expect(iconForMode(family, mode.index)).toBeTruthy();
      }
    }
  });

  it('FX lines are 8 bytes, CV/gate 9', () => {
    expect(bytesForFamily('fx')).toBe(8);
    expect(bytesForFamily('cv')).toBe(9);
    expect(bytesForFamily('gate')).toBe(9);
  });

  it('reproduces the spec 7-bit clamp warnings', () => {
    expect(model.validation.clampWarnings.length).toBeGreaterThanOrEqual(4);
  });
});
