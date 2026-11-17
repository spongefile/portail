/** The masthead: title, the persistent UNOFFICIAL/disclaimer affordance, and the view switch. */

import { el } from './dom';
import { DISCLAIMER_FULL } from './disclaimer';

type View = 'editor' | 'manual' | 'hardware' | 'tuning';

export interface MastheadOptions {
  onView: (v: View) => void;
  getView: () => View;
}

/** Handle returned by mountMasthead. The masthead is the SOLE owner of how "current view" is marked
 *  (the underline + aria-current); the app switches views through setActive, so there is no second
 *  place that has to know the markup and can fall out of sync (that seam is what left the underline
 *  stuck on Editor when main.ts still wrote the removed tab-pattern's aria-selected). */
export interface MastheadHandle {
  setActive(v: View): void;
}

export function mountMasthead(root: HTMLElement, o: MastheadOptions): MastheadHandle {
  // Text-link nav with a real active state (brightness + weight + an underline — three carriers, so
  // the current view survives greyscale/CVD). NOT a tab pattern: these switch whole views and there
  // is no linked tabpanel, so it's <nav> + aria-current="page", like the output jacks.
  const links: Array<{ v: View; link: HTMLElement }> = ([
    ['editor', 'Editor'], ['tuning', 'Tuning'], ['hardware', 'Hardware'], ['manual', 'Manual'],
  ] as Array<[View, string]>).map(([v, label]) => ({
    v,
    link: el('button', {
      type: 'button', class: 'nav-link', 'data-view-btn': v, onclick: () => o.onView(v),
    }, el('span', { class: 'nav-link-text' }, label)),
  }));

  // The one writer of the active state, in both carriers. Called at mount and on every view change.
  const setActive = (v: View): void => {
    for (const { v: lv, link } of links) {
      const on = lv === v;
      link.classList.toggle('is-current', on);
      if (on) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
  };
  setActive(o.getView());

  // The UNOFFICIAL chip expands to the full disclaimer on click (and carries it as a tooltip).
  const chip = el('button', {
    type: 'button',
    class: 'unofficial-badge',
    title: DISCLAIMER_FULL,
    'aria-expanded': 'false',
    onclick: (e: Event) => {
      const btn = e.currentTarget as HTMLElement;
      const open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!open));
      const pop = document.getElementById('disclaimer-pop');
      if (pop) pop.hidden = open;
    },
  }, 'Unofficial · use at your own risk');

  const pop = el('div', { id: 'disclaimer-pop', class: 'disclaimer-pop notice notice-pending', hidden: true, role: 'note' },
    el('p', {}, DISCLAIMER_FULL));

  root.appendChild(
    el('header', { class: 'masthead' },
      el('h1', {}, 'Portail Editor', el('span', { class: 'sub' }, 'unofficial')),
      chip,
      // nav moved left (just after the badge); the spacer follows it so wrapping keeps the nav with
      // the title rather than trading places with the badge on a narrow screen.
      el('nav', { class: 'masthead-nav', 'aria-label': 'View' }, ...links.map((l) => l.link)),
      el('span', { class: 'masthead-spacer' }),
    ),
  );
  root.appendChild(pop);
  return { setActive };
}
