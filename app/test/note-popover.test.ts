// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { notePopover } from '../src/ui/controls';

// a small chromatic note list C3..C4 (values 60..72), plus a leading "all"
const notes = [{ value: 255, label: 'all' },
  ...Array.from({ length: 13 }, (_, i) => ({ value: 60 + i, label: ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B','C'][i] + (i === 12 ? '4' : '3') }))];

function open(el: HTMLElement) { el.querySelector<HTMLButtonElement>('.note-trigger')!.click(); return el.querySelector('.note-dialog')!; }

describe('board 6 note popover', () => {
  it('opens a modal dialog, closes on Escape, returns focus to the trigger', () => {
    document.body.innerHTML = '';
    let committed = -1;
    const el = notePopover({ id: 'n', options: notes, value: 60, ariaLabel: 'Note', onCommit: (v) => { committed = v; } });
    document.body.appendChild(el);
    const dlg = open(el);
    expect(dlg.getAttribute('role')).toBe('dialog');
    expect(dlg.getAttribute('aria-modal')).toBe('true');
    dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(el.querySelector('.note-dialog')).toBeNull();
    expect(document.activeElement).toBe(el.querySelector('.note-trigger'));
    expect(committed).toBe(-1); // Escape does not commit
  });

  it('PageUp jumps an octave and Enter commits the focused note', () => {
    document.body.innerHTML = '';
    let committed = -1;
    const el = notePopover({ id: 'n', options: notes, value: 60, ariaLabel: 'Note', onCommit: (v) => { committed = v; } });
    document.body.appendChild(el);
    const dlg = open(el);
    dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true })); // 60 -> 72
    dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(committed).toBe(72);
    expect(el.querySelector('.note-dialog')).toBeNull(); // pick closes
  });

  it('the leading non-note option ("all") is pickable', () => {
    document.body.innerHTML = '';
    let committed = -1;
    const el = notePopover({ id: 'n', options: notes, value: 60, ariaLabel: 'Note', onCommit: (v) => { committed = v; } });
    document.body.appendChild(el);
    const dlg = open(el);
    dlg.querySelector<HTMLButtonElement>('.note-lead')!.click();
    expect(committed).toBe(255);
  });
});

describe('note popover inside a param field (real wrapper)', () => {
  it('Escape returns focus to the trigger, not <body> — the field Escape handler must not steal it', async () => {
    const { Store } = await import('../src/state/store');
    const { renderParamGrid } = await import('../src/ui/params');
    const { emptyConfig, lineWithDefaults, modesFor } = await import('../src/model/model');
    const { classifyDomain } = await import('../src/model/control-kind');
    // find a CV mode with a keyboard (note) param
    let found: { modeIndex: number } | null = null;
    for (const mode of modesFor('cv')) {
      if (mode.params.some((p: any) => classifyDomain(p.domain).kind === 'keyboard')) { found = { modeIndex: mode.index }; break; }
    }
    if (!found) return; // no cv keyboard param — covered by the standalone tests
    const s = new Store();
    const c = emptyConfig('seed');
    c.lines[0] = lineWithDefaults('cv', found.modeIndex);
    s.replaceConfig(c, 'read');
    document.body.innerHTML = '';
    document.body.appendChild(renderParamGrid(s, 0));
    const trigger = document.querySelector<HTMLButtonElement>('.note-trigger')!;
    trigger.focus();
    trigger.click(); // open
    const dlg = document.querySelector('.note-dialog')!;
    dlg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.querySelector('.note-dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger); // NOT document.body
  });
});
