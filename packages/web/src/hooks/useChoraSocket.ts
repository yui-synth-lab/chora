import { useEffect, useRef } from 'react';
import type { TickEvent, NamingEvent, DecayEvent, InitStatsEvent, ActivationEvent, KLineEvent, AgencyEvent } from '@chora/core/events';
import type { BaselineStats } from './useBaselineData.js';
import type { TelemetryPoint, TimelineItem } from '../lib/view-models.js';

export interface SocketHandlers {
  onInitStats: (data: InitStatsEvent) => void;
  onTick: (data: TickEvent) => void;
  onNaming: (data: NamingEvent) => void;
  onDecay: (data: DecayEvent) => void;
  onActivation: (data: ActivationEvent) => void;
  onKLine: (data: KLineEvent) => void;
  onAgency: (data: AgencyEvent) => void;
  onConnectionChange: (connected: boolean) => void;
}

const WS_PORT = Number(
  (import.meta as { env?: { VITE_CHORA_WS_PORT?: string } }).env?.VITE_CHORA_WS_PORT ?? 3001,
);

/**
 * useChoraSocket — establishes a WebSocket connection to the CHORA server,
 * dispatches typed messages to the supplied handlers, and reconnects on close.
 */
export function useChoraSocket(handlers: SocketHandlers): void {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    // Per-effect flag (NOT a shared ref): under React StrictMode the effect
    // mounts, cleans up, then mounts again. A shared ref reset to false at the
    // start of each run made the first socket's async onclose look
    // "unintentional", scheduling a window.location.reload() — an endless
    // reload loop independent of server state. A closure-local flag is correct
    // for both StrictMode remounts and genuine server disconnects.
    let closedByCleanup = false;

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:${WS_PORT}`;
    console.log(`[CHORA WebSocket] Connecting to ${wsUrl}`);
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      handlersRef.current.onConnectionChange(true);
      console.log('[CHORA WebSocket] Connected to event stream');
    };

    ws.onclose = () => {
      handlersRef.current.onConnectionChange(false);
      if (!closedByCleanup) {
        console.log('[CHORA WebSocket] Disconnected. Retrying in 5s...');
        setTimeout(() => window.location.reload(), 5000);
      }
    };

    ws.onmessage = (event) => {
      try {
        const { type, data } = JSON.parse(event.data as string) as {
          type: string;
          data: TickEvent | NamingEvent | DecayEvent | InitStatsEvent | ActivationEvent | KLineEvent | AgencyEvent;
        };

        switch (type) {
          case 'init_stats':
            handlersRef.current.onInitStats(data as InitStatsEvent);
            break;
          case 'tick':
            handlersRef.current.onTick(data as TickEvent);
            break;
          case 'naming':
            handlersRef.current.onNaming(data as NamingEvent);
            break;
          case 'decay':
            handlersRef.current.onDecay(data as DecayEvent);
            break;
          case 'activation':
            handlersRef.current.onActivation(data as ActivationEvent);
            break;
          case 'kline':
            handlersRef.current.onKLine(data as KLineEvent);
            break;
          case 'agency':
            handlersRef.current.onAgency(data as AgencyEvent);
            break;
          default:
            break;
        }
      } catch (err) {
        console.error('Error handling WebSocket message:', err);
      }
    };

    return () => {
      closedByCleanup = true;
      ws.close();
    };
  }, []);
}

/** Helpers for App.tsx to transform typed events into view-model updates */

export function tickToTelemetryPoint(data: TickEvent): TelemetryPoint {
  const { timestamp: _ts, ...pulseFields } = data.pulse;
  return {
    id: data.cycle_count,
    timestamp: data.timestamp,
    ...pulseFields,
    ...(data.prediction ?? {}),
  };
}

export function namingToTimelineItem(data: NamingEvent): TimelineItem {
  return {
    pulse_id: data.pulse_id,
    name: data.name,
    description: data.description,
    confidence: data.confidence,
    is_new: data.is_new,
    pulse_pattern: data.pulse_pattern,
    duration_ms: data.duration_ms,
    timestamp: Date.now(),
  };
}

export type { BaselineStats, TelemetryPoint, TimelineItem };
