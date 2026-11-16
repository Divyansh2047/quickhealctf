"use client";

// PhishGuard — data-fetching hooks (plain useEffect + useState).
// Each hook exposes { data, loading, error, refresh } where `refresh` is a
// silent re-fetch (keeps current data on screen, no skeleton flicker).

import { useCallback, useEffect, useRef, useState } from "react";
import { api, apiErrorMessage } from "./api";
import type {
  AnalyticsReport,
  CampaignDetail,
  CampaignListItem,
  ComplianceResponse,
  InboxResponse,
  Participant,
  PhishTemplate,
  Stats,
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
