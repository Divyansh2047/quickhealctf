"use client";

// PhishGuard — Test Inbox: a fully in-platform, controlled environment where
// demo participants "receive" simulated phishes. Clicks are intercepted and
// turned into teaching moments; nothing reaches real mail servers.

import { useMemo, useState } from "react";
import {
  Flag,
  FlagTriangleRight,
  GraduationCap,
  Inbox as InboxIcon,
  MailOpen,
  MousePointerClick,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import type { InboxItem, Participant, TrackEventType, TrackResponse } from "../api";
import { useInbox, useParticipants } from "../hooks";
import {
  DifficultyBadge,
  EmptyState,
  ErrorState,
  initials,
  relativeTime,
  SectionTitle,
  shortDateTime,
} from "../shared";
import type { ViewKey } from "../view-keys";

export default function TestInboxView({
  onNavigate,
}: {
  onNavigate: (v: ViewKey) => void;
}) {
  const { data: participantsData, loading: pLoading, error: pError, refresh: refreshParticipants } = useParticipants();
  const actors = useMemo<Participant[]>(
    () =>
      (participantsData?.participants ?? []).filter((p) => p.active && p.consented),
    [participantsData]
  );
  const [pickedParticipantId, setPickedParticipantId] = useState<string | null>(null);
  const participantId = pickedParticipantId ?? actors[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [teachingOpen, setTeachingOpen] = useState(false);
  const [teachingItem, setTeachingItem] = useState<InboxItem | null>(null);

  const { data, loading, error, refresh } = useInbox(participantId || null);
  const inbox = data?.inbox ?? [];
  const selected = inbox.find((i) => i.enrollmentId === selectedId) ?? null;

  /** Fire-and-forget event tracking. */
  const track = async (
    enrollmentId: string,
    type: TrackEventType
  ): Promise<TrackResponse | null> => {
    try {
      return await api<TrackResponse>("/api/track", {
        method: "POST",
        body: JSON.stringify({ enrollmentId, type }),
      });
    } catch (err) {
      toast.error(apiErrorMessage(err));
      return null;
    }
  };

  const openEmail = (item: InboxItem) => {
    setSelectedId(item.enrollmentId);
    if (!item.opened) {
      void track(item.enrollmentId, "OPEN").then(() => void refresh());
    }
  };

  /** Intercept anchor clicks inside the simulated email body. */
  const handleBodyClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest("a");
    if (!anchor || !selected) return;
    e.preventDefault();
    e.stopPropagation();
    const wasAlready = selected.clicked;
    void track(selected.enrollmentId, "CLICK").then((res) => {
      if (res && !res.already) void refresh();
    });
    setTeachingItem(selected);
    setTeachingOpen(true);
    if (wasAlready) {
      // repeat click — still safe, just note it
      toast.info("Simulated link — already recorded for this email.");
    }
  };

  const reportPhish = async () => {
    if (!selected) return;
    const res = await track(selected.enrollmentId, "REPORT");
    if (!res) return;
    if (res.already) {
      toast.info("You already reported this phish — great instincts!");
    } else {
      toast.success("Phish reported — nice catch!");
    }
    void refresh();
  };

  return (
    <div className="space-y-6">
      <SectionTitle
        title="Test inbox"
        icon={InboxIcon}
        description="Experience a simulated phish exactly as an employee would — with every click safely intercepted."
      />

      {/* Controlled environment banner */}
      <div
        role="note"
        className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4"
      >
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-emerald-400" aria-hidden="true" />
        <div>
          <p className="text-sm font-semibold text-emerald-300">
            CONTROLLED TEST ENVIRONMENT
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            This inbox lives entirely inside PhishGuard. Nothing is sent to real mail
            servers and no credentials are ever requested or stored.
          </p>
        </div>
      </div>

      {/* Acting as */}
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="inbox-actor" className="text-sm text-muted-foreground">
          Acting as
        </Label>
        <Select value={participantId} onValueChange={(v) => { setPickedParticipantId(v); setSelectedId(null); }}>
          <SelectTrigger id="inbox-actor" className="w-full sm:w-[300px]" aria-label="Acting participant">
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
      </div>

      {error && !data ? (
        <ErrorState message={error} onRetry={() => void refresh()} />
      ) : !participantId ? (
        <EmptyState
          icon={InboxIcon}
          title="No consenting participants"
          hint="Record consent for at least one participant under Compliance → Consent to use the test inbox."
        />
      ) : loading && !data ? (
        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          <Skeleton className="h-[520px] rounded-xl" />
          <Skeleton className="hidden h-[520px] rounded-xl md:block" />
        </div>
      ) : inbox.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="Inbox is empty"
          hint="This participant has not been enrolled in a delivered campaign yet. Launch a campaign with them enrolled, then come back."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-[320px_1fr]">
          {/* Email list */}
          <Card className="rounded-xl p-2">
            <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
              Simulated inbox — {inbox.length} message{inbox.length === 1 ? "" : "s"}
            </p>
            <ul aria-label="Simulated inbox messages" className="max-h-[520px] overflow-y-auto">
              {inbox.map((item) => (
                <li key={item.enrollmentId}>
                  <button
                    type="button"
                    onClick={() => openEmail(item)}
                    aria-current={selectedId === item.enrollmentId ? "true" : undefined}
                    className={cn(
                      "w-full rounded-lg px-2.5 py-2.5 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                      selectedId === item.enrollmentId && "bg-accent"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium">
                        {item.template.senderName}
                      </span>
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {relativeTime(item.deliveredAt)}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "mt-0.5 truncate text-sm",
                        item.opened ? "text-foreground/80" : "font-semibold"
                      )}
                    >
                      {!item.opened ? (
                        <span
                          aria-hidden="true"
                          className="mr-1.5 inline-block size-1.5 rounded-full bg-emerald-400 align-middle"
                        />
                      ) : null}
                      {item.template.subject}
                    </p>
                    <div className="mt-1.5 flex items-center justify-between gap-2">
                      <Badge variant="secondary" className="max-w-32 truncate text-[9px]">
                        {item.campaignName}
                      </Badge>
                      <span className="flex items-center gap-1" aria-label="message status">
                        {item.opened ? (
                          <MailOpen className="size-3.5 text-emerald-400" aria-label="opened" />
                        ) : null}
                        {item.clicked ? (
                          <MousePointerClick className="size-3.5 text-red-400" aria-label="clicked" />
                        ) : null}
                        {item.reported ? (
                          <Flag className="size-3.5 text-teal-400" aria-label="reported" />
                        ) : null}
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {/* Reading pane */}
          <Card className="rounded-xl p-4 sm:p-6">
            {selected ? (
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-start gap-3 border-b pb-4">
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-emerald-500/15 text-sm font-semibold text-emerald-400">
                      {initials(selected.template.senderName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-semibold">{selected.template.senderName}</span>{" "}
                      <span className="font-mono text-xs text-muted-foreground">
                        &lt;{selected.template.senderEmail}&gt;
                      </span>
                    </p>
                    <p className="mt-0.5 text-lg font-semibold leading-snug">
                      {selected.template.subject}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{shortDateTime(selected.deliveredAt)}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {selected.template.category}
                      </Badge>
                      <DifficultyBadge difficulty={selected.template.difficulty} />
                      <Badge variant="outline" className="text-[10px]">
                        {selected.campaignName}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Body — clicks intercepted */}
                <div
                  onClickCapture={handleBodyClickCapture}
                  aria-label="Simulated email body (links are intercepted)"
                >
                  <div
                    className="rounded-md border bg-white p-4 text-slate-900 [&_a]:cursor-pointer"
                    dangerouslySetInnerHTML={{ __html: selected.template.bodyHtml }}
                  />
                </div>

                {/* Status + actions */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {selected.opened ? (
                      <Badge className="border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
                        <MailOpen className="size-3" aria-hidden="true" /> opened
                      </Badge>
                    ) : null}
                    {selected.clicked ? (
                      <Badge className="border border-red-500/40 bg-red-500/15 text-red-400">
                        <MousePointerClick className="size-3" aria-hidden="true" /> clicked
                      </Badge>
                    ) : null}
                    {selected.reported ? (
                      <Badge className="border border-teal-500/40 bg-teal-500/15 text-teal-400">
                        <Flag className="size-3" aria-hidden="true" /> reported
                      </Badge>
                    ) : null}
                    {!selected.opened && !selected.clicked && !selected.reported ? (
                      <span className="text-muted-foreground">Untouched — inspect and decide.</span>
                    ) : null}
                  </div>
                  <Button variant="destructive" onClick={() => void reportPhish()}>
                    <FlagTriangleRight className="size-4" aria-hidden="true" />
                    Report Phish
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={MailOpen}
                title="Select a message"
                hint="Pick an email on the left to read it. Links inside are intercepted — clicking one is a safe, trackable teaching moment."
                className="border-0"
              />
            )}
          </Card>
        </div>
      )}

      {/* Teaching moment dialog */}
      <Dialog open={teachingOpen} onOpenChange={setTeachingOpen}>
        <DialogContent className="max-w-lg rounded-xl" aria-describedby="teaching-desc">
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-400">
                <MousePointerClick className="size-5" aria-hidden="true" />
                That was a simulated phishing click
              </DialogTitle>
              <DialogDescription id="teaching-desc" className="text-red-200/80">
                No credentials were collected — this is a safe teaching moment.
              </DialogDescription>
            </DialogHeader>
          </div>

          {teachingItem ? (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-semibold">What gave it away</p>
                <ul className="mt-2 space-y-2">
                  {teachingItem.template.redFlags.map((flag, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Flag className="mt-0.5 size-4 shrink-0 text-amber-400" aria-hidden="true" />
                      <span>{flag}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {teachingItem.template.landingMessage ? (
                <div className="rounded-lg border bg-muted/40 p-3 text-sm leading-relaxed text-muted-foreground">
                  {teachingItem.template.landingMessage}
                </div>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setTeachingOpen(false);
                onNavigate("training");
              }}
            >
              <GraduationCap className="size-4" aria-hidden="true" />
              Browse training modules
            </Button>
            <Button onClick={() => setTeachingOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
