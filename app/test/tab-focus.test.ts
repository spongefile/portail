// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { Store } from '../src/state/store';
import { renderRack } from '../src/ui/rack';
import { emptyConfig, lineWithDefaults } from '../src/model/model';

const raf = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

// mimic main.ts: re-render the rack on every store change, so a click actually rebuilds the DOM
function harness() {
  const s = new Store();
  const c = emptyConfig('seed');
  c.lines[0] = lineWithDefaults('cv', 1);
  s.replaceConfig(c, "read");
  s.setSelectedLine(null); // start with nothing open (default selectedLine is 0)
  document.body.innerHTML = '<div id="m"></div>';
  const mount = document.getElementById('m')!;
  const draw = () => { mount.innerHTML = ''; mount.appendChild(renderRack(s)); };
  s.subscribe(draw); draw();
  return s;
}

describe('tab focus survives the button↔div swap', () => {
  it('opening a card moves focus to its ▼ (not <body>); collapsing returns it to the card', async () => {
    harness();
    // open: click the closed card button
    (document.getElementById('jack-0') as HTMLButtonElement).click();
    await raf();
    expect(document.activeElement?.id).toBe('disclose-0'); // focus on the disclosure, not <body>
    expect(document.activeElement?.getAttribute('aria-expanded')).toBe('true');

    // collapse: click the ▼
    (document.getElementById('disclose-0') as HTMLButtonElement).click();
    await raf();
    expect(document.activeElement?.id).toBe('jack-0');     // focus back on the card
    expect(document.activeElement?.tagName).toBe('BUTTON');
  });
});
