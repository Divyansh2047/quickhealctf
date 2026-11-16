"use client";

// PhishGuard — Overview: security awareness command center.

import {
  Eye,
  Gauge,
  MailOpen,
  MousePointerClick,
  PlayCircle,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DepartmentRateChart, TrendChart } from "../charts";
import { useStats } from "../hooks";
import {
  EmptyState,
  ErrorState,
  EVENT_META,
  KpiCard,
  MiniProgress,
  pct,
  resilienceLabel,
  relativeTime,
} from "../shared";
import type { ViewKey } from "../view-keys";

export default function OverviewView({ onNavigate }: { onNavigate: (v: ViewKey) => void }) {
  const { data, loading, error, refresh } = useStats();

  if (error && !data) return <ErrorState message={error} onRetry={() => void refresh()} />;

  const totals = data?.totals;
  const rates = data?.rates;
  const score = data?.resilienceScore ?? 0;
  const scoreMeta = resilienceLabel(score);
  const running = (data?.campaigns ?? []).filter((c) => c.status === "running");

  return (
    <div className="space-y-6">
      {/* Greeting strip */}
      <Card className="rounded-xl border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-card to-card p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Security Awareness Command Center
            </h1>
            <div className="mt-1 text-sm text-muted-foreground">
              {loading && !data ? (
                <Skeleton className="h-4 w-72" />
              ) : (
                <>
                  {totals?.runningCampaigns ?? 0} campaign
                  {(totals?.runningCampaigns ?? 0) === 1 ? "" : "s"} running · resilience score{" "}
                  <span className={scoreMeta.className}>{" "}{score}/100</span> ·{" "}
                  {totals?.participants ?? 0} participants (
                  {totals?.consentedParticipants ?? 0} consented)
                </>
              )}
            </div>
          </div>
          <span className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Simulation only — no real emails sent
          </span>
        </div>
      </Card>

      {/* KPI row */}
      {loading && !data ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="space-y-3 rounded-xl p-4">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-16" />
              <Skeleton className="h-3 w-24" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
          <KpiCard
            label="Emails delivered"
            value={String(totals?.delivered ?? 0)}
            icon={Send}
            iconClassName="border-zinc-500/30 bg-zinc-500/15 text-zinc-300"
            caption={`${totals?.campaigns ?? 0} campaigns total`}
          />
          <KpiCard
            label="Open rate"
            value={pct(rates?.openRate)}
            icon={MailOpen}
            iconClassName="border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
            caption={`${totals?.opens ?? 0} opens recorded`}
          />
          <KpiCard
            label="Click rate"
            value={pct(rates?.clickRate)}
            icon={MousePointerClick}
            iconClassName="border-red-500/30 bg-red-500/15 text-red-400"
            valueClassName={
              (rates?.clickRate ?? 0) > 25 ? "text-red-400" : "text-emerald-400"
            }
            caption={`${totals?.clicks ?? 0} clicks recorded`}
          />
          <KpiCard
            label="Report rate"
            value={pct(rates?.reportRate)}
            icon={ShieldCheck}
            iconClassName="border-teal-500/30 bg-teal-500/15 text-teal-400"
            valueClassName="text-teal-300"
            caption={`${totals?.reports ?? 0} phishes reported`}
          />
          <KpiCard
            label="Resilience score"
            value={`${score}`}
            icon={Gauge}
            iconClassName="border-emerald-500/30 bg-emerald-500/15 text-emerald-400"
            valueClassName={scoreMeta.className}
            caption={scoreMeta.label}
          >
            <div className="mt-2" aria-hidden="true">
              <MiniProgress value={score} label="0 → 100" />
            </div>
          </KpiCard>
        </div>
      )}

      {/* Charts + right column */}
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-4 xl:col-span-2">
          <Card className="rounded-xl p-4 sm:p-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">14-day activity trend</h2>
              <span className="text-xs text-muted-foreground">delivered · opens · clicks · reports</span>
            </div>
            {loading && !data ? (
              <Skeleton className="h-[280px] w-full" />
            ) : (data?.trend.length ?? 0) === 0 ? (
              <EmptyState icon={Eye} title="No activity yet" hint="Launch a campaign to start collecting simulated engagement events." />
            ) : (
              <TrendChart data={data?.trend ?? []} />
            )}
          </Card>

          <Card className="rounded-xl p-4 sm:p-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Department risk breakdown</h2>
              <span className="text-xs text-muted-foreground">click rate vs report rate</span>
            </div>
            {loading && !data ? (
              <Skeleton className="h-56 w-full" />
            ) : (data?.departments.length ?? 0) === 0 ? (
              <EmptyState icon={Eye} title="No department data" hint="Departments appear once campaigns reach enrolled participants." />
            ) : (
              <DepartmentRateChart data={data?.departments ?? []} />
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {/* Live activity feed */}
          <Card className="rounded-xl p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Live activity feed</h2>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
                </span>
                live
              </span>
            </div>
            {loading && !data ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="size-8 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (data?.recentEvents.length ?? 0) === 0 ? (
              <EmptyState
                icon={PlayCircle}
                title="No events yet"
                hint="Deliveries, opens, clicks and reports stream in here once a campaign launches."
              />
            ) : (
              <ul
                aria-label="Recent simulated events"
                className="max-h-96 space-y-3 overflow-y-auto pr-1"
              >
                {(data?.recentEvents ?? []).map((ev) => {
                  const meta = EVENT_META[ev.type];
                  const Icon = meta.icon;
                  return (
                    <li key={ev.id} className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border ${meta.bg}`}
                      >
                        <Icon className={`size-4 ${meta.className}`} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-snug">
                          <span className="font-medium">{ev.participant}</span>{" "}
                          <span className="text-muted-foreground">{meta.verb}</span>{" "}
                          <span className="font-medium">&ldquo;{ev.template}&rdquo;</span>{" "}
                          <span className="text-muted-foreground">in {ev.campaign}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {relativeTime(ev.createdAt)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {/* Running campaigns */}
          <Card className="rounded-xl p-4 sm:p-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Running campaigns</h2>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("campaigns")}>
                View all
              </Button>
            </div>
            {loading && !data ? (
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : running.length === 0 ? (
              <EmptyState
                icon={PlayCircle}
                title="No campaigns running"
                hint="Launch a draft campaign to start a new simulation wave."
              />
            ) : (
              <ul className="space-y-4">
                {running.map((c) => (
                  <li key={c.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => onNavigate("campaigns")}
                      >
                        View
                      </Button>
                    </div>
                    <MiniProgress
                      value={
                        c.participantCount > 0
                          ? (c.opens / c.participantCount) * 100
                          : 0
                      }
                      label={`${c.opens}/${c.participantCount} opened · ${c.clicks} clicks · ${c.reports} reports`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Resilience explainer */}
          <Card className="rounded-xl border-dashed p-4 sm:p-6">
            <div className="flex items-center gap-2">
              <Gauge className="size-4 text-emerald-400" aria-hidden="true" />
              <h2 className="text-sm font-semibold">How the Resilience Score works</h2>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              One number for organizational phishing resilience, blended from three signals:
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li className="flex items-center gap-2">
                <span className="font-semibold text-red-400">40%</span> click resilience — employees
                who did <span className="italic">not</span> click simulated links
              </li>
              <li className="flex items-center gap-2">
                <span className="font-semibold text-emerald-400">40%</span> reporting — phishes
                reported through the Report Phish action
              </li>
              <li className="flex items-center gap-2">
                <span className="font-semibold text-teal-400">20%</span> training completion —
                awareness modules finished by enrolled staff
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
