import { describe, it, expect, beforeEach } from 'vitest';
import { Store } from '../src/state/store';
import { emptyConfig, lineWithDefaults, cloneConfig } from '../src/model/model';
import type { PortailConfig } from '../src/model/types';

// Fresh store per test (localStorage is jsdom-less in node → load() falls back to fresh).
function seed(): PortailConfig {
  const c = emptyConfig('seed');
  c.lines[0] = lineWithDefaults('cv', 1); // NOTE
  return c;
}

describe('three-way sync states (DESIGN §3.3)', () => {
  let store: Store;
  beforeEach(() => { store = new Store(); });

  it('unknown until a device read', () => {
    expect(store.syncStatus().kind).toBe('unknown');
  });

  it('in-sync after read, carrying a verify time', () => {
    const dev = seed();
    store.replaceConfig(dev, 'read');
    store.setDeviceConfig(dev);
    const s = store.syncStatus();
    expect(s.kind).toBe('in-sync');
    if (s.kind === 'in-sync') expect(s.verifiedAt).toBeTypeOf('number');
  });

  it('editor-ahead (modified) after a local edit', () => {
    const dev = seed();
    store.replaceConfig(dev, 'read');
    store.setDeviceConfig(dev);
    store.setLineByte(0, 1, 3); // change CV1 channel
    expect(store.syncStatus().kind).toBe('modified');
  });

  it('device-ahead when the module drifts and the editor did not', () => {
    const dev = seed();
    store.replaceConfig(dev, 'read');
    store.setDeviceConfig(dev);
    // module changed under us: a re-read observes a different config
    const drifted = cloneConfig(dev);
    drifted.lines[3] = lineWithDefaults('cv', 9); // CV4 = LFO
    const s = store.observeDeviceDrift(drifted);
    expect(s.kind).toBe('device-ahead');
  });

  it('conflict when BOTH the editor and the module changed', () => {
    const dev = seed();
    store.replaceConfig(dev, 'read');
    store.setDeviceConfig(dev);
    store.setLineByte(0, 1, 5);                    // local edit
    const drifted = cloneConfig(dev);
    drifted.lines[3] = lineWithDefaults('cv', 9);  // module edit
    const s = store.observeDeviceDrift(drifted);
    expect(s.kind).toBe('conflict');
    if (s.kind === 'conflict') {
      expect(s.editorChanges).toBeGreaterThan(0);
      expect(s.deviceChanges).toBeGreaterThan(0);
    }
    // the dialog's change lists are populated from both sides
    const ch = store.conflictChanges();
    expect(ch.editor.length).toBeGreaterThan(0);
    expect(ch.device.length).toBeGreaterThan(0);
  });

  it('resolve → take module version makes editor match and is undoable', () => {
    const dev = seed();
    store.replaceConfig(dev, 'read');
    store.setDeviceConfig(dev);
    store.setLineByte(0, 1, 5);
    const drifted = cloneConfig(dev);
    drifted.lines[3] = lineWithDefaults('cv', 9);
    store.observeDeviceDrift(drifted);
    expect(store.syncStatus().kind).toBe('conflict');

    store.takeModuleVersion();
    expect(store.syncStatus().kind).toBe('in-sync');
    expect(store.get().config.lines[3]!.mode).toBe(9); // took the module's CV4=LFO
    expect(store.canUndo()).toBe(true);                // undoable
  });

  it('a re-read that matches clears drift back to in-sync', () => {
    const dev = seed();
    store.replaceConfig(dev, 'read');
    store.setDeviceConfig(dev);
    const drifted = cloneConfig(dev);
    drifted.lines[3] = lineWithDefaults('cv', 9);
    expect(store.observeDeviceDrift(drifted).kind).toBe('device-ahead');
    // module reverts (or we re-read the same baseline)
    expect(store.observeDeviceDrift(dev).kind).toBe('in-sync');
  });
});
