"use client";
import { useState } from "react";
import { Check, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MapPlace, Viewer } from "@/domain/types";
import { post } from "./api";
export function PendingReview({
  places,
  viewer,
  votes,
  demo,
  onChange,
}: {
  places: MapPlace[];
  viewer: Viewer | null;
  votes: Record<string, number>;
  demo: boolean;
  onChange: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const enabled = Boolean(viewer) && !demo;
  async function vote(place: MapPlace, value: number) {
    setBusyId(place.id);
    setError("");
    try {
      await post("/api/community", { action: "vote", id: place.id, value });
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }
  return (
    <section
      className="border-b bg-secondary/20 px-5 py-4 md:px-9"
      aria-label="승인 대기 장소"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">승인 대기 {places.length}곳</p>
        <p className="text-[11px] text-muted-foreground">
          여기서 남긴 적합/부적합 의견은 운영자의 승인 판단에 참고됩니다.
        </p>
      </div>
      <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
        {places.map((p) => {
          const myVote = votes[p.id] ?? 0;
          return (
            <article
              key={p.id}
              className="place-glass-card w-72 shrink-0 p-4"
            >
              <p className="truncate text-sm font-semibold">{p.name}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {p.category} · @{p.handle}
              </p>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {p.rationale}
              </p>
              <div className="mt-3 flex gap-2">
                <Button
                  size="sm"
                  variant={myVote === 1 ? "default" : "outline"}
                  disabled={!enabled || busyId === p.id}
                  onClick={() => vote(p, myVote === 1 ? 0 : 1)}
                >
                  <Check size={13} />
                  적합해요 {p.positive}
                </Button>
                <Button
                  size="sm"
                  variant={myVote === -1 ? "default" : "outline"}
                  disabled={!enabled || busyId === p.id}
                  onClick={() => vote(p, myVote === -1 ? 0 : -1)}
                >
                  <ThumbsDown size={13} />
                  아니에요 {p.negative}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      {!enabled && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          {demo
            ? "가상 예시에서는 참여 기능을 사용할 수 없습니다."
            : "로그인하면 적합/부적합 의견을 남길 수 있습니다."}
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
