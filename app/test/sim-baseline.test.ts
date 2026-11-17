import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { emptyConfig, lineWithDefaults } from '../src/model/model';

// The simulator auto-read on connect calls setDeviceConfig ONLY (baseline learn). This pins the
// guard the peer asked verified rather than assumed: learning a baseline over unsaved local edits
// must neither clobber the editor config nor manufacture a device-drift/conflict state.
describe('baseline learn (simulator auto-read guard)', () => {
  it('setDeviceConfig with local edits: config untouched, status = modified, never conflict', () => {
    const s = new Store();
    const mine = emptyConfig('mine');
    mine.lines[0] = lineWithDefaults('cv', 1);      // my unsaved edit
    s.replaceConfig(mine, 'boot');

    const device = emptyConfig('device');            // the (re)connected simulator's own memory
    device.lines[3] = lineWithDefaults('cv', 9);
    s.setDeviceConfig(device);                       // what autoBaseline() does — and ALL it does

    expect(s.get().config.lines[0]!.mode).toBe(1);   // my edit survives
    expect(s.get().config.name).toBe('mine');
    const st = s.syncStatus();
    expect(st.kind).toBe('modified');                // edits vs baseline — the honest state
    expect(st.kind).not.toBe('conflict');            // baseline learn can never conflict
    expect(s.diffAgainstDevice()).not.toBeNull();    // and the changed-dot is available immediately
  });

  it('fresh boot (no edits): baseline learn lands in-sync when configs agree', () => {
    const s = new Store();
    const c = emptyConfig('fresh');
    s.replaceConfig(c, 'boot');
    s.setDeviceConfig(c);
    expect(s.syncStatus().kind).toBe('in-sync');
  });
});

// Node has no background-tab timer throttling, so this also pins that the auto-read is fast in a
// visible tab (~6ms/request); the glacial read seen in automation was the hidden-tab clamp, not us.
import { SimulatorDevice } from '../src/device/simulator';
describe('simulator auto-read source', () => {
  it('readConfig completes non-partial and fast enough to be silent', async () => {
    const d = new SimulatorDevice({ latency: 0 });
    await d.start();
    const t0 = Date.now();
    const res = await d.readConfig();
    expect(res.partial).toBe(false);
    expect(Date.now() - t0).toBeLessThan(2000);
    d.stop();
  });
});
