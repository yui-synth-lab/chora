import type { TickEvent, NamingEvent, DecayEvent } from "../domain/events.js";

/**
 * EventSink port — the engine emits typed events through this interface.
 * The CLI wires in an HttpEventSink; tests use NoopEventSink.
 */
export interface EventSink {
  emitTick(event: TickEvent): void;
  emitNaming(event: NamingEvent): void;
  emitDecay(event: DecayEvent): void;
}

/** No-op implementation for tests and environments without a server. */
export class NoopEventSink implements EventSink {
  emitTick(_event: TickEvent): void {}
  emitNaming(_event: NamingEvent): void {}
  emitDecay(_event: DecayEvent): void {}
}
