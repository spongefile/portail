/**
 * Liability disclaimer (DESIGN.md §6.8). Plain, non-alarmist honesty — not a scare screen.
 *
 * - First-run modal shown before the FIRST attempt to connect real hardware; gates connecting, not
 *   editing. Remembered in localStorage so it appears once.
 * - The full text is also always reachable via the masthead chip (masthead.ts).
 *
 * Language mirrors the repo README verbatim.
 */

import { el } from './dom';

const ACK_KEY = 'portail-editor:disclaimer-ack';

export const DISCLAIMER_FULL =
  'Unofficial — use at your own risk. Not made by, affiliated with, or endorsed by eowave. ' +
  'Reverse-engineered; provided as-is with no warranty. You are responsible for your module and ' +
  'your patches. This tool does not flash firmware.';

export function hasAcknowledged(): boolean {
  try { return localStorage.getItem(ACK_KEY) === '1'; } catch { return false; }
}

function acknowledge(): void {
  try { localStorage.setItem(ACK_KEY, '1'); } catch { /* private mode — show again next time, no harm */ }
}

/**
 * If not yet acknowledged, show the first-run modal and resolve true only when the user confirms.
 * Returns immediately true if already acknowledged. Resolves false if the user cancels.
 */
export function maybeShowFirstRunDisclaimer(): Promise<boolean> {
  if (hasAcknowledged()) return Promise.resolve(true);

  return new Promise((resolve) => {
    const dialog = el('dialog', { class: 'confirm disclaimer-modal' });
    const done = (ok: boolean) => { if (ok) acknowledge(); dialog.close(); dialog.remove(); resolve(ok); };

    dialog.appendChild(
      el('form', { method: 'dialog', class: 'confirm-inner' },
        el('h2', {}, 'Before you connect a module'),
        el('p', {}, DISCLAIMER_FULL),
        el('p', { class: 'small muted' },
          'Firmware updates stay with eowave’s official editor. “eowave” and “Portail” are their ' +
          'owner’s trademarks, used here only to describe compatibility.'),
        el('div', { class: 'confirm-actions' },
          el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => done(false) }, 'Not now'),
          el('button', { type: 'button', class: 'btn btn-primary', onclick: () => done(true) }, 'I understand'),
        ),
      ),
    );
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); done(false); });
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}
