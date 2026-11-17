import { describe, it, expect, beforeEach } from 'vitest';
import { SimulatorDevice } from '../src/device/simulator';
import { emptyConfig, lineWithDefaults, diffConfigs } from '../src/model/model';
import type { PortailConfig } from '../src/model/types';

function sampleConfig(name = 'sample'): PortailConfig {
  const c = emptyConfig(name);
  c.lines[0] = lineWithDefaults('cv', 1);    // NOTE
  c.lines[3] = lineWithDefaults('cv', 9);    // LFO
  c.lines[8] = lineWithDefaults('gate', 1);  // GATE
  c.lines[16] = lineWithDefaults('fx', 7);   // SCALE
  c.globals = [0, 0, 0, 120, 0, 0, 16, 0];
  c.modMatrix[0] = { statusHigh: 11, channel: 0, number: 74, targetLine: 3, targetParam: 3, valueMin: 0, valueMax: 5 };
  return c;
}

describe('simulator — full device behaviour without hardware', () => {
  let dev: SimulatorDevice;

  beforeEach(async () => {
    dev = new SimulatorDevice({ latency: 0, dropRate: 0 });
    await dev.start();
  });

  it('connects and reports firmware', () => {
    const state = dev.getState();
    expect(state.status).toBe('connected');
    if (state.status === 'connected') expect(state.firmware).toMatch(/^\d+\.\d+/);
  });

  it('write then read round-trips a full config', async () => {
    const cfg = sampleConfig();
    await dev.writeConfig(cfg);
    const read = await dev.readConfig();
    expect(read.partial).toBe(false);
    const diff = diffConfigs(cfg, read.config);
    expect(diff.lines).toHaveLength(0);
    expect(diff.globals).toBe(false);
    expect(diff.modMatrix).toBe(false);
  });

  it('a dropped-packet link produces a partial read that names what was missed', async () => {
    dev.dropRate = 0.5; // half the messages vanish
    const read = await dev.readConfig();
    // With 50% loss across 57 reads, a partial is overwhelmingly likely and must be reported.
    if (read.partial) {
      expect(read.missing.length).toBeGreaterThan(0);
    } else {
      // vanishingly unlikely, but not a failure — the point is it never lies about completeness
      expect(read.missing).toHaveLength(0);
    }
  });

  it('preset save uses recall→resend→save→verify and reports ok', async () => {
    const cfg = sampleConfig('slot 3 patch');
    const result = await dev.savePreset(3, cfg);
    expect(result.ok).toBe(true);
    expect(result.slot).toBe(3);
    expect(result.mismatches).toHaveLength(0);

    // The saved slot survives a recall of a different slot and back.
    await dev.loadPreset(0);
    await dev.loadPreset(3);
    const read = await dev.readConfig();
    expect(diffConfigs(cfg, read.config).lines).toHaveLength(0);
  });

  it('getCurrentPreset reflects the last recall', async () => {
    await dev.loadPreset(5);
    expect(await dev.getCurrentPreset()).toBe(5);
  });

  it('MIDI-learn: arming then injecting a CC emits a learn event', async () => {
    const learns: { statusHigh: number; channel: number; number: number }[] = [];
    dev.on('learn', (m) => learns.push(m));
    await dev.setLearnMode(true);
    dev.injectMidi([0xb2, 74, 100]); // CC 74 on ch 3
    expect(learns).toHaveLength(1);
    expect(learns[0]).toMatchObject({ statusHigh: 0xb, channel: 2, number: 74 });
  });

  it('activity events fire for both directions', async () => {
    let inCount = 0, outCount = 0;
    dev.on('activity', (e) => { if (e.direction === 'in') inCount++; else outCount++; });
    await dev.readConfig();
    expect(outCount).toBeGreaterThan(0);
    expect(inCount).toBeGreaterThan(0);
  });
});
