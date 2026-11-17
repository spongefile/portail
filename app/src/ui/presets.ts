/**
 * Preset slot manager.
 *
 * The official editor exposes the 8 slots as one dropdown that loads immediately on change,
 * discarding unsaved edits without asking, and doubles as the destination for a "Save parameters"
 * button sitting next to a "save to file" button (AUDIT.md §2.7, §2.8). Here loading and saving are
 * separate, explicit, confirmed actions, slots can be named, and "Back up all slots" walks all 8.
 */

import { el, button, confirmDialog } from './dom';
import type { Store } from '../state/store';
import type { PortailDevice } from '../device/types';
import { model } from '../model/model';
import { download, safeFilename, toFile } from '../state/files';

export interface PresetActions {
  loadSlot: (slot: number) => Promise<void>;
  saveSlot: (slot: number) => Promise<void>;
  backupAll: () => Promise<void>;
}

function ago(ts: number): string {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export function renderPresets(
  store: Store,
  device: PortailDevice,
  actions: PresetActions,
): HTMLElement {
  const state = store.get();
  const connected = device.getState().status === 'connected';
  const backedUp = state.presetMeta.filter((m) => m.backedUpAt !== null).length;

  const rows = Array.from({ length: model.device.preset_slots }, (_, slot) => {
    const meta = state.presetMeta[slot]!;
    const backup = state.presetBackups[slot];
    const isCurrent = state.currentPreset === slot;

    return el(
      'div',
      { class: `preset-row${isCurrent ? ' is-current' : ''}` },
      el('span', { class: 'preset-num' }, String(slot + 1)),
      el(
        'div',
        {},
        el('input', {
          id: `preset-name-${slot}`,
          class: 'control',
          type: 'text',
          value: meta.name,
          'aria-label': `Name for preset slot ${slot + 1}`,
          onchange: (e: Event) => store.setPresetName(slot, (e.target as HTMLInputElement).value),
        }),
        el(
          'span',
          { class: 'preset-backup' },
          isCurrent ? 'loaded on module · ' : '',
          meta.backedUpAt ? `backed up ${ago(meta.backedUpAt)}` : 'no local backup',
        ),
      ),
      el(
        'div',
        { class: 'preset-actions' },
        button('Load → editor', () => void actions.loadSlot(slot), {
          class: 'btn-sm',
          disabled: !connected,
          title: connected
            ? `Replace what you're editing with slot ${slot + 1} from the module`
            : 'Needs a connected module',
        }),
        button('Save → module', () => void actions.saveSlot(slot), {
          class: 'btn-sm',
          disabled: !connected,
          title: connected ? `Write the editor into slot ${slot + 1} on the module` : 'Needs a connected module',
        }),
        button('↓', () => {
          if (!backup) return;
          download(
            `${safeFilename(meta.name)}-slot${slot + 1}.portail.json`,
            JSON.stringify(toFile(backup), null, 2),
            'application/json',
          );
        }, {
          class: 'btn-sm btn-ghost',
          disabled: !backup,
          title: backup ? `Export the backup of slot ${slot + 1}` : 'No backup of this slot yet',
        }),
      ),
    );
  });

  return el(
    'section',
    { class: 'panel' },
    el(
      'div',
      { class: 'panel-head' },
      el('h2', {}, 'Preset slots'),
      el('span', { class: 'small muted' }, `${backedUp}/${model.device.preset_slots} backed up`),
      el('span', { class: 'spacer' }),
      button('Back up all slots', () => void actions.backupAll(), {
        class: 'btn-sm btn-primary',
        disabled: !connected,
        title: connected
          ? 'Read all 8 slots from the module and keep a copy locally'
          : 'Needs a connected module',
      }),
    ),
    el('div', { class: 'panel-body tight' }, ...rows),
    el(
      'div',
      { class: 'panel-body' },
      el(
        'p',
        { class: 'field-hint' },
        'Slot names are stored in this browser only — the module has no place to keep them. ' +
        '“Back up all slots” loads each slot in turn, so it changes which preset the module has ' +
        'loaded; it restores your original slot when it finishes.',
      ),
    ),
  );
}

/** Confirmation used before anything that overwrites hardware or discards edits. */
export async function confirmLoad(slot: number, hasUnsavedEdits: boolean): Promise<boolean> {
  return confirmDialog({
    title: `Load preset ${slot + 1} from the module?`,
    body: hasUnsavedEdits
      ? 'The editor currently holds changes that are not on the module. Loading this preset ' +
        'replaces what you are editing with the module’s copy. You can undo it afterwards.'
      : 'This tells the module to load that preset, then reads it back into the editor.',
    confirmLabel: `Load preset ${slot + 1}`,
    danger: hasUnsavedEdits,
  });
}

export async function confirmSave(slot: number, name: string): Promise<boolean> {
  return confirmDialog({
    title: `Overwrite preset ${slot + 1} on the module?`,
    body:
      `This writes the configuration currently in the editor to slot ${slot + 1} (“${name}”) on the ` +
      'module, permanently replacing what is stored there. This cannot be undone from the editor.',
    confirmLabel: `Overwrite slot ${slot + 1}`,
    danger: true,
  });
}
