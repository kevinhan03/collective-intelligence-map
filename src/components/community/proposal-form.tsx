"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useRef, useState } from "react";
import { Check, Search, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapCanvas } from "@/components/map/map-canvas";
import type { Candidate, RendererConfig, ThemeMap } from "@/domain/types";
import { post } from "./api";
type Internal = { id: string; name: string; address: string };

function highlightMatch(text: string, query: string) {
  const term = query.trim();
  if (!term) return text;
  const lowerText = text.toLocaleLowerCase("ko-KR");
  const lowerTerm = term.toLocaleLowerCase("ko-KR");
  const parts: React.ReactNode[] = [];
  let start = 0;
  let index = lowerText.indexOf(lowerTerm, start);
  while (index !== -1) {
    parts.push(text.slice(start, index));
    parts.push(
      <strong key={`${index}-${start}`} className="font-bold text-foreground">
        {text.slice(index, index + term.length)}
      </strong>,
    );
    start = index + term.length;
    index = lowerText.indexOf(lowerTerm, start);
  }
  parts.push(text.slice(start));
  return parts.map((part, index) => <Fragment key={index}>{part}</Fragment>);
}

export function ProposalForm({
  map,
  enabled,
  config,
}: {
  map: ThemeMap;
  enabled: boolean;
  config: RendererConfig;
}) {
  const router = useRouter();
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
    [externalSearched, setExternalSearched] = useState(false),
    [manualAddress, setManualAddress] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState<"approved" | "pending" | null>(null);
  const session = useRef(""),
    requestId = useRef(0),
    lastSearch = useRef(0),
    internalCache = useRef(new Map<string, Internal[]>()),
    externalCache = useRef(new Map<string, Candidate[]>());
  // Community places are free to search. External providers cost money per
  // request, so that search only runs when the member explicitly asks for it
  // (see "외부 지도에서 더 찾기" below) instead of on every keystroke's search.
  async function search() {
    const normalizedQuery = query.trim();
    if (normalizedQuery.length < 3) {
      setError("장소 이름을 세 글자 이상 입력해 주세요.");
      return;
    }
    if (Date.now() - lastSearch.current < 400) return;
    lastSearch.current = Date.now();
    const id = ++requestId.current;
    setExternalSearched(false);
    setCandidates([]);
    const cacheKey = normalizedQuery.toLocaleLowerCase("ko-KR");
    const cached = internalCache.current.get(cacheKey);
    if (cached) {
      setInternal(cached);
      setSearched(true);
      return;
    }
    setBusy(true);
    setError("");
    setSelection(null);
    try {
      const result = await post<{ internal: Internal[] }>(
        "/api/places/search",
        { mapId: map.id, query: normalizedQuery, external: false },
      );
      if (requestId.current === id) {
        internalCache.current.set(cacheKey, result.internal);
        setInternal(result.internal);
        setSearched(true);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  // Also used for the "paste an address" fallback below: Google/Kakao search
  // matches addresses just as well as names, so it reuses this same paid
  // autocomplete+details flow instead of a separate geocoding API/endpoint.
  async function searchExternal(text?: string) {
    const normalizedQuery = (text ?? query).trim();
    const id = ++requestId.current;
    const cacheKey = normalizedQuery.toLocaleLowerCase("ko-KR");
    const cached = externalCache.current.get(cacheKey);
    if (cached) {
      setCandidates(cached);
      setExternalSearched(true);
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (!session.current) session.current = crypto.randomUUID();
      const result = await post<{ candidates: Candidate[] }>(
        "/api/places/search",
        {
          mapId: map.id,
          query: normalizedQuery,
          external: true,
          session: session.current,
        },
      );
      if (requestId.current === id) {
        externalCache.current.set(cacheKey, result.candidates);
        setCandidates(result.candidates);
        setExternalSearched(true);
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
      setExternalSearched(false);
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
          로그인하면 누구나 장소를 제안할 수 있어요.{" "}
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
            minLength={3}
            maxLength={100}
            disabled={!enabled}
            onChange={(e) => {
              requestId.current++;
              setQuery(e.target.value);
              setSearched(false);
              setExternalSearched(false);
              setCandidates([]);
              setInternal([]);
              setSelection(null);
              setManualAddress("");
            }}
          />
          <Button disabled={!enabled || busy || query.trim().length < 3}>
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
                <span className="text-sm font-medium">
                  {highlightMatch(p.name, query)}
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {p.address} · 커뮤니티에 있는 장소
                </span>
              </button>
            ))}
            {!externalSearched && !selection && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => void searchExternal()}
                className="w-full"
              >
                <Search size={13} />
                {busy ? "찾는 중…" : "외부 지도에서 더 찾기"}
              </Button>
            )}
            {externalSearched && candidates.length > 0 && (
              <>
                <p className="pt-2 text-xs text-muted-foreground">
                  검색 결과 제공:{" "}
                  <span className="font-semibold">
                    {candidates[0].attribution}
                  </span>
                </p>
                {candidates.map((c) => (
                  <button
                    key={c.externalId}
                    onClick={() => choose(c)}
                    disabled={busy}
                    className="block w-full rounded-lg border p-3 text-left hover:bg-secondary"
                  >
                    <span className="text-sm font-medium">
                      {highlightMatch(c.label, query)}
                    </span>
                    {c.address && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {c.address}
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}
            {internal.length === 0 &&
              externalSearched &&
              candidates.length === 0 &&
              !selection && (
                <div className="space-y-2 rounded-lg border border-dashed p-4">
                  <p className="text-sm text-muted-foreground">
                    검색 결과가 없습니다. 등록된 언어가 달라 안 뜨는 경우가
                    있어요 — 다른 지도 서비스에서 확인한 주소를 붙여넣어
                    찾아볼 수 있습니다.
                  </p>
                  <Input
                    aria-label="주소"
                    placeholder="다른 지도 앱에서 복사한 주소를 붙여넣으세요"
                    value={manualAddress}
                    maxLength={250}
                    onChange={(e) => setManualAddress(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busy || manualAddress.trim().length < 5}
                    onClick={() => void searchExternal(manualAddress)}
                    className="w-full"
                  >
                    <Search size={13} />
                    {busy ? "찾는 중…" : "이 주소로 찾기"}
                  </Button>
                </div>
              )}
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
              router.push(`/maps/${map.slug}?submitted=1`);
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <section className="space-y-4 rounded-xl border bg-card p-6">
            <h2 className="text-sm font-semibold">02. 어떤 점을 추천하나요?</h2>
            <Label htmlFor="rationale">추천하는 점 한 줄</Label>
            <Textarea
              name="rationale"
              id="rationale"
              className="min-h-20"
              required
              minLength={5}
              maxLength={1000}
              placeholder="예: 90년대 일본 빈티지를 찾기 좋아요"
            />
            <p className="text-xs leading-6 text-muted-foreground">
              짧아도 괜찮아요. 이 테마에 어울리는 점 하나만 알려 주세요.
            </p>
          </section>
          <Button disabled={busy || !enabled} className="w-full h-11">
            {busy ? "보내는 중…" : "장소 제안하기"}
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
