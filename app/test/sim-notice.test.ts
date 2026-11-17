// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderSimulatorNotice, simNoticeDismissed, resetSimNoticeDismissal } from '../src/ui/connection';
import { SimulatorDevice } from '../src/device/simulator';

const sim = () => new SimulatorDevice({ latency: 0 }) as unknown as Parameters<typeof renderSimulatorNotice>[0];

describe('simulator notice dismissal', () => {
  beforeEach(() => localStorage.clear());

  it('renders until dismissed, then stays gone across renders (that is the point of closing it)', () => {
    const notice = renderSimulatorNotice(sim())!;
    expect(notice).toBeTruthy();
    const close = notice.querySelector('.notice-close') as HTMLButtonElement;
    expect(close.getAttribute('aria-label')).toBe('Dismiss');
    close.click();
    expect(simNoticeDismissed()).toBe(true);
    expect(renderSimulatorNotice(sim())).toBeNull();   // a page reload renders nothing
  });

  it('switching INTO the simulator clears the dismissal — that moment earns the reminder again', () => {
    renderSimulatorNotice(sim())!.querySelector<HTMLButtonElement>('.notice-close')!.click();
    expect(renderSimulatorNotice(sim())).toBeNull();
    resetSimNoticeDismissal();                          // what useSimulator() calls
    expect(renderSimulatorNotice(sim())).toBeTruthy();
  });

  it('a dismissal survives when localStorage throws (private mode): no crash, shows again', () => {
    const notice = renderSimulatorNotice(sim())!;
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => { throw new Error('private mode'); };
    try {
      expect(() => notice.querySelector<HTMLButtonElement>('.notice-close')!.click()).not.toThrow();
    } finally { Storage.prototype.setItem = orig; }
    expect(renderSimulatorNotice(sim())).toBeTruthy();  // not remembered, but nothing broke
  });
});
