import type { EventSink } from "../../engine/event-sink.js";
import type { TickEvent, NamingEvent, DecayEvent } from "../../domain/events.js";

/**
 * HttpEventSink — POSTs typed events to a configurable HTTP endpoint.
 * Network errors are swallowed so the engine loop is never interrupted by
 * a missing or unreachable server.
 */
export class HttpEventSink implements EventSink {
  private readonly endpoint: string;

  constructor(endpoint = "http://localhost:3001/api/events") {
    this.endpoint = endpoint;
  }

  private post(type: string, data: unknown): void {
    fetch(this.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, data }),
    }).catch(() => {
      // Intentionally swallowed — server may not be running.
    });
  }

  emitTick(event: TickEvent): void {
    this.post("tick", event);
  }

  emitNaming(event: NamingEvent): void {
    this.post("naming", event);
  }

  emitDecay(event: DecayEvent): void {
    this.post("decay", event);
  }
}
