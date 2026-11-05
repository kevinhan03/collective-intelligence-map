"use client";
import { useState } from "react";
import { Check, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MapPlace, Viewer } from "@/domain/types";
import { ApiError, post } from "./api";
import { loginHref } from "@/domain/login-return";
import { useI18n } from "@/i18n/client";
export function PendingReview({
  places,
  viewer,
  votes,
  demo,
  onChange,
  onVote,
  isPending,
}: {
  places: MapPlace[];
  viewer: Viewer | null;
  votes: Record<string, number>;
  demo: boolean;
  onChange?: () => void;
  onVote?: (id: string, value: 1 | -1) => Promise<void>;
  isPending?: (id: string) => boolean;
}) {
  const { t } = useI18n();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const enabled = Boolean(viewer) && !demo;
  async function vote(place: MapPlace, value: 1 | -1) {
    if (onVote) {
      await onVote(place.id, value);
      return;
    }
    const signIn = () =>
      window.location.assign(
        loginHref(
          `${window.location.pathname}?place=${encodeURIComponent(place.place_id)}`,
        ),
      );
    if (!viewer) {
      signIn();
      return;
    }
    setBusyId(place.id);
    setError("");
    try {
      await post("/api/community", {
        action: "vote",
        id: place.id,
        value: votes[place.id] === value ? 0 : value,
      });
      onChange?.();
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        signIn();
        return;
      }
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }
  return (
    <section
      className="border-b bg-secondary/20 px-5 py-4 md:px-9"
      aria-label={t("map.pendingPlace")}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {t("map.awaitingApprovalCount", { count: places.length })}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {t("map.yourFitsDoesnTFit")}
        </p>
      </div>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
        {places.map((p) => {
          const myVote = votes[p.id] ?? 0;
          return (
            <article key={p.id} className="place-glass-card w-72 shrink-0 p-4">
              <p className="truncate text-sm font-semibold">{p.name}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {t.data("placeCategory", p.category)} · @{p.handle}
              </p>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {p.rationale}
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant={myVote === 1 ? "default" : "outline"}
                  disabled={demo || busyId === p.id || isPending?.(p.id)}
                  onClick={() => vote(p, 1)}
                >
                  <Check size={13} />
                  {t("map.fits")} {p.positive}
                </Button>
                <Button
                  size="sm"
                  variant={myVote === -1 ? "default" : "outline"}
                  disabled={demo || busyId === p.id || isPending?.(p.id)}
                  onClick={() => vote(p, -1)}
                >
                  <ThumbsDown size={13} />
                  {t("map.doesnTFit")} {p.negative}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {!enabled && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {demo
            ? t("map.participationIsnTAvailableFor")
            : t("map.signInToShareWhether")}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
