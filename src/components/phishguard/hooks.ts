"use client";

// PhishGuard — data-fetching hooks (plain useEffect + useState).
// Each hook exposes { data, loading, error, refresh } where `refresh` is a
// silent re-fetch (keeps current data on screen, no skeleton flicker).

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { api, apiErrorMessage } from "./api";
import type {
  AnalyticsReport,
  CampaignDetail,
  CampaignListItem,
  ComplianceResponse,
  EventType,
  HealthResponse,
  InboxResponse,
  LeaderboardResponse,
  Participant,
  PhishTemplate,
  Stats,
  StatsEvent,
  TrainingResponse,
} from "./api";

interface ApiDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useApiData<T>(path: string | null): ApiDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(path !== null);
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef<T | null>(null);
  const genRef = useRef(0);
  const pathRef = useRef<string | null>(path);
  pathRef.current = path;

  const refresh = useCallback(async () => {
    const p = pathRef.current;
    if (!p) return;
    const gen = ++genRef.current;
    if (dataRef.current === null) setLoading(true);
    try {
      const result = await api<T>(p);
      if (gen !== genRef.current) return; // a newer request superseded this one
      dataRef.current = result;
      setData(result);
      setError(null);
    } catch (err) {
      if (gen !== genRef.current) return;
      setError(apiErrorMessage(err));
    } finally {
      if (gen === genRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [path, refresh]);

  return { data, loading, error, refresh };
}

/* --------------------------- typed endpoints --------------------------- */

export function useStats() {
  return useApiData<Stats>("/api/stats");
}

export function useCampaigns() {
  return useApiData<{ campaigns: CampaignListItem[] }>("/api/campaigns");
}

export function useCampaignDetail(id: string | null) {
  // GET /api/campaigns/:id returns { campaign: {...} } — unwrap so callers
  // receive the campaign object (with `participants`) directly.
  const state = useApiData<{ campaign: CampaignDetail }>(id ? `/api/campaigns/${id}` : null);
  return { data: state.data?.campaign ?? null, loading: state.loading, error: state.error, refresh: state.refresh };
}

export function useTemplates() {
  return useApiData<{ templates: PhishTemplate[] }>("/api/templates");
}

export function useParticipants() {
  return useApiData<{ participants: Participant[] }>("/api/participants");
}

export function useInbox(participantId: string | null) {
  return useApiData<InboxResponse>(
    participantId ? `/api/inbox?participantId=${encodeURIComponent(participantId)}` : null
  );
}

export function useTraining() {
  return useApiData<TrainingResponse>("/api/training");
}

export function useCompliance() {
  return useApiData<ComplianceResponse>("/api/compliance");
}

export function useAnalyticsReport() {
  // GET /api/analytics/report returns { report: {...} } — unwrap for callers.
  const state = useApiData<{ report: AnalyticsReport }>("/api/analytics/report");
  return { data: state.data?.report ?? null, loading: state.loading, error: state.error, refresh: state.refresh };
}

export function useLeaderboard() {
  return useApiData<LeaderboardResponse>("/api/leaderboard");
}

export function useHealth() {
  return useApiData<HealthResponse>("/api/health");
}

/* ------------------------------ live feed ------------------------------ */

/** Connection state of the live-event socket. */
export type LiveFeedStatus = "connecting" | "connected" | "disconnected";

/**
 * A single simulated engagement event streamed over the live feed socket.
 * Mirrors StatsEvent with optional fields so partial payloads stay renderable.
 */
export interface LiveEvent {
  id: string;
  type: EventType;
  participant: string;
  department?: string;
  campaign?: string;
  template?: string;
  createdAt: string;
}

const LIVE_FEED_MAX = 30;

/**
 * Live event stream for the Overview view. Connects to the platform's
 * socket.io feed service (proxied via XTransformPort — never a bare port or
 * absolute URL), backfills from `recent-events` and applies `live-event`
 * pushes. SSR-safe and cleans up the socket on unmount.
 */
export function useLiveFeed(): {
  events: LiveEvent[];
  status: LiveFeedStatus;
} {
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [status, setStatus] = useState<LiveFeedStatus>("connecting");

  useEffect(() => {
    if (typeof window === "undefined") return; // SSR guard

    // Connect to the websocket (live feed) service.
    // Never use PORT in the URL, always use XTransformPort.
    // DO NOT change the path — it is used by Caddy to forward the request
    // to the correct port.
    const socketInstance: Socket = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 10000,
    });

    socketInstance.on("connect", () => {
      setStatus("connected");
    });

    socketInstance.on("disconnect", () => {
      setStatus("disconnected");
    });

    socketInstance.on("connect_error", () => {
      setStatus("disconnected");
    });

    // Backfill: newest-last array of recent events (order normalized below).
    socketInstance.on("recent-events", (backfill: LiveEvent[]) => {
      if (!Array.isArray(backfill)) return;
      const sorted = [...backfill]
        .filter((ev) => ev && typeof ev === "object" && typeof ev.id === "string")
        .sort(
          (a, b) =>
            new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
        )
        .slice(0, LIVE_FEED_MAX);
      setEvents(sorted);
    });

    // Single new event.
    socketInstance.on("live-event", (ev: LiveEvent) => {
      if (!ev || typeof ev !== "object" || typeof ev.id !== "string") return;
      setEvents((prev) => {
        if (prev.some((e) => e.id === ev.id)) return prev; // dedup
        return [ev, ...prev].slice(0, LIVE_FEED_MAX);
      });
    });

    return () => {
      socketInstance.disconnect();
    };
  }, []);

  return { events, status };
}

/** Map a stats recentEvent into the LiveEvent shape used by the feed UI. */
export function statsEventToLive(ev: StatsEvent): LiveEvent {
  return {
    id: ev.id,
    type: ev.type,
    participant: ev.participant,
    campaign: ev.campaign,
    template: ev.template,
    createdAt: ev.createdAt,
  };
}
