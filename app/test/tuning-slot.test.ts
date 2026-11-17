// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { mountTuning } from '../src/ui/tuning';
import { tuningLibrary } from '../src/state/tuning-library';

describe('tuning send slot (single source of truth)', () => {
  it('send targets the CHOSEN slot even after an intervening re-render', async () => {
    tuningLibrary.markHardwareVerified(); // skip the confirm dialog
    const sends: number[] = [];
    const container = document.createElement('div');
    document.body.appendChild(container);
    mountTuning(container, {
      send: async (slot) => { sends.push(slot); },
      isConnected: () => true,
      deviceLabel: () => 'test',
      toast: () => {},
    });

    // choose table 6 (index 5) — the picker is now a radio grid, so click its cell
    const cell = container.querySelector('#tuning-slot-cell-5') as HTMLButtonElement;
    cell.click();

    // force a full re-render between selection and send (a library change)
    tuningLibrary.add('trigger a re-render');

    // press Send (the tuning button is now labelled "Send tuning to table N")
    const sendBtn = Array.from(container.querySelectorAll('button')).find((b) => b.textContent?.startsWith('Send tuning to table'))!;
    sendBtn.click();
    await Promise.resolve(); await Promise.resolve();

    expect(sends).toEqual([5]); // NOT 0 (a stale DOM/param read would send the default)
  });
});
