"use client";

// PhishGuard — Training: awareness modules with markdown content, completion
// tracking per participant, and targeted recommendations from live stats.

import { useMemo, useState } from "react";
import { CheckCircle2, Clock, GraduationCap, Target, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import { api, apiErrorMessage } from "../api";
import type { Participant, TrainingModule } from "../api";
import { useParticipants, useStats, useTraining } from "../hooks";
import { EmptyState, ErrorState, SectionTitle } from "../shared";

const TARGETED_MODULES: string[] = ["Urgency & Pressure Tactics", "Spotting Phishing Red Flags"];

export default function TrainingView() {
  const { data: participantsData, loading: pLoading, error: pError, refresh: refreshParticipants } = useParticipants();
  const actors = useMemo<Participant[]>(
    () => (participantsData?.participants ?? []).filter((p) => p.active && p.consented),
    [participantsData]
  );
  const [pickedParticipantId, setPickedParticipantId] = useState<string | null>(null);
  const participantId = pickedParticipantId ?? actors[0]?.id ?? "";

  const { data, loading, error, refresh } = useTraining();
  const { data: statsData } = useStats();

  const modules = data?.modules ?? [];
  const completions = data?.completions ?? [];
  const participant = actors.find((p) => p.id === participantId) ?? null;
  const myCompletions = completions.filter((c) => c.participantId === participantId);
  const completedModuleIds = new Set(myCompletions.map((c) => c.moduleId));

  const [moduleOpen, setModuleOpen] = useState<TrainingModule | null>(null);
  const [completing, setCompleting] = useState(false);

  const completeModule = async (moduleId: string) => {
    if (!participantId) return;
    setCompleting(true);
    try {
      await api<{ completion: unknown }>("/api/training/complete", {
        method: "POST",
        body: JSON.stringify({ participantId, moduleId }),
      });
      toast.success(`Marked as completed for ${participant?.name ?? "participant"}`);
      setModuleOpen(null);
      void refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setCompleting(false);
    }
  };

  // Targeted awareness: top-2 departments by click rate
  const targeted = [...(statsData?.departments ?? [])]
    .sort((a, b) => b.clickRate - a.clickRate)
    .slice(0, 2);

  const recommendedModuleFor = (rank: number) => {
    const title = TARGETED_MODULES[rank] ?? null;
    return title ? modules.find((m) => m.title === title) ?? null : null;
  };

  const progressPct = modules.length > 0 ? Math.round((myCompletions.length / modules.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Security awareness training"
        icon={GraduationCap}
        description="Short, focused modules that map directly to the red flags used in simulations."
      />

      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="training-actor" className="text-sm text-muted-foreground">
          Training for
        </Label>
        <Select value={participantId} onValueChange={setPickedParticipantId}>
          <SelectTrigger id="training-actor" className="w-full sm:w-[300px]" aria-label="Training participant">
            <SelectValue placeholder={pLoading ? "Loading participants…" : "Select participant"} />
          </SelectTrigger>
          <SelectContent>
            {actors.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} · {p.department}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {pError ? (
          <Button variant="outline" size="sm" onClick={() => void refreshParticipants()}>
            Retry
          </Button>
        ) : null}
        {participant ? (
          <Badge variant="secondary" className="text-xs" aria-live="polite">
            {myCompletions.length}/{modules.length} modules completed by {participant.name}
          </Badge>
        ) : null}
      </div>

      {error && !data ? (
        <ErrorState message={error} onRetry={() => void refresh()} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          {/* Modules grid */}
          <div className="xl:col-span-2">
            {loading && !data ? (
              <div className="grid gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="space-y-3 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-24" />
                      <Skeleton className="h-4 w-14" />
                    </div>
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </Card>
                ))}
              </div>
            ) : modules.length === 0 ? (
              <EmptyState
                icon={GraduationCap}
                title="No training modules"
                hint="Modules appear here once seeded by the platform."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {modules.map((m) => {
                  const done = completedModuleIds.has(m.id);
                  return (
                    <Card
                      key={m.id}
                      role="button"
                      tabIndex={0}
                      aria-label={`Open module ${m.title}`}
                      onClick={() => setModuleOpen(m)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setModuleOpen(m);
                        }
                      }}
                      className={cn(
                        "cursor-pointer rounded-xl p-4 transition-colors hover:border-emerald-500/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        done && "border-emerald-500/30 bg-emerald-500/5"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="text-[11px]">
                          {m.category}
                        </Badge>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3.5" aria-hidden="true" />
                          {m.durationMin} min
                        </span>
                      </div>
                      <h3 className="mt-2 text-sm font-semibold">{m.title}</h3>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{m.summary}</p>
                      <div className="mt-3 flex items-center justify-between text-xs">
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Users className="size-3.5" aria-hidden="true" />
                          {m.completions} completions
                        </span>
                        {done ? (
                          <span className="inline-flex items-center gap-1 font-medium text-emerald-400">
                            <CheckCircle2 className="size-4" aria-hidden="true" />
                            Completed
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Click to open</span>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Targeted awareness side card + badges callout */}
          <div className="space-y-4">
            <Card className="h-fit rounded-xl p-4 sm:p-6">
              <div className="flex items-center gap-2">
                <Target className="size-4 text-amber-400" aria-hidden="true" />
                <h2 className="text-sm font-semibold">Targeted awareness</h2>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Departments with the highest simulated click rates, matched to a focused module.
              </p>
              {targeted.length === 0 ? (
                <EmptyState
                  icon={Target}
                  title="Not enough data yet"
                  hint="Department risk appears after campaigns collect simulated clicks."
                  className="mt-3 border-0 py-6"
                />
              ) : (
                <ul className="mt-3 space-y-3">
                  {targeted.map((dept, idx) => {
                    const mod = recommendedModuleFor(idx);
                    return (
                      <li key={dept.department} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{dept.department}</p>
                          <span className="text-xs font-semibold text-red-400">
                            {Math.round(dept.clickRate)}% click rate
                          </span>
                        </div>
                        {mod ? (
                          <button
                            type="button"
                            className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                            onClick={() => setModuleOpen(mod)}
                          >
                            <GraduationCap className="size-3.5" aria-hidden="true" />
                            Recommended: {mod.title}
                          </button>
                        ) : null}
                      </li>
                    );
                  })}
                </ul>
              )}
              {participant ? (
                <div className="mt-4 border-t pt-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{participant.name}&apos;s progress</span>
                    <span className="font-medium tabular-nums">{progressPct}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.max(2, progressPct)}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </Card>

            {/* Earn badges callout */}
            <Card className="rounded-xl border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15 text-amber-400"
                >
                  <Trophy className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-semibold">Earn badges</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Reporting phishes in the Test Inbox earns points and badges on the Leaderboard.
                    Completing modules strengthens your resilience score too — every correct report
                    is worth +15 points.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Module detail dialog */}
      <Dialog open={moduleOpen !== null} onOpenChange={(o) => !o && setModuleOpen(null)}>
        <DialogContent
          className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-xl"
          aria-describedby="module-desc"
        >
          {moduleOpen ? (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2 pr-6">
                  <DialogTitle className="text-lg">{moduleOpen.title}</DialogTitle>
                  <Badge variant="secondary" className="text-[11px]">
                    {moduleOpen.category}
                  </Badge>
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3.5" aria-hidden="true" />
                    {moduleOpen.durationMin} min
                  </span>
                </div>
                <DialogDescription id="module-desc">{moduleOpen.summary}</DialogDescription>
              </DialogHeader>

              <div
                className="max-h-[46vh] overflow-y-auto pr-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-emerald-400 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:my-1 [&_li]:text-sm [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_p]:text-sm [&_p]:leading-relaxed [&_strong]:text-foreground [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
              >
                <ReactMarkdown>{moduleOpen.contentMd}</ReactMarkdown>
              </div>

              {moduleOpen.redFlagTips.length > 0 ? (
                <div>
                  <p className="text-sm font-semibold">Red flag tips</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {moduleOpen.redFlagTips.map((tip, i) => (
                      <span
                        key={i}
                        className="inline-flex max-w-full items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-400"
                      >
                        {tip}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <DialogFooter className="flex-col items-stretch gap-2 border-t pt-4 sm:items-center">
                {!participantId ? (
                  <p className="text-xs text-amber-400" role="status">
                    Choose a participant above to record completion for them.
                  </p>
                ) : null}
                <Button
                  onClick={() => void completeModule(moduleOpen.id)}
                  disabled={!participantId || completing || completedModuleIds.has(moduleOpen.id)}
                >
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  {completedModuleIds.has(moduleOpen.id)
                    ? "Already completed"
                    : completing
                      ? "Saving…"
                      : `Mark as completed for ${participant?.name ?? "…"}`}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
