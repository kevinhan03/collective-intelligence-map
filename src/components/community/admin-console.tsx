"use client";
import Image from "next/image";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useSearchParams } from "next/navigation";
import { useRouter, usePathname } from "@/i18n/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { post } from "./api";
import { useI18n } from "@/i18n/client";
type Proposal = {
  id: string;
  place_id: string;
  name: string;
  address: string;
  lng: number;
  lat: number;
  rationale: string;
  source_note: string;
  status: string;
  map_title: string;
  handle: string;
  created_at: string;
  last_verified_at: string | null;
  review_count?: number;
  negative_count?: number;
};
type Report = {
  id: string;
  reason: string;
  map_place_id: string | null;
  comment_id: string | null;
  photo_id: string | null;
  photo_status?: string;
  created_at: string;
  body?: string;
  name?: string;
};
type Action = {
  id: string;
  action: string;
  reason: string;
  created_at: string;
  map_place_id?: string | null;
  place_id?: string | null;
  report_id?: string | null;
  comment_id?: string | null;
  photo_id?: string | null;
};
type Duplicate = {
  source_id: string;
  source_name: string;
  target_id: string;
  target_name: string;
  distance_m: number;
};
export type AdminSnapshot = {
  proposals: Proposal[];
  reports: Report[];
  actions: Action[];
  duplicates: Duplicate[];
};
export function AdminConsole({ snapshot }: { snapshot: AdminSnapshot }) {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const pathname = usePathname();
  const tab = ["proposals", "reports", "duplicates", "history"].includes(
    params.get("tab") ?? "",
  )
    ? params.get("tab")!
    : "proposals";
  const filter = ["pending", "disputed", "approved", "all"].includes(
    params.get("status") ?? "",
  )
    ? params.get("status")!
    : "pending";
  function updateLocation(key: string, value: string) {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    window.history.pushState(null, "", `${pathname}?${next}`);
  }
  const [now] = useState(() => Date.now());
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("priority");
  const [reportFilter, setReportFilter] = useState("all");
  const [success, setSuccess] = useState("");
  const reports = snapshot.reports.filter(
    (r) =>
      reportFilter === "all" ||
      (r.photo_id ? "photo" : r.comment_id ? "comment" : "place") ===
        reportFilter,
  );
  const proposals = snapshot.proposals
    .filter(
      (p) =>
        (filter === "all" || p.status === filter) &&
        `${p.name} ${p.address} ${p.map_title} ${p.handle}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => {
      const oldest = Date.parse(a.created_at) - Date.parse(b.created_at);
      if (sort === "oldest") return oldest;
      if (sort === "newest") return -oldest;
      return (
        (b.review_count ?? 0) +
          (b.negative_count ?? 0) -
          ((a.review_count ?? 0) + (a.negative_count ?? 0)) || oldest
      );
    });
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [reason, setReason] = useState(""),
    [pending, setPending] = useState<{
      action: string;
      id: string;
      status?: string;
      targetId?: string;
      description: string;
    } | null>(null);
  async function execute() {
    if (!pending || busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const { description: _, ...payload } = pending;
      void _;
      await post("/api/community", { ...payload, reason });
      setSuccess(t("admin.moderationActionCompleted"));
      setPending(null);
      setReason("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      {success && (
        <p role="status" className="rounded-lg border p-3 text-sm text-primary">
          {success}
        </p>
      )}
      <Tabs value={tab} onValueChange={(value) => updateLocation("tab", value)}>
        <TabsList
          aria-label={t("admin.adminTasks")}
          className="h-auto w-full flex-wrap gap-1 mb-4"
        >
          <TabsTrigger value="proposals">
            {t("admin.placeReview")}{" "}
            {
              snapshot.proposals.filter((p) =>
                ["pending", "disputed"].includes(p.status),
              ).length
            }
          </TabsTrigger>
          <TabsTrigger value="reports">
            {t("admin.report")} {snapshot.reports.length}
          </TabsTrigger>
          <TabsTrigger value="duplicates">
            {t("admin.possibleDuplicate")} {snapshot.duplicates.length}
          </TabsTrigger>
          <TabsTrigger value="history">{t("admin.moderationLog")}</TabsTrigger>
        </TabsList>
        <TabsContent value="proposals">
          <h2 className="mb-5 text-xl font-semibold">
            {t("admin.placeReview")}{" "}
            <span className="text-muted-foreground">{proposals.length}</span>
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {t("admin.queueSummary", {
              pending: snapshot.proposals.filter((p) => p.status === "pending")
                .length,
              disputed: snapshot.proposals.filter(
                (p) => p.status === "disputed",
              ).length,
            })}
          </p>
          <div className="flex flex-wrap gap-2 mb-4">
            {Object.entries({
              pending: t("admin.awaitingApproval"),
              disputed: t("admin.reReview"),
              approved: t("admin.live"),
              all: t("admin.all"),
            }).map(([value, label]) => (
              <Button
                key={value}
                size="sm"
                variant={filter === value ? "default" : "outline"}
                onClick={() => updateLocation("status", value)}
              >
                {label}
              </Button>
            ))}
            <Input
              aria-label={t("admin.searchPlacesToReview")}
              placeholder={t("admin.searchPlacesAddressesThemesOr")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              {t("admin.sort")}
              <select
                aria-label={t("admin.sortPlaceReview")}
                value={sort}
                onChange={(event) => setSort(event.target.value)}
                className="rounded-lg border bg-background p-2"
              >
                <option value="priority">{t("admin.mostFlagged")}</option>
                <option value="oldest">{t("admin.oldest")}</option>
                <option value="newest">{t("admin.newest")}</option>
              </select>
            </label>
          </div>
          {proposals.length === 0 && (
            <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
              {t("admin.noPlacesToReview")}
            </p>
          )}
          <div className="space-y-4">
            {proposals.map((p) => (
              <article key={p.id} className="rounded-xl border bg-card p-5">
                <div className="flex justify-between gap-3">
                  <h3 className="font-semibold">{p.name}</h3>
                  <Badge variant="secondary">
                    {{
                      pending: t("admin.awaitingApproval"),
                      disputed: t("admin.reReview"),
                      approved: t("admin.live"),
                      rejected: t("admin.reject"),
                      archived: t("admin.archive"),
                    }[p.status] ?? p.status}
                  </Badge>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {p.map_title} · @{p.handle} · {p.address}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("admin.location", { lat: p.lat, lng: p.lng })}
                </p>
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("admin.reviewCounts", {
                    reviews: p.review_count ?? 0,
                    negative: p.negative_count ?? 0,
                  })}
                  {(!p.last_verified_at ||
                    now - Date.parse(p.last_verified_at) > 90 * 86400000) &&
                    t("admin.notVerifiedInTheLast")}
                </p>
                <p className="mt-4 text-sm leading-7">{p.rationale}</p>
                <div className="my-4 rounded-lg bg-secondary/50 p-3 text-xs leading-6">
                  <strong>{t("admin.sourceOfNameAddressAnd")}</strong>
                  <p>{p.source_note || t("admin.missingSourceCanTApprove")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(p.status === "pending"
                    ? ["approved", "rejected"]
                    : p.status === "approved"
                      ? ["disputed", "archived"]
                      : ["approved", "archived"]
                  ).map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      variant={status === "approved" ? "default" : "outline"}
                      onClick={() =>
                        setPending({
                          action: "moderate",
                          id: p.id,
                          status,
                          description: `${p.name}: ${status === "approved" ? t("admin.approveAfterCheckingAnIndependent") : status === "rejected" ? t("admin.rejectThisSuggestion") : status === "disputed" ? t("admin.markAsNeedingReview") : t("admin.archiveFromThePublicMap")}`,
                        })
                      }
                    >
                      {
                        {
                          approved: t("admin.approve"),
                          rejected: t("admin.reject"),
                          disputed: t("admin.needsReview"),
                          archived: t("admin.archive"),
                        }[status]
                      }
                    </Button>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="duplicates">
          <h2 className="mb-5 text-xl font-semibold">
            {t("admin.possibleDuplicate")}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {t("admin.thesePlacesAreWithin100")}
          </p>
          {snapshot.duplicates.map((d, i) => (
            <article
              key={i}
              className="mb-3 flex flex-wrap items-center justify-between gap-4 rounded-lg border bg-card p-4"
            >
              <div>
                <p className="text-sm font-medium">
                  {d.source_name} → {d.target_name}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("admin.duplicateDistance", { distance: d.distance_m })}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setPending({
                    action: "merge",
                    id: d.source_id,
                    targetId: d.target_id,
                    description: t("admin.mergeSourceIntoTargetThe", {
                      source_name: d.source_name,
                      target_name: d.target_name,
                    }),
                  })
                }
              >
                {t("admin.reviewMerge")}
              </Button>
            </article>
          ))}
          {snapshot.duplicates.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("admin.noPossibleDuplicates")}
            </p>
          )}
        </TabsContent>
        <TabsContent value="reports">
          <h2 className="mb-5 text-xl font-semibold">
            {t("admin.report")} {snapshot.reports.length}
          </h2>
          <label className="mb-4 flex items-center gap-2 text-sm">
            {t("admin.reportType")}
            <select
              aria-label={t("admin.reportType")}
              value={reportFilter}
              onChange={(event) => setReportFilter(event.target.value)}
              className="rounded-lg border bg-background p-2"
            >
              <option value="all">{t("admin.all")}</option>
              <option value="place">{t("admin.place")}</option>
              <option value="comment">{t("admin.comment")}</option>
              <option value="photo">{t("admin.photo")}</option>
            </select>
          </label>
          {reports.length === 0 && (
            <p className="p-4 text-sm text-muted-foreground">
              {t("admin.noOpenReportsOfThis")}
            </p>
          )}
          {reports.map((r) => (
            <article key={r.id} className="mb-4 rounded-lg border bg-card p-5">
              <p className="text-xs text-muted-foreground">
                {r.photo_id
                  ? t("admin.photoReport")
                  : r.comment_id
                    ? t("admin.commentReport")
                    : t("admin.placeReport")}{" "}
                · {new Date(r.created_at).toLocaleDateString("ko-KR")}
              </p>
              {r.photo_id && r.photo_status !== "deleted" && (
                <Image
                  unoptimized
                  src={`/api/photos/${r.photo_id}/image?size=thumbnail&admin=1`}
                  alt={t("admin.reportedPhoto")}
                  width={240}
                  height={180}
                  className="my-3 h-auto max-h-48 w-auto rounded object-contain"
                />
              )}
              {(r.body || r.name) && (
                <p className="my-3 rounded bg-secondary p-3 text-sm">
                  {r.body ?? r.name}
                </p>
              )}
              <p className="my-4 text-sm">{r.reason}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setPending({
                      action: "resolve_report",
                      id: r.id,
                      description: t("admin.markReportAsReviewedContent", {
                        id: r.id,
                      }),
                    })
                  }
                >
                  {t("admin.resolved")}
                </Button>
                {r.photo_id && r.photo_status === "visible" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPending({
                        action: "hide_photo",
                        id: r.photo_id!,
                        description: t("admin.hidePhotoOnAllTheme", {
                          photo_id: r.photo_id!,
                        }),
                      })
                    }
                  >
                    {t("admin.hidePhoto")}
                  </Button>
                )}
                {r.comment_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPending({
                        action: "hide_comment",
                        id: r.comment_id!,
                        description: t("admin.hideCommentFromPublicView", {
                          comment_id: r.comment_id!,
                        }),
                      })
                    }
                  >
                    {t("admin.hideComment")}
                  </Button>
                )}
                {r.map_place_id && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setPending({
                        action: "moderate",
                        id: r.map_place_id!,
                        status: "disputed",
                        description: t("admin.markForReview", {
                          name: r.name ?? r.map_place_id ?? "",
                        }),
                      })
                    }
                  >
                    {t("admin.placeNeedsReview")}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </TabsContent>
        <TabsContent value="history">
          <h2 className="mb-5 text-xl font-semibold">
            {t("admin.recentModerationLog")}
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">
            {t("admin.theLast50Actions")}
          </p>
          {snapshot.actions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              {t("admin.noModerationHistory")}
            </p>
          )}
          <div className="divide-y rounded-lg border bg-card">
            {snapshot.actions.map((a) => (
              <div key={a.id} className="p-4">
                <span className="text-xs font-semibold">
                  {{
                    moderate: t("admin.placeStatusChange"),
                    resolve_report: t("admin.reportResolved"),
                    hide_comment: t("admin.commentHidden"),
                    hide_photo: t("admin.photoHidden"),
                    merge: t("admin.placesMerged"),
                    provider_settings: t("admin.searchProviderSettingsChanged"),
                  }[a.action] ?? t("admin.moderationAction")}
                </span>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  {Object.entries({
                    장소: a.map_place_id,
                    "실제 장소": a.place_id,
                    신고: a.report_id,
                    댓글: a.comment_id,
                    사진: a.photo_id,
                  })
                    .filter(([, id]) => id)
                    .map(([label, id]) => `${label}: ${id}`)
                    .join(" · ")}
                </p>
                <p className="mt-1 text-sm">{a.reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(a.created_at).toLocaleString("ko-KR")}
                </p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
      <AlertDialog
        open={Boolean(pending)}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setPending(null);
            setReason("");
            setError("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.pleaseConfirmTheModerationAction")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <label htmlFor="moderation-reason" className="text-sm font-medium">
            {t("admin.reason")}
          </label>
          <Textarea
            id="moderation-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            minLength={5}
            maxLength={1000}
            placeholder={t("admin.recordTheSourcesYouChecked")}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {[
              t("admin.checkedThemeFitAndPlace"),
              t("admin.notEnoughReasonToFit"),
              t("admin.confirmedAsADuplicatePlace"),
              t("admin.confirmedClosedOrMoved"),
            ].map((text) => (
              <Button
                key={text}
                size="sm"
                variant="outline"
                onClick={() => setReason(text)}
              >
                {text}
              </Button>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>
              {t("admin.cancel")}
            </AlertDialogCancel>
            <Button
              onClick={execute}
              disabled={busy || reason.trim().length < 5}
            >
              {busy ? t("admin.processing") : t("admin.confirmAndRun")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
