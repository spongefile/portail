// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { mountManual, showManual } from '../src/ui/manual';

function nav(): HTMLElement {
  document.body.innerHTML = '<div id="m"></div>';
  const root = document.getElementById('m')!;
  mountManual(root, { onBackToEditor: () => {} });
  showManual({ slug: 'index' });
  return root;
}

describe('board 5c — mode nav grouped by family', () => {
  it('the Modes group is subdivided into family sections in FAMILY_ORDER, each with a labelled dot', () => {
    const root = nav();
    const modes = [...root.querySelectorAll('.toc-group')].find((g) => g.querySelector('.toc-group-title')?.textContent === 'Modes')!;
    expect(modes).toBeTruthy();
    const fams = [...modes.querySelectorAll('.toc-fam-title')].map((t) => t.textContent);
    // palette order: Pitch, Expression, Modulation, Gate / Trigger, Clock
    expect(fams).toEqual(['Pitch', 'Expression', 'Modulation', 'Gate / Trigger', 'Clock']);
    // every family heading carries an aria-hidden colour dot (decoration, label is the real text)
    for (const t of modes.querySelectorAll('.toc-fam-title')) {
      const dot = t.querySelector('.toc-fam-dot')!;
      expect(dot.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('Pitch groups arp/note/seq alphabetically by title', () => {
    const root = nav();
    const modes = [...root.querySelectorAll('.toc-group')].find((g) => g.querySelector('.toc-group-title')?.textContent === 'Modes')!;
    const pitch = [...modes.querySelectorAll('.toc-fam')].find((f) => f.querySelector('.toc-fam-title')?.textContent === 'Pitch')!;
    const links = [...pitch.querySelectorAll('.toc-link')].map((a) => a.textContent);
    expect(links).toEqual(['Arpeggiator', 'Note', 'Sequencer']);
  });

  it('Mode reference is moved out of Modes (into Guide), not sorted among the modes', () => {
    const root = nav();
    const modes = [...root.querySelectorAll('.toc-group')].find((g) => g.querySelector('.toc-group-title')?.textContent === 'Modes')!;
    const inModes = [...modes.querySelectorAll('.toc-link')].some((a) => a.getAttribute('data-slug') === 'modes/index');
    expect(inModes).toBe(false);
    const guide = [...root.querySelectorAll('.toc-group')].find((g) => g.querySelector('.toc-group-title')?.textContent === 'Guide')!;
    const inGuide = [...guide.querySelectorAll('.toc-link')].some((a) => a.getAttribute('data-slug') === 'modes/index');
    expect(inGuide).toBe(true);
  });
});
