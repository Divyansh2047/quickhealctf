// PhishGuard — typed API client layer.
// Every network call goes through `api<T>()` which parses JSON, throws a
// structured ApiError (with server `error` + `violations`) on non-OK responses.

export type CampaignStatus = "draft" | "running" | "completed" | "cancelled";
export type Difficulty = "easy" | "medium" | "hard";
export type TrackEventType = "OPEN" | "CLICK" | "REPORT";

/* ----------------------------- /api/stats ----------------------------- */

export interface TrendPoint {
  date: string; // YYYY-MM-DD
  delivered: number;
  opens: number;
  clicks: number;
  reports: number;
}

export interface DepartmentStats {
  department: string;
  participants: number;
  delivered: number;
  opens: number;
  clicks: number;
  reports: number;
  clickRate: number; // 0-100
  reportRate: number; // 0-100
}

export interface StatsEvent {
  id: string;
  type: "DELIVERED" | "OPEN" | "CLICK" | "REPORT";
  participant: string;
  campaign: string;
  template: string;
  createdAt: string;
}

export interface StatsCampaignSummary {
  id: string;
  name: string;
  status: CampaignStatus;
  participantCount: number;
  opens: number;
  clicks: number;
  reports: number;
  launchedAt: string | null;
}

export interface Stats {
  totals: {
    participants: number;
    consentedParticipants: number;
    campaigns: number;
    runningCampaigns: number;
    delivered: number;
    opens: number;
    clicks: number;
    reports: number;
  };
  rates: {
    openRate: number; // 0-100
    clickRate: number; // 0-100
    reportRate: number; // 0-100
  };
  trainingCompletionRate: number; // 0-100
  resilienceScore: number; // 0-100
  trend: TrendPoint[];
  departments: DepartmentStats[];
  recentEvents: StatsEvent[];
  campaigns: StatsCampaignSummary[];
}

/* ---------------------------- /api/campaigns --------------------------- */

export interface CampaignTemplateRef {
  id: string;
  name: string;
  category: string;
  difficulty: Difficulty;
  senderName: string;
  senderEmail: string;
}

export interface CampaignListItem {
  id: string;
  name: string;
  description: string;
  status: CampaignStatus;
  retentionDays: number;
  createdAt: string;
  launchedAt: string | null;
  completedAt: string | null;
  template: CampaignTemplateRef;
  participantCount: number;
  delivered: number;
  opens: number;
  clicks: number;
  reports: number;
}

export interface CampaignParticipantRow {
  enrollmentId: string;
  participantId: string;
  name: string;
  email: string;
  department: string;
  consented: boolean;
  active: boolean;
  deliveredAt: string | null;
  openedAt: string | null;
  clickedAt: string | null;
  reportedAt: string | null;
}

export interface CampaignDetail extends CampaignListItem {
  participants: CampaignParticipantRow[];
}

export interface CreateCampaignPayload {
  name: string;
  description?: string;
  templateId: string;
  participantIds: string[];
  retentionDays?: number;
}

/* ---------------------------- /api/templates --------------------------- */

export interface PhishTemplate {
  id: string;
  name: string;
  category: string;
  difficulty: Difficulty;
  subject: string;
  senderName: string;
  senderEmail: string;
  bodyHtml: string;
  landingMessage: string;
  redFlags: string[];
  isBuiltIn: boolean;
  createdAt: string;
  usageCount: number;
}

export interface TemplatePayload {
  name: string;
  category: string;
  difficulty: Difficulty;
  subject: string;
  senderName: string;
  senderEmail: string;
  bodyHtml: string;
  landingMessage: string;
  redFlags: string[];
}

/* -------------------------- /api/participants -------------------------- */

export interface ParticipantStats {
  campaigns: number;
  delivered: number;
  opens: number;
  clicks: number;
  reports: number;
}

export interface Participant {
  id: string;
  name: string;
  email: string;
  department: string;
  consented: boolean;
  consentedAt: string | null;
  active: boolean;
  createdAt: string;
  stats: ParticipantStats;
}

/* ------------------------------ /api/inbox ----------------------------- */

export interface InboxTemplateInfo {
  subject: string;
  senderName: string;
  senderEmail: string;
  bodyHtml: string;
  category: string;
  difficulty: Difficulty;
  redFlags: string[];
  /** Optional teaching-moment copy; may be enriched by the backend. */
  landingMessage?: string;
}

export interface InboxItem {
  enrollmentId: string;
  campaignId: string;
  campaignName: string;
  deliveredAt: string;
  opened: boolean;
  clicked: boolean;
  reported: boolean;
  template: InboxTemplateInfo;
}

export interface InboxResponse {
  participant: {
    id: string;
    name: string;
    email: string;
    department: string;
  };
  inbox: InboxItem[];
}

export interface TrackResponse {
  already: boolean;
  event?: unknown;
  enrollment: {
    id: string;
    openedAt: string | null;
    clickedAt: string | null;
    reportedAt: string | null;
  };
}

/* ----------------------------- /api/training ---------------------------- */

export interface TrainingModule {
  id: string;
  title: string;
  category: string;
  durationMin: number;
  summary: string;
  contentMd: string;
  redFlagTips: string[];
  completions: number;
}

export interface TrainingCompletion {
  participantId: string;
  participantName: string;
  moduleId: string;
  completedAt: string;
}

export interface TrainingResponse {
  modules: TrainingModule[];
  completions: TrainingCompletion[];
}

/* ---------------------------- /api/compliance --------------------------- */

export interface ConsentRow {
  id: string;
  name: string;
  email: string;
  department: string;
  consented: boolean;
  consentedAt: string | null;
}

export interface ApprovedDomain {
  id: string;
  domain: string;
  approvedBy: string;
  createdAt: string;
}

export interface RetentionPolicy {
  defaultRetentionDays: number;
  autoPurge: boolean;
  totalEvents: number;
  oldestEventAt: string | null;
}

export interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  detail: string;
  createdAt: string;
}

export interface ComplianceResponse {
  consent: ConsentRow[];
  domains: ApprovedDomain[];
  retention: RetentionPolicy;
  audit: AuditEntry[];
}

/* ------------------------- /api/analytics/report ------------------------ */

export interface ReportOverall {
  participants: number;
  consentedParticipants: number;
  delivered: number;
  opens: number;
  clicks: number;
  reports: number;
  openRate: number;
  clickRate: number;
  reportRate: number;
  resilienceScore: number;
  trainingCompletionRate: number;
  trainingCompletions: number;
}

export interface ReportCampaign {
  name: string;
  status: CampaignStatus;
  launchedAt: string | null;
  completedAt: string | null;
  participantCount: number;
  delivered: number;
  opens: number;
  clicks: number;
  reports: number;
  clickRate: number;
  reportRate: number;
}

export interface ReportPrivacy {
  credentialCollection: boolean;
  realEmailDelivery: boolean;
  individualScoresAnonymous: boolean;
  defaultRetentionDays: number;
  autoPurge: boolean;
}

export interface AnalyticsReport {
  generatedAt: string;
  overall: ReportOverall;
  trend: TrendPoint[];
  campaigns: ReportCampaign[];
  departments: DepartmentStats[];
  topRedFlags: { flag: string; count: number }[];
  recommendations: string[];
  privacy: ReportPrivacy;
}

/* ------------------------------- client -------------------------------- */

export class ApiError extends Error {
  status: number;
  violations: string[];

  constructor(status: number, message: string, violations: string[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.violations = violations;
  }
}

/** Human-friendly message for toasts: error text + joined violations. */
export function apiErrorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    const base = err.message || `Request failed (${err.status})`;
    if (err.violations.length > 0) {
      return `${base} — ${err.violations.join("; ")}`;
    }
    return base;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Typed fetch helper for the PhishGuard API. Relative paths only. */
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      cache: "no-store",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(0, "Network error — could not reach the PhishGuard API.");
  }

  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON body is fine for empty responses
  }

  if (!res.ok) {
    const body = (data ?? {}) as { error?: string; violations?: string[] };
    throw new ApiError(
      res.status,
      body.error ?? `Request failed (${res.status})`,
      Array.isArray(body.violations) ? body.violations : []
    );
  }

  return data as T;
}

/** Extract domain from an email address, or "unknown". */
export function emailDomain(email: string): string {
  const idx = email.lastIndexOf("@");
  return idx >= 0 ? email.slice(idx + 1).toLowerCase() : "unknown";
}
