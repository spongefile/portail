/** File import/export panel: portable JSON, legacy .txt import, raw .syx. */

import { el, button } from './dom';
import type { Store } from '../state/store';
import type { PortailDevice } from '../device/types';
import { toFile, fromFile, fromLegacyText, download, safeFilename, ImportError } from '../state/files';
import { encodeConfig, fromSyxBlob, toSyxBlob, decodeConfigMessages } from '../device/sysex';
import { emptyConfig } from '../model/model';

function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = el('input', { type: 'file', accept, style: 'display:none' }) as HTMLInputElement;
    input.addEventListener('change', () => resolve(input.files?.[0] ?? null));
    document.body.appendChild(input);
    input.click();
    setTimeout(() => input.remove(), 0);
  });
}

export function renderFiles(store: Store, device: PortailDevice): HTMLElement {
  // The hint names the Send button, so it must track the button's transport-aware label.
  const t = device.kind === 'simulator' ? 'simulator' : 'module';
  const cfg = store.get().config;

  const exportJson = () => {
    download(`${safeFilename(cfg.name)}.portail.json`, JSON.stringify(toFile(cfg), null, 2), 'application/json');
  };

  const exportSyx = () => {
    const blob = toSyxBlob(encodeConfig(cfg));
    download(`${safeFilename(cfg.name)}.syx`, blob, 'application/octet-stream');
  };

  const importJson = async () => {
    const file = await pickFile('.json,application/json');
    if (!file) return;
    try {
      const config = fromFile(await file.text());
      store.replaceConfig(config, `import ${file.name}`);
      store.toast('success', 'Imported', `Loaded “${config.name}” into the editor. Nothing sent to the module.`);
    } catch (err) {
      store.toast('error', 'Import failed', err instanceof ImportError ? err.message : String(err));
    }
  };

  const importLegacy = async () => {
    const file = await pickFile('.txt,text/plain');
    if (!file) return;
    try {
      const config = fromLegacyText(await file.text());
      store.replaceConfig(config, `import legacy ${file.name}`);
      store.toast('success', 'Imported official-editor file', 'Converted the .txt into the editor. Nothing sent to the module.');
    } catch (err) {
      store.toast('error', 'Import failed', err instanceof ImportError ? err.message : String(err));
    }
  };

  const importSyx = async () => {
    const file = await pickFile('.syx,application/octet-stream');
    if (!file) return;
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { config, applied, skipped } = decodeConfigMessages(fromSyxBlob(bytes), emptyConfig(file.name));
      store.replaceConfig(config, `import ${file.name}`);
      store.toast('success', 'Imported .syx', `Decoded ${applied} messages${skipped ? `, skipped ${skipped}` : ''}. Nothing sent to the module.`);
    } catch (err) {
      store.toast('error', 'Import failed', String(err instanceof Error ? err.message : err));
    }
  };

  return el('section', { class: 'panel' },
    el('div', { class: 'panel-head' }, el('h2', {}, 'Files')),
    el('div', { class: 'panel-body' },
      el('div', { class: 'stack' },
        el('div', { class: 'row' },
          button('Export JSON', exportJson, { class: 'btn-sm', title: 'Save the current config as portable, diffable JSON' }),
          button('Import JSON', () => void importJson(), { class: 'btn-sm' }),
        ),
        el('div', { class: 'row' },
          button('Export .syx', exportSyx, { class: 'btn-sm', title: 'Raw SysEx a full send would transmit' }),
          button('Import .syx', () => void importSyx(), { class: 'btn-sm' }),
        ),
        el('div', { class: 'row' },
          button('Import official-editor .txt', () => void importLegacy(), { class: 'btn-sm btn-ghost', title: 'Load an output.txt exported by the original editor' }),
        ),
        el('p', { class: 'field-hint' }, `Importing only changes the editor. Use “Send to ${t}” to write it there.`),
      ),
    ),
  );
}
