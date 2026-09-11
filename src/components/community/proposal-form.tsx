"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Check, Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapCanvas } from "@/components/map/map-canvas";
import type { Candidate, RendererConfig, ThemeMap } from "@/domain/types";
import { post } from "./api";
type Internal = { id: string; name: string; address: string };
export function ProposalForm({
  map,
  enabled,
  config,
}: {
  map: ThemeMap;
  enabled: boolean;
  config: RendererConfig;
}) {
  const [query, setQuery] = useState(""),
    [internal, setInternal] = useState<Internal[]>([]),
    [candidates, setCandidates] = useState<Candidate[]>([]),
    [selection, setSelection] = useState<{
      placeId?: string;
      token?: string;
      label: string;
      lat?: number;
      lng?: number;
    } | null>(null),
    [searched, setSearched] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState<"approved" | "pending" | null>(null);
  const session = useRef(""),
    requestId = useRef(0),
    lastSearch = useRef(0);
  async function search() {
    if (Date.now() - lastSearch.current < 350) return;
    lastSearch.current = Date.now();
    const id = ++requestId.current;
    if (!session.current) session.current = crypto.randomUUID();
    setBusy(true);
    setError("");
    setSelection(null);
    try {
      const internalResult = await post<{
        internal: Internal[];
        candidates: Candidate[];
      }>("/api/places/search", {
        mapId: map.id,
        query,
        session: session.current,
      });
      const result =
        internalResult.internal.length > 0
          ? internalResult
          : await post<{
              internal: Internal[];
              candidates: Candidate[];
            }>("/api/places/search", {
              mapId: map.id,
              query,
              external: true,
              session: session.current,
            });
      if (requestId.current === id) {
        setInternal(result.internal);
        setCandidates(result.candidates);
        setSearched(true);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function choose(candidate: Candidate) {
    setBusy(true);
    setError("");
    try {
      const result = await post<{
        placeId: string | null;
        candidate: Candidate;
      }>("/api/places/details", { mapId: map.id, token: candidate.token });
      setSelection({
        placeId: result.placeId ?? undefined,
        token: result.candidate.token,
        label: result.candidate.label,
        lat: result.candidate.lat,
        lng: result.candidate.lng,
      });
      session.current = "";
      setCandidates([]);
    } catch (e) {
      setError((e as Error).message);
      session.current = "";
    } finally {
      setBusy(false);
    }
  }
  if (success)
    return (
      <div className="rounded-xl border bg-card p-10 text-center">
        <Check className="mx-auto mb-5 text-primary" size={32} />
        <h2 className="text-2xl font-semibold">새로운 발견을 남겼어요.</h2>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          {success === "approved"
            ? "지도에 바로 추가했습니다. 커뮤니티로 돌아가 확인해 보세요."
            : "검토 요청을 보냈습니다. 운영자가 승인하면 지도에 표시됩니다."}
        </p>
        <Button asChild className="mt-6">
          <Link href={`/maps/${map.slug}`}>커뮤니티로 돌아가기</Link>
        </Button>
      </div>
    );
  return (
    <div className="space-y-7">
      {!enabled && (
        <div className="rounded-lg border bg-secondary/50 p-4 text-sm leading-6">
          장소 제안은 로그인한 초대 기여자에게 열려 있습니다.{" "}
          <Link href="/login" className="font-medium underline">
            로그인하기
          </Link>
        </div>
      )}
      <section className="rounded-xl border bg-card p-6">
        <h2 className="mb-4 text-sm font-semibold">01. 어떤 장소인가요?</h2>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void search();
          }}
        >
          <Input
            aria-label="제안할 장소 검색"
            placeholder="장소 이름을 입력하세요"
            value={query}
            minLength={2}
            maxLength={100}
            disabled={!enabled}
            onChange={(e) => {
              requestId.current++;
              setQuery(e.target.value);
              setSearched(false);
              setCandidates([]);
              setInternal([]);
              setSelection(null);
            }}
          />
          <Button disabled={!enabled || busy || query.trim().length < 2}>
            <Search size={15} />
            검색
          </Button>
        </form>
        {searched && (
          <div className="mt-4 space-y-2">
            {internal.map((p) => (
              <button
                key={p.id}
                onClick={() => {
                  setSelection({ placeId: p.id, label: p.name });
                }}
                className="block w-full rounded-lg border p-3 text-left hover:bg-secondary"
              >
                <span className="text-sm font-medium">{p.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {p.address} · 커뮤니티에 있는 장소
                </span>
              </button>
            ))}
            {internal.length === 0 && candidates.length === 0 && !busy && (
              <p className="py-2 text-sm text-muted-foreground">
                검색 결과가 없습니다. 다른 장소 이름으로 다시 검색해 주세요.
              </p>
            )}
          </div>
        )}
        {candidates.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-muted-foreground">
              검색 결과 제공:{" "}
              <span className="font-semibold">{candidates[0].attribution}</span>
            </p>
            {candidates.map((c) => (
              <button
                key={c.externalId}
                onClick={() => choose(c)}
                disabled={busy}
                className="block w-full rounded-lg border p-3 text-left hover:bg-secondary"
              >
                <span className="text-sm font-medium">{c.label}</span>
                {c.address && (
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {c.address}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
        {selection && (
          <div className="mt-4 overflow-hidden rounded-lg border">
            <div className="flex items-center gap-2 bg-secondary p-3 text-sm">
              <Check size={15} />
              {selection.label}
            </div>
            {selection.lat !== undefined && selection.lng !== undefined && (
              <MapCanvas
                config={config}
                compact
                places={[
                  {
                    id: "selected-place",
                    place_id: "selected-place",
                    map_id: map.id,
                    name: selection.label,
                    address: "",
                    category: "",
                    lat: selection.lat,
                    lng: selection.lng,
                    rationale: "",
                    status: "selected",
                    added_by: null,
                    handle: "",
                    positive: 0,
                    negative: 0,
                    saved_count: 0,
                    created_at: "",
                    last_verified_at: null,
                  },
                ]}
                selected="selected-place"
                onSelect={() => undefined}
                bounds={{
                  south: selection.lat - 0.006,
                  north: selection.lat + 0.006,
                  west: selection.lng - 0.008,
                  east: selection.lng + 0.008,
                }}
                onBoundsChange={() => undefined}
              />
            )}
          </div>
        )}
      </section>
      {selection && (
        <form
          className="space-y-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              const result = await post<{ status: "approved" | "pending" }>(
                "/api/places/propose",
                {
                  mapId: map.id,
                  placeId: selection?.placeId,
                  candidateToken: selection?.token,
                  rationale: f.get("rationale"),
                  ...(!selection?.placeId && !selection?.token
                    ? {
                        name: f.get("name"),
                        address: f.get("address"),
                        category: f.get("category"),
                        lat: Number(f.get("lat")),
                        lng: Number(f.get("lng")),
                        sourceNote: f.get("sourceNote"),
                      }
                    : {}),
                },
              );
              setSuccess(result.status);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <section className="space-y-4 rounded-xl border bg-card p-6">
            <h2 className="text-sm font-semibold">02. 왜 이 주제에 맞나요?</h2>
            <Label htmlFor="rationale">추천 근거</Label>
            <Textarea
              name="rationale"
              id="rationale"
              className="min-h-32"
              required
              minLength={15}
              maxLength={1000}
              placeholder={`어떤 경험 때문에 ${map.title}에 추천하나요? 구체적인 이유를 15자 이상 남겨 주세요.`}
            />
            <p className="text-xs leading-6 text-muted-foreground">
              {map.rules}
            </p>
          </section>
          <Button disabled={busy || !enabled} className="w-full h-11">
            {busy ? "제출 중" : "운영자에게 검토 요청"}
          </Button>
        </form>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-destructive/5 p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      <Link
        href={`/maps/${map.slug}`}
        className="flex items-center gap-2 text-xs text-muted-foreground"
      >
        <ArrowLeft size={13} />
        맵으로 돌아가기
      </Link>
    </div>
  );
}
