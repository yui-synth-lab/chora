/**
 * Clock port — abstracts wall-clock access so the engine can be unit-tested
 * without real-time coupling.
 */
export interface Clock {
  now(): number;
}

/** Production clock that delegates to Date.now(). */
export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}
