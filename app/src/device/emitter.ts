/** Minimal typed event emitter shared by the device implementations. */

export class Emitter<Events extends Record<keyof Events, (...args: never[]) => void>> {
  private listeners = new Map<keyof Events, Set<(...args: never[]) => void>>();

  on<K extends keyof Events>(event: K, fn: Events[K]): () => void {
    let set = this.listeners.get(event);
    if (!set) { set = new Set(); this.listeners.set(event, set); }
    set.add(fn as (...args: never[]) => void);
    return () => { set!.delete(fn as (...args: never[]) => void); };
  }

  protected emit<K extends keyof Events>(event: K, ...args: Parameters<Events[K]>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        (fn as (...a: Parameters<Events[K]>) => void)(...args);
      } catch (err) {
        console.error(`listener for "${String(event)}" threw`, err);
      }
    }
  }

  protected clearListeners(): void {
    this.listeners.clear();
  }
}
