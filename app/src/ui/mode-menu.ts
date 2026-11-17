/**
 * Family-grouped mode picker popover (design: mockup/fixes/mode-menu.html).
 *
 * POINTER PATH ONLY. The native <select> in the mode tag stays in the DOM and keeps the
 * keyboard and screen-reader path (a native select popup cannot be styled — the OS draws it);
 * renderModeTag intercepts mousedown and opens this instead of the OS menu.
 *
 * Group order is Tina's ruling (clock above gate, pitch above expression), fixed for all
 * line families. Off stands alone at the top, unbadged — it is the absence of a family.
 */
import { el } from './dom';
import { iconSvg } from './icons';
import { modesFor, iconForMode } from '../model/model';
import type { Family } from '../model/types';
import { MODE_FAMILIES, familyOfKey, familyColor, type FamilyId } from '../model/families';

const MENU_ORDER: FamilyId[] = ['clock', 'gate', 'pitch', 'expression', 'modulation'];

/** mode key → the key it must directly follow inside its group. */
const ADJACENT: Record<string, string> = { cc_rec: 'cc' };

// One popover at a time, tracked module-level. Every popover is PORTALED to document.body (fixed
// position) so it survives rack re-renders (a toast expiring mid-pick used to delete it) and
// escapes the OFF card's opacity:.6 (a child menu used to inherit the fade and render see-through).
let closeCurrent: (() => void) | null = null;

export interface PopoverHandle { root: HTMLElement; close: () => void; }

/**
 * The shared body-portaled popover shell: positions `content` under `anchor`, closes on outside
 * pointerdown / scroll / Escape, one at a time. Triggers must be real <button>s — a <select>
 * trigger loses a *trusted* click to the OS's own native picker (the menu opens behind it and the
 * native popup's dismissal closes it), which is invisible to synthetic-event tests.
 */
export function openPopover(anchor: HTMLElement, content: HTMLElement, opts: { ariaLabel: string; onKey?: (e: KeyboardEvent, close: () => void) => void } = { ariaLabel: '' }): PopoverHandle {
  closeCurrent?.();
  const root = el('div', { class: 'mode-menu', role: 'listbox', 'aria-label': opts.ariaLabel }, content);
  const close = () => {
    root.remove();
    closeCurrent = null;
    document.removeEventListener('pointerdown', onOutside, true);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('scroll', onScroll, true);
  };
  const onScroll = () => close(); // fixed-position popover would detach from its anchor
  const onOutside = (e: Event) => { if (!root.contains(e.target as Node) && e.target !== anchor && !anchor.contains(e.target as Node)) close(); };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    opts.onKey?.(e, close);
  };

  const r = anchor.getBoundingClientRect();
  root.style.left = `${Math.max(8, r.left)}px`;
  root.style.top = `${r.bottom + 4}px`;
  document.body.appendChild(root);
  closeCurrent = close;
  // Clamp into the viewport once measurable (flip up against the bottom edge / left off the right).
  const mw = root.offsetWidth, mh = root.offsetHeight;
  if (r.bottom + 4 + mh > window.innerHeight - 8) root.style.top = `${Math.max(8, window.innerHeight - mh - 8)}px`;
  if (r.left + mw > window.innerWidth - 8) root.style.left = `${Math.max(8, window.innerWidth - mw - 8)}px`;
  document.addEventListener('pointerdown', onOutside, true);
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('scroll', onScroll, true);
  return { root, close };
}

export interface MenuGroup {
  /** Section header; null = headerless group (Off, or a flat menu). */
  label: string | null;
  /** Section tint (icons + header + hover); null = neutral. */
  tint: string | null;
  items: { value: number; display: string; icon: string }[];
}

/** The shared icon+label popover (mode menu, FX insert, FX editor). Body-portaled; one at a time. */
export function openIconMenu(anchor: HTMLElement, ariaLabel: string, groups: MenuGroup[], current: number | null, onPick: (v: number) => void): void {
  const inner = el('div');
  const arrowKeys = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = [...inner.querySelectorAll<HTMLButtonElement>('.mode-menu-item')];
    const at = items.indexOf(document.activeElement as HTMLButtonElement);
    const to = e.key === 'ArrowDown' ? Math.min(at + 1, items.length - 1) : Math.max(at - 1, 0);
    e.preventDefault();
    items[to]?.focus();
  };
  let handle: PopoverHandle;
  const item = (m: { value: number; display: string; icon: string }, tint: string | null) =>
    el('button', {
      type: 'button',
      class: `mode-menu-item${m.value === current ? ' is-cur' : ''}`,
      role: 'option', 'aria-selected': m.value === current ? 'true' : 'false',
      style: `--f:${tint ?? 'var(--text-faint)'}`,
      onclick: () => { onPick(m.value); handle.close(); },
    },
      el('span', { class: 'mode-menu-ic', html: iconSvg(m.icon, 15) }),
      m.display,
    );
  for (const g of groups) {
    if (!g.items.length) continue;
    inner.appendChild(el('div', { class: 'mode-menu-fam', style: g.tint ? `--f:${g.tint}` : '' },
      g.label ? el('div', { class: 'mode-menu-head' }, g.label) : null,
      ...g.items.map((m) => item(m, g.tint)),
    ));
  }
  handle = openPopover(anchor, inner, { ariaLabel, onKey: (e) => arrowKeys(e) });
  (handle.root.querySelector<HTMLButtonElement>('.mode-menu-item.is-cur') ??
   handle.root.querySelector<HTMLButtonElement>('.mode-menu-item'))?.focus();
}

/** The family-grouped mode picker (design: mockup/fixes/mode-menu.html). */
export function openModeMenu(tag: HTMLElement, family: Family, current: number, onPick: (v: number) => void): void {
  const modes = modesFor(family);
  const it = (m: { index: number; display: string }) =>
    ({ value: m.index, display: m.display, icon: iconForMode(family, m.index) });
  const groups: MenuGroup[] = [];
  const off = modes.find((m) => m.key === 'off');
  if (off) groups.push({ label: null, tint: null, items: [it(off)] });
  for (const fid of MENU_ORDER) {
    const ms = modes.filter((m) => familyOfKey(m.key) === fid);
    if (!ms.length) continue;
    // Within-group adjacency overrides wire order: CC recorder sits directly under MIDI CC
    // (Tina) — the same control surface, record vs follow.
    for (const [key, afterKey] of Object.entries(ADJACENT)) {
      const i = ms.findIndex((m) => m.key === key);
      if (i >= 0 && ms.some((m) => m.key === afterKey)) {
        const [mv] = ms.splice(i, 1);
        ms.splice(ms.findIndex((m) => m.key === afterKey) + 1, 0, mv!);
      }
    }
    groups.push({ label: MODE_FAMILIES[fid].label, tint: familyColor(fid), items: ms.map(it) });
  }
  openIconMenu(tag, 'Mode', groups, current, onPick);
}
