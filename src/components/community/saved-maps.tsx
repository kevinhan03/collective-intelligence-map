"use client";
import { useState } from "react";
import Link from "next/link";
import { Bookmark } from "lucide-react";
import type { ThemeMap } from "@/domain/types";
import { MapCardBackdrop } from "./map-card-backdrop";
import { post } from "./api";
export function SavedMaps({ maps }: { maps: ThemeMap[] }) {
  const [removed, setRemoved] = useState<string[]>([]);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const visible = maps.filter((map) => !removed.includes(map.id));
  if (!maps.length) return null;
  return (
    <section aria-label="저장한 지도" className="my-6">
      <h2 className="mb-3 text-xl font-semibold">저장한 지도</h2>
      {error && (
        <p role="alert" className="mb-3 text-sm text-destructive">
          {error}
        </p>
      )}
      {!visible.length && (
        <p className="text-sm text-muted-foreground">저장한 지도가 없어요.</p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((map) => (
          <li
            key={map.id}
            className="relative isolate overflow-hidden rounded-2xl border bg-card"
          >
            <Link
              href={`/maps/${map.slug}`}
              className="relative flex min-h-36 flex-col justify-end overflow-hidden p-5 focus-visible:outline-2 focus-visible:outline-primary"
            >
              <div className="absolute inset-0 -z-20">
                <MapCardBackdrop slug={map.slug} sharp />
              </div>
              <span className="absolute inset-0 -z-10 bg-linear-to-t from-black via-black/60 to-transparent" />
              <h3 className="max-w-[calc(100%-32px)] text-lg font-semibold text-white">
                {map.title}
              </h3>
              <p className="mt-1 text-sm text-white/80">{map.place_count}곳</p>
            </Link>
            <button
              type="button"
              aria-label={`${map.title} 지도 저장 취소`}
              disabled={pending !== null}
              className="absolute top-3 right-3 rounded-full border border-white/40 bg-black/50 p-2 text-primary backdrop-blur-md focus-visible:outline-2 focus-visible:outline-primary"
              onClick={async () => {
                setPending(map.id);
                setError("");
                try {
                  await post("/api/maps/engagement", {
                    action: "save_map",
                    id: map.id,
                    enabled: false,
                  });
                  setRemoved((value) => [...value, map.id]);
                } catch (cause) {
                  setError((cause as Error).message);
                } finally {
                  setPending(null);
                }
              }}
            >
              <Bookmark size={17} fill="currentColor" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
