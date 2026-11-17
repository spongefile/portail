// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { emptyConfig, lineWithDefaults } from '../src/model/model';
import { chainForOutput, isFxInert, outputModeWakesFx, fxWakeModeNames } from '../src/model/fx';

// CV modes: note=1 (wakes note-FX), lfo=9 (does not). A Scale FX (index 7) targets a CV output.
function withCvFx(cvMode: number) {
  const s = new Store();
  const c = emptyConfig('seed');
  c.lines[0] = lineWithDefaults('cv', cvMode);
  s.replaceConfig(c, 'read'); s.setDeviceConfig(c);
  const fxLine = s.insertFx(0, 7); // Scale FX on CV 1
  return { s, fxLine: fxLine! };
}

describe('FX inert when the target output stops producing its input (docs/fx/index.md:33)', () => {
  it('a Note-FX on a CV output in Note mode is live; in LFO mode it is inert', () => {
    const live = withCvFx(1);
    expect(outputModeWakesFx(live.s.get().config, 0)).toBe(true);
    expect(isFxInert(live.s.get().config, live.fxLine)).toBe(false);
    expect(chainForOutput(live.s.get().config, 0)[0]!.inert).toBe(false);

    const dead = withCvFx(9);
    expect(outputModeWakesFx(dead.s.get().config, 0)).toBe(false);
    expect(isFxInert(dead.s.get().config, dead.fxLine)).toBe(true);
    expect(chainForOutput(dead.s.get().config, 0)[0]!.inert).toBe(true);
  });

  it('wake-mode names come from the model, by bank', () => {
    expect(fxWakeModeNames(true)).toContain('Note');    // CV bank
    expect(fxWakeModeNames(false)).toContain('Gate');   // GATE bank
  });

  it('changing an output to a non-producing mode strands its FX and toasts once — never deletes', () => {
    const { s, fxLine } = withCvFx(1);          // live
    const before = s.getToasts().length;
    s.setLineMode(0, 9);                          // Note -> LFO strands the FX
    expect(isFxInert(s.get().config, fxLine)).toBe(true);
    // FX is KEPT (still in the chain, slot still claimed), not removed
    expect(chainForOutput(s.get().config, 0).length).toBe(1);
    // exactly one new toast about it
    const toasts = s.getToasts();
    expect(toasts.length).toBe(before + 1);
    expect(toasts[toasts.length - 1]!.message).toMatch(/inert/i);
  });

  it('does not toast when changing between two producing modes', () => {
    const { s } = withCvFx(1);                    // Note (wakes)
    const before = s.getToasts().length;
    s.setLineMode(0, 13);                          // arp (also wakes) — no stranding
    expect(s.getToasts().length).toBe(before);
  });
});

import { renderChainStrip } from '../src/ui/signalflow';

describe('FX inert — UI', () => {
  it('an inert FX chip is marked, kept, and labelled with the modes that would wake it', () => {
    const { s } = withCvFx(9); // LFO output → the Scale FX is inert
    const strip = renderChainStrip(s, 0);
    expect(strip.querySelector('.fx-chip.is-inert')).toBeTruthy();
    expect(strip.querySelector('.chain-inert-note')!.textContent).toMatch(/needs/i);
  });

  it('the insert menu hides FX on a non-producing output and says what would show them', () => {
    const s = new Store();
    const c = emptyConfig('seed');
    c.lines[0] = lineWithDefaults('cv', 9); // LFO — no note-FX apply
    s.replaceConfig(c, 'read');
    const strip = renderChainStrip(s, 0);
    expect(strip.querySelector('.chain-insert')).toBeNull();          // no insert select offered
    expect(strip.querySelector('.chain-insert-hint')!.textContent).toMatch(/choose output to add FX/i);
  });
});
