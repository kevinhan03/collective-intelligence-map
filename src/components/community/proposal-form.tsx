"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Check, Search, ArrowLeft, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Candidate, ThemeMap } from "@/domain/types";
import { post } from "./api";
type Internal = { id: string; name: string; address: string };
export function ProposalForm({
  map,
  enabled,
}: {
  map: ThemeMap;
  enabled: boolean;
}) {
  const [query, setQuery] = useState(""),
    [internal, setInternal] = useState<Internal[]>([]),
    [candidates, setCandidates] = useState<Candidate[]>([]),
    [selection, setSelection] = useState<{
      placeId?: string;
      token?: string;
      label: string;
    } | null>(null),
    [searched, setSearched] = useState(false),
    [manual, setManual] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState(false);
  const session = useRef(""),
    requestId = useRef(0),
    lastSearch = useRef(0);
  async function search(external = false) {
    if (Date.now() - lastSearch.current < 350) return;
    lastSearch.current = Date.now();
    const id = ++requestId.current;
    if (!session.current) session.current = crypto.randomUUID();
    setBusy(true);
    setError("");
    setSelection(null);
    try {
      const result = await post<{
        internal: Internal[];
        candidates: Candidate[];
      }>("/api/places/search", {
        mapId: map.id,
        query,
        external,
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
        label: candidate.label,
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
          운영자가 출처와 주제 적합성을 확인한 뒤 공개합니다.
          <br />
          검토 중인 장소는 지도에 바로 표시되지 않습니다.
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
                  setManual(false);
                }}
                className="block w-full rounded-lg border p-3 text-left hover:bg-secondary"
              >
                <span className="text-sm font-medium">{p.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {p.address} · 커뮤니티에 있는 장소
                </span>
              </button>
            ))}
            {internal.length === 0 && (
              <p className="py-2 text-sm text-muted-foreground">
                내부 지도에 일치하는 장소가 없습니다.
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => search(true)}
            >
              찾는 장소가 없나요? 외부 장소 검색
            </Button>
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
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-secondary p-3 text-sm">
            <Check size={15} />
            {selection.label}
          </div>
        )}
        <Button
          variant="link"
          className="mt-3 px-0 text-xs"
          disabled={!enabled}
          onClick={() => {
            setManual(true);
            setSelection(null);
          }}
        >
          직접 알고 있는 장소 입력하기
        </Button>
      </section>
      {(selection || manual) && (
        <form
          className="space-y-6"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            const f = new FormData(e.currentTarget);
            try {
              await post("/api/places/propose", {
                mapId: map.id,
                placeId: selection?.placeId,
                candidateToken: selection?.token,
                rationale: f.get("rationale"),
                ...(!selection?.placeId
                  ? {
                      name: f.get("name"),
                      address: f.get("address"),
                      category: f.get("category"),
                      lat: Number(f.get("lat")),
                      lng: Number(f.get("lng")),
                      sourceNote: f.get("sourceNote"),
                    }
                  : {}),
              });
              setSuccess(true);
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {!selection?.placeId && (
            <section className="space-y-4 rounded-xl border bg-card p-6">
              <h2 className="text-sm font-semibold">02. 장소 정보와 출처</h2>
              <p className="flex gap-2 rounded-lg bg-secondary/60 p-3 text-xs leading-6 text-muted-foreground">
                <Info className="mt-1 shrink-0" size={14} />
                외부 검색 결과를 복사하지 말고, 직접 조사했거나 사용 권한이 있는
                장소 정보를 입력해 주세요. 운영자가 출처를 확인합니다.
              </p>
              <div className="space-y-2">
                <Label htmlFor="name">장소 이름</Label>
                <Input name="name" id="name" required maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">주소</Label>
                <Input name="address" id="address" required maxLength={250} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">분류</Label>
                <select
                  name="category"
                  id="category"
                  className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                >
                  {map.tags
                    .filter((t) => t !== "전체")
                    .map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="lat">위도</Label>
                  <Input
                    name="lat"
                    id="lat"
                    type="number"
                    step="any"
                    min={map.bounds.south}
                    max={map.bounds.north}
                    placeholder="35.66"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lng">경도</Label>
                  <Input
                    name="lng"
                    id="lng"
                    type="number"
                    step="any"
                    min={map.bounds.west}
                    max={map.bounds.east}
                    placeholder="139.70"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sourceNote">이름·주소·좌표의 출처</Label>
                <Textarea
                  name="sourceNote"
                  id="sourceNote"
                  required
                  minLength={15}
                  maxLength={1000}
                  placeholder="직접 현장 조사한 날짜와 방식 또는 사용 허가를 받은 출처를 적어 주세요."
                />
              </div>
            </section>
          )}
          <section className="space-y-4 rounded-xl border bg-card p-6">
            <h2 className="text-sm font-semibold">
              {selection?.placeId ? "02" : "03"}. 왜 이 주제에 맞나요?
            </h2>
            <Label htmlFor="rationale">추천 근거</Label>
            <Textarea
              name="rationale"
              id="rationale"
              className="min-h-32"
              required
              minLength={15}
              maxLength={1000}
              placeholder="어떤 경험 때문에 Tokyo Fashion에 추천하나요? 구체적인 이유를 15자 이상 남겨 주세요."
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
