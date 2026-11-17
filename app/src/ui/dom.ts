/** Tiny DOM helpers. No framework — the UI is small enough to build by hand. */

type Attrs = Record<string, string | number | boolean | null | undefined | EventListener>;
type Child = Node | string | number | null | undefined | false;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') {
      node.addEventListener(k.slice(2).toLowerCase(), v as EventListener);
    } else if (k === 'class') {
      node.className = String(v);
    } else if (k === 'html') {
      node.innerHTML = String(v);
    } else if (v === true) {
      node.setAttribute(k, '');
    } else {
      node.setAttribute(k, String(v));
    }
  }
  append(node, children);
  return node;
}

export function append(parent: Node, children: Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    parent.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

export function clear(node: Element): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function replace(node: Element, ...children: Child[]): void {
  clear(node);
  append(node, children);
}

export function frag(...children: Child[]): DocumentFragment {
  const f = document.createDocumentFragment();
  append(f, children);
  return f;
}

/**
 * Re-rendering a panel destroys focus, which makes keyboard navigation unusable. Capture the
 * focused element's id and selection, run the render, then put it back.
 */
export function preservingFocus(fn: () => void): void {
  const active = document.activeElement as HTMLElement | null;
  const id = active?.id || null;
  const start = (active as HTMLInputElement | null)?.selectionStart ?? null;
  const end = (active as HTMLInputElement | null)?.selectionEnd ?? null;

  fn();

  if (!id) return;
  const next = document.getElementById(id);
  if (!next) return;
  next.focus({ preventScroll: true });
  if (start !== null && 'setSelectionRange' in next) {
    try { (next as HTMLInputElement).setSelectionRange(start, end ?? start); } catch { /* not a text field */ }
  }
}

/**
 * Coalesces repeat calls into one deferred run. Uses a microtask, not requestAnimationFrame: these
 * are data-driven DOM swaps, not animations, and rAF is throttled/paused when the tab is not in the
 * foreground — which would freeze the editor for a backgrounded tab. A microtask always runs.
 */
export function scheduler(fn: () => void): () => void {
  let queued = false;
  return () => {
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; fn(); });
  };
}

/** A labelled form control with unit, range, default and inline help. */
export interface FieldOptions {
  id: string;
  label: string;
  unit?: string | null;
  hint?: string | null;
  /** Rendered as "range: …" under the control. */
  range?: string | null;
  /** Rendered as "default: …". */
  defaultLabel?: string | null;
  /** True when the explanatory text is our reading of the original editor, not documentation. */
  unverified?: boolean;
  control: HTMLElement;
  /** Extra warning shown in an alert style. */
  warning?: string | null;
}

export function field(o: FieldOptions): HTMLElement {
  const meta: Child[] = [];
  if (o.range) meta.push(el('span', { class: 'meta-item' }, `range ${o.range}`));
  if (o.defaultLabel) meta.push(el('span', { class: 'meta-item' }, `default ${o.defaultLabel}`));

  return el(
    'div',
    { class: 'field' },
    el(
      'label',
      { class: 'field-label', for: o.id },
      o.label,
      o.unit ? el('span', { class: 'unit' }, o.unit) : null,
    ),
    o.control,
    meta.length ? el('div', { class: 'field-meta' }, ...meta) : null,
    o.hint
      ? el(
          'p',
          { class: `field-hint${o.unverified ? ' is-unverified' : ''}` },
          o.unverified ? el('span', { class: 'tag tag-unverified', title: 'Derived by reading the official editor’s source. Not confirmed against the manual or hardware.' }, 'unverified') : null,
          o.hint,
        )
      : null,
    o.warning ? el('p', { class: 'field-warning' }, o.warning) : null,
  );
}

export function select(
  id: string,
  options: { value: number; label: string }[],
  value: number,
  onChange: (v: number) => void,
): HTMLSelectElement {
  const s = el('select', {
    id,
    class: 'control',
    onchange: (e: Event) => onChange(Number((e.target as HTMLSelectElement).value)),
  });
  for (const o of options) {
    s.appendChild(el('option', { value: o.value, selected: o.value === value }, o.label));
  }
  s.value = String(value);
  return s;
}

export function button(
  label: string,
  onClick: () => void,
  opts: { class?: string; title?: string; disabled?: boolean; id?: string; ariaLabel?: string } = {},
): HTMLButtonElement {
  return el('button', {
    type: 'button',
    id: opts.id,
    class: `btn ${opts.class ?? ''}`.trim(),
    title: opts.title,
    'aria-label': opts.ariaLabel,
    disabled: opts.disabled,
    onclick: onClick,
  }, label);
}

/** A blocking confirmation for anything destructive. Returns a promise of the user's answer. */
export function confirmDialog(opts: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
}): Promise<boolean> {
  return new Promise((resolve) => {
    const dialog = el('dialog', { class: 'confirm' });
    const done = (v: boolean) => { dialog.close(); dialog.remove(); resolve(v); };

    dialog.appendChild(
      el('form', { method: 'dialog', class: 'confirm-inner' },
        el('h2', {}, opts.title),
        el('p', {}, opts.body),
        el('div', { class: 'confirm-actions' },
          button('Cancel', () => done(false), { class: 'btn-ghost' }),
          button(opts.confirmLabel, () => done(true), { class: opts.danger ? 'btn-danger' : 'btn-primary' }),
        ),
      ),
    );
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); done(false); });
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}


/** Human 'N ago' for a ms-epoch timestamp. */
export function timeAgo(ts: number | null): string {
  if (ts === null) return 'not yet';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
