// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { renderConnection, type SyncActions } from '../src/ui/connection';
import { SimulatorDevice } from '../src/device/simulator';
import { emptyConfig, lineWithDefaults, cloneConfig } from '../src/model/model';

const noop = () => {};
const actions: SyncActions = {
  selectPort: noop, readFromModule: async()=>{}, sendToModule: async()=>{},
  checkModule: async()=>{}, resolveConflict: noop, reconnect: async()=>{},
  useHardware: noop, useSimulator: async()=>{}, simulatePanelChange: noop,
} as unknown as SyncActions;

function observe(store: Store, device: SimulatorDevice, label: string) {
  const bar = renderConnection(store, device, actions, { phase: 'idle', label: '', done: 0, total: 0 });
  const pill = bar.querySelector('.sync-pill')?.textContent ?? '(no pill)';
  const btns = Array.from(bar.querySelectorAll('button')).map(b => b.textContent?.trim()).filter(Boolean);
  console.log(`STEP ${label}\n   pill: "${pill}"\n   buttons: [${btns.join(' | ')}]`);
  return { pill, btns };
}

describe('OBSERVED conflict flow (renders real connection bar)', () => {
  it('walks the 7-step script and logs pill + buttons', async () => {
    const device = new SimulatorDevice({ latency: 0 });
    await device.start();
    const store = new Store();
    const seed = emptyConfig('seed'); seed.lines[0] = lineWithDefaults('cv', 1); seed.lines[3] = lineWithDefaults('cv', 1);

    // 1. Read → in-sync
    store.replaceConfig(cloneConfig(seed), 'read'); store.setDeviceConfig(cloneConfig(seed));
    const s1 = observe(store, device, '1 READ');
    expect(s1.pill).toContain('Matched simulator'); expect(s1.btns).toContain('Send to simulator');

    // 2. Local edit → modified (a meaningful byte — channel; padding bytes no longer count)
    store.setLineByte(3, 1, 5);
    const s2 = observe(store, device, '2 EDIT (no send)');
    expect(s2.pill).toContain('Not sent');

    // 3+4. Module drifts under us, re-read → conflict, Send/Read REPLACED by Resolve…
    const drifted = cloneConfig(seed); drifted.lines[3] = lineWithDefaults('cv', 9);
    store.observeDeviceDrift(drifted);
    const s4 = observe(store, device, '3+4 DRIFT + CHECK → conflict');
    expect(s4.pill).toContain('Conflict');
    expect(s4.btns).toContain('Resolve…');
    expect(s4.btns).not.toContain('Send to simulator');
    expect(s4.btns).not.toContain('Read from simulator');

    // 5. Resolve dialog content (both change lists populated)
    const ch = store.conflictChanges();
    console.log(`STEP 5 RESOLVE DIALOG\n   EDITOR CHANGED: [${ch.editor.join(' | ')}]\n   MODULE CHANGED: [${ch.device.join(' | ')}]`);
    expect(ch.editor.length).toBeGreaterThan(0); expect(ch.device.length).toBeGreaterThan(0);

    // 6. Take the module's → in-sync, undoable
    store.takeModuleVersion();
    const s6 = observe(store, device, '6 TAKE MODULE VERSION');
    expect(s6.pill).toContain('Matched simulator');
    expect(store.canUndo()).toBe(true);
    console.log(`   undo available after resolve: ${store.canUndo()}`);

    // 7. Device-ahead alone → Send/Read still present (gating is conflict-only)
    const store2 = new Store();
    store2.replaceConfig(cloneConfig(seed), 'read'); store2.setDeviceConfig(cloneConfig(seed));
    const d2 = cloneConfig(seed); d2.lines[3] = lineWithDefaults('cv', 9);
    store2.observeDeviceDrift(d2);
    const s7 = observe(store2, device, '7 DEVICE-AHEAD (editor untouched)');
    expect(s7.pill).toContain('Module changed');
    expect(s7.btns).toContain('Send to simulator');
    expect(s7.btns).toContain('Read from simulator');
  });
});