/**
 * The OQ-1 preset-write gate (DESIGN.md §8, decision 6).
 *
 * Preset numbering is resolved from firmware disassembly (recall 1-8, query 0-7) but NOT yet
 * confirmed on live hardware. So the FIRST time a user writes a preset, we require a one-time,
 * un-bypassable confirmation that their module's numbering matches what we expect — a real check,
 * not a checkbox:
 *
 *   1. Ask the module which preset is active now (query, 0-based).
 *   2. Recall that same slot by its 1-based number.
 *   3. Ask again. If the module reports the same slot back, numbering round-trips as we model it.
 *
 * On success we remember it (per firmware version) so it never asks again. On mismatch we refuse the
 * write and tell the user, rather than risk writing the wrong slot. Read and back-up-all still work
 * without this gate — only WRITES are gated.
 */

import type { PortailDevice } from '../device/types';
import { confirmDialog } from '../ui/dom';

const KEY = 'portail-editor:preset-indexing-ok';

function firmwareKey(device: PortailDevice): string {
  const st = device.getState();
  const fw = st.status === 'connected' ? (st.firmware ?? 'unknown') : 'unknown';
  return `${KEY}:${fw}`;
}

function isConfirmed(device: PortailDevice): boolean {
  try { return localStorage.getItem(firmwareKey(device)) === '1'; } catch { return false; }
}

function remember(device: PortailDevice): void {
  try { localStorage.setItem(firmwareKey(device), '1'); } catch { /* private mode: will re-check next session */ }
}

/**
 * Returns true if a preset write may proceed. Runs the one-time hardware check the first time.
 * The simulator's numbering is correct by construction, so the check passes there and lets the whole
 * flow be exercised without hardware.
 */
export async function ensurePresetWriteAllowed(device: PortailDevice): Promise<boolean> {
  if (isConfirmed(device)) return true;

  const proceed = await confirmDialog({
    title: 'Confirm your module’s preset numbering (one time)',
    body:
      'Preset numbering was recovered by reading the firmware but has not been confirmed on real ' +
      'hardware. Before the first preset save, the editor checks it directly: it will read the ' +
      'current preset, recall it, and read again to make sure the module lands where expected. ' +
      'Nothing is overwritten by this check.',
    confirmLabel: 'Run the check',
  });
  if (!proceed) return false;

  try {
    const before = await device.getCurrentPreset();
    if (before === null) {
      await confirmDialog({
        title: 'Could not read the current preset',
        body: 'The module did not report its active preset, so the numbering check cannot run. Preset saving stays locked until this succeeds. Try again with the module connected.',
        confirmLabel: 'OK',
      });
      return false;
    }
    // `before` is 0-based (query). Recall the same slot by its 1-based payload, then re-read.
    await device.loadPreset(before);
    const after = await device.getCurrentPreset();
    if (after === before) {
      remember(device);
      return true;
    }
    await confirmDialog({
      title: 'Preset numbering did not match',
      body:
        `The module reported preset ${before} before and ${after ?? 'nothing'} after recalling it. ` +
        'That is not what this editor expects, so preset saving stays locked to avoid writing the ' +
        'wrong slot. Please report this with your firmware version.',
      confirmLabel: 'OK',
    });
    return false;
  } catch {
    return false;
  }
}
