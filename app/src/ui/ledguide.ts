/**
 * Module reference (DESIGN.md §6.6) — decodes the panel's real, undocumented LEDs AND buttons.
 *
 * Swatches come from spec/model.json → led_colors VERBATIM (the firmware's colours), never from the
 * editor mode-family palette. Unknown states are marked pending hardware confirmation (OQ-15). This
 * is the honest counterpart to §6.2's editor-convention card colours.
 */

import { el } from './dom';
import { model } from '../model/model';

interface StateRow {
  swatch: string | 'ramp';
  state: string;
  meaning: string;
  confidence: 'confirmed' | 'inferred' | 'pending';
}

/** Fallback rows if the spec's led_colors is absent; kept in sync with spec/led-colors.md. */
const ROWS: StateRow[] = [
  { swatch: 'ramp', state: 'output active', meaning: 'Brightness = the output’s live level (VU-style). A swinging LFO glows; a silent output is dark.', confidence: 'confirmed' },
  { swatch: '#101010', state: 'idle', meaning: 'Output producing nothing.', confidence: 'confirmed' },
  { swatch: '#00007f', state: 'MIDI / clock activity', meaning: 'Incoming MIDI and clock ticks.', confidence: 'inferred' },
  { swatch: '#7f0000', state: 'preset recalled', meaning: 'Marks the LED of a just-loaded preset.', confidence: 'confirmed' },
  { swatch: '#7f7f7f', state: 'active / selected', meaning: 'The output selected on the module’s own menu.', confidence: 'confirmed' },
  { swatch: '#007f00', state: 'saved', meaning: '“Saved” confirmation.', confidence: 'inferred' },
  { swatch: 'ramp', state: 'MIDI-learn armed', meaning: 'The target LED cycles through the palette while mapping.', confidence: 'confirmed' },
  { swatch: '#7f7f00', state: 'yellow / cyan / warm-white', meaning: 'In the palette, but their exact triggers — and the value→brightness curve and animation timing — are not settled statically.', confidence: 'pending' },
];

function swatchEl(s: string | 'ramp'): HTMLElement {
  if (s === 'ramp') return el('span', { class: 'led-swatch led-ramp', 'aria-hidden': 'true' });
  return el('span', { class: 'led-swatch', style: `background:${s}`, 'aria-hidden': 'true' });
}

const CONF_LABEL: Record<StateRow['confidence'], string> = {
  confirmed: 'confirmed', inferred: 'inferred', pending: 'pending — OQ-15',
};

interface ButtonRow { gesture: string; action: string; }

const BUTTONS: ButtonRow[] = [
  { gesture: '▲ short press', action: 'Next preset — recalled instantly (wraps 8 → 1).' },
  { gesture: '▼ short press', action: 'Previous preset (wraps 1 → 8).' },
  { gesture: '▲ + ▼ together', action: 'Save the current config to the active preset.' },
  { gesture: '▼ held at power-up', action: 'Firmware-update (bootloader) mode.' },
];

export function renderLedGuide(): HTMLElement {
  const hasSpec = model.ledColors != null;

  return el('section', { class: 'panel' },
    el('div', { class: 'panel-head' },
      el('h2', {}, 'Module reference'),
      el('span', { class: 'small muted' }, 'lights & buttons'),
    ),
    el('div', { class: 'panel-body' },
      el('h3', { class: 'ref-subhead' }, 'The LEDs'),
      el('p', { class: 'field-hint' },
        'The Portail’s LEDs are a level-and-state display, not a per-mode colour. Brightness is the ' +
        'output’s live level; colour is the module’s current state. (This is the hardware’s own ' +
        'colour language — separate from the editor’s mode-family card colours.)'),
      el('div', { class: 'led-rows' },
        ...ROWS.map((r) =>
          el('div', { class: `led-row${r.confidence === 'pending' ? ' is-pending' : ''}` },
            swatchEl(r.swatch),
            el('div', {},
              el('div', { class: 'led-state' }, r.state,
                r.confidence === 'pending'
                  ? el('span', { class: 'tag tag-unverified', title: 'Needs hardware confirmation (open question OQ-15).' }, CONF_LABEL[r.confidence])
                  : el('span', { class: 'small muted' }, ` · ${CONF_LABEL[r.confidence]}`)),
              el('div', { class: 'led-meaning small muted' }, r.meaning),
            ),
          ),
        ),
      ),
      hasSpec ? null : el('p', { class: 'field-hint' }, 'Showing the documented palette; the firmware colour block was not bundled.'),

      el('h3', { class: 'ref-subhead' }, 'The two buttons'),
      el('p', { class: 'field-hint' },
        'A preset selector, not an on-module editor — there is no menu or mode-cycling. ' +
        '[confirmed from firmware]'),
      el('div', { class: 'button-rows' },
        ...BUTTONS.map((b) =>
          el('div', { class: 'button-row' },
            el('span', { class: 'button-gesture' }, b.gesture),
            el('span', { class: 'button-action small muted' }, b.action),
          ),
        ),
      ),
      el('p', { class: 'field-hint' },
        el('span', { class: 'tag tag-unverified', title: 'Needs a physical press-test (open question OQ-3).' }, 'unverified'),
        'Hold-to-repeat timing is inferred, pending confirmation.'),
    ),
  );
}
