/**
 * Key/value driver so the repository can be unit tested without a browser and
 * so quota failures can be simulated deliberately.
 */

export interface KeyValueDriver {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

export class LocalStorageDriver implements KeyValueDriver {
  getItem(key: string): string | null {
    return window.localStorage.getItem(key);
  }
  setItem(key: string, value: string): void {
    window.localStorage.setItem(key, value);
  }
  removeItem(key: string): void {
    window.localStorage.removeItem(key);
  }
  keys(): string[] {
    const out: string[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k !== null) out.push(k);
    }
    return out;
  }
}

/** In-memory driver for tests. `failOnWrite` simulates a quota rejection. */
export class MemoryDriver implements KeyValueDriver {
  private store = new Map<string, string>();
  failOnWrite: Error | null = null;

  constructor(initial: Record<string, string> = {}) {
    for (const [k, v] of Object.entries(initial)) this.store.set(k, v);
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    if (this.failOnWrite) throw this.failOnWrite;
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  keys(): string[] {
    return [...this.store.keys()];
  }
  snapshot(): Record<string, string> {
    return Object.fromEntries(this.store);
  }
}

export function isStorageAvailable(): boolean {
  try {
    const probe = '__cjpos_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}
