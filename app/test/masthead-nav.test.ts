// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { mountMasthead } from '../src/ui/masthead';

function mount(view: 'editor' | 'tuning' | 'hardware' | 'manual') {
  document.body.innerHTML = '<div id="r"></div>';
  const root = document.getElementById('r')!;
  const handle = mountMasthead(root, { onView: () => {}, getView: () => view });
  return { root, handle };
}

/** The single link (if any) marked current, checked in BOTH carriers so they can't drift apart. */
function currentLink(root: HTMLElement) {
  const links = [...root.querySelectorAll('.nav-link')];
  const byAria = links.filter((l) => l.getAttribute('aria-current') === 'page');
  const byClass = links.filter((l) => l.classList.contains('is-current'));
  expect(byAria.length).toBe(1);
  expect(byClass).toEqual(byAria); // underline and aria-current mark the SAME one element
  return byAria[0]!;
}

describe('masthead view nav', () => {
  it('is a <nav>, not a tab pattern (no role=tab/tablist/aria-selected anywhere)', () => {
    const { root } = mount('editor');
    expect(root.querySelector('nav[aria-label="View"]')).toBeTruthy();
    expect(root.querySelector('[role="tab"], [role="tablist"], [aria-selected]')).toBeNull();
  });

  it('marks exactly the current view with aria-current=page and is-current', () => {
    const { root } = mount('tuning');
    const current = currentLink(root);
    expect(current.textContent).toBe('Tuning');
    // the others carry neither carrier
    for (const l of root.querySelectorAll('.nav-link')) {
      if (l !== current) {
        expect(l.getAttribute('aria-current')).toBeNull();
        expect(l.classList.contains('is-current')).toBe(false);
      }
    }
  });

  // The bug that shipped: the underline updated only at mount, because the view-change handler wrote
  // the removed tab-pattern's aria-selected instead of is-current/aria-current. This asserts the
  // active state actually MOVES — one state deep (mount only) can't see a stale updater.
  it('moves the active mark when the view changes via the returned handle', () => {
    const { root, handle } = mount('editor');
    expect(currentLink(root).textContent).toBe('Editor');

    handle.setActive('hardware');
    expect(currentLink(root).textContent).toBe('Hardware');

    handle.setActive('manual');
    expect(currentLink(root).textContent).toBe('Manual');

    // and never resurrects the dead attribute
    expect(root.querySelector('[aria-selected]')).toBeNull();
  });
});
