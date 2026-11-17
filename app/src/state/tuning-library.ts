/**
 * The user's local library of microtonal tunings, persisted to localStorage. Separate from the main
 * config store because tunings are NOT part of a Portail config — they live only in the app and are
 * sent to the module's 8 table slots (which can't be read back). See src/model/tuning.ts.
 */

import { type Tuning, newTuning, FACTORY_TUNINGS, sanitizeCents } from '../model/tuning';

const KEY = 'portail-tunings-v1';

interface Persisted {
  tunings: Tuning[];
  assignments: (string | null)[]; // 8 slots → tuning id last SENT there (best-effort)
  hardwareVerified: boolean;       // has one table write been confirmed working on real hardware
}

type Listener = () => void;

let seq = 0;
const nextId = () => `t${Date.now().toString(36)}-${(seq++).toString(36)}`;

export class TuningLibrary {
  private state: Persisted;
  private listeners = new Set<Listener>();

  constructor() { this.state = this.load(); }

  subscribe(fn: Listener): () => void { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  private notify(): void { for (const fn of [...this.listeners]) { try { fn(); } catch (e) { console.error(e); } } }

  get tunings(): readonly Tuning[] { return this.state.tunings; }
  get assignments(): readonly (string | null)[] { return this.state.assignments; }
  get hardwareVerified(): boolean { return this.state.hardwareVerified; }
  byId(id: string): Tuning | undefined { return this.state.tunings.find((t) => t.id === id); }
  slotOf(id: string): number { return this.state.assignments.indexOf(id); }

  add(name = 'New tuning'): Tuning {
    const t = newTuning(nextId(), name);
    this.state.tunings.push(t); this.save();
    return t;
  }

  duplicate(id: string): Tuning | null {
    const src = this.byId(id); if (!src) return null;
    const t: Tuning = { id: nextId(), name: `${src.name} copy`, cents: [...src.cents] };
    this.state.tunings.push(t); this.save();
    return t;
  }

  update(id: string, patch: Partial<Pick<Tuning, 'name' | 'cents'>>): void {
    const t = this.byId(id); if (!t) return;
    if (patch.name !== undefined) t.name = patch.name;
    if (patch.cents !== undefined) t.cents = sanitizeCents(patch.cents);
    this.save();
  }

  setCent(id: string, pitchClass: number, cents: number): void {
    const t = this.byId(id); if (!t || pitchClass < 0 || pitchClass > 11) return;
    const next = [...t.cents]; next[pitchClass] = cents;
    t.cents = sanitizeCents(next);
    this.save();
  }

  remove(id: string): void {
    this.state.tunings = this.state.tunings.filter((t) => t.id !== id);
    this.state.assignments = this.state.assignments.map((a) => (a === id ? null : a));
    this.save();
  }

  /** Record that `id` was sent to `slot` (0-7). */
  markSent(slot: number, id: string): void {
    if (slot < 0 || slot > 7) return;
    this.state.assignments[slot] = id; this.save();
  }

  markHardwareVerified(): void { this.state.hardwareVerified = true; this.save(); }
  reArmHardwareGate(): void { this.state.hardwareVerified = false; this.save(); }

  private save(): void {
    try { localStorage.setItem(KEY, JSON.stringify(this.state)); } catch { /* private mode etc. */ }
    this.notify();
  }

  private load(): Persisted {
    const fresh: Persisted = {
      tunings: FACTORY_TUNINGS.map((t) => ({ ...t, cents: [...t.cents] })),
      assignments: Array(8).fill(null),
      hardwareVerified: false,
    };
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return fresh;
      const p = JSON.parse(raw) as Persisted;
      const tunings = Array.isArray(p.tunings) && p.tunings.length ? p.tunings.map((t) => ({ ...t, cents: sanitizeCents(t.cents) })) : fresh.tunings;
      // Seed any factory preset the user doesn't already have (by stable id).
      for (const fac of FACTORY_TUNINGS) if (!tunings.some((t) => t.id === fac.id)) tunings.push({ ...fac, cents: [...fac.cents] });
      return {
        tunings,
        assignments: Array.isArray(p.assignments) && p.assignments.length === 8 ? p.assignments : fresh.assignments,
        hardwareVerified: !!p.hardwareVerified,
      };
    } catch { return fresh; }
  }
}

export const tuningLibrary = new TuningLibrary();
