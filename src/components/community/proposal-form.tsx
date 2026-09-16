"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, CheckCircle2, MapPin, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MapCanvas } from "@/components/map/map-canvas";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Candidate, RendererConfig, ThemeMap } from "@/domain/types";
import { post } from "./api";
import { placeCategoryLabel } from "@/domain/place-category";
type Internal = {
  id: string;
  name: string;
  address: string;
  category: string;
  locality: string;
  lat: number;
  lng: number;
};
type Selection = {
  placeId?: string;
  token?: string;
  label: string;
  lat?: number;
  lng?: number;
};
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
  const [query, setQuery] = useState("");
  const [internal, setInternal] = useState<Internal[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [existingPlace, setExistingPlace] = useState<Internal | null>(null);
  const [manual, setManual] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showRelated, setShowRelated] = useState(false);
  const [manualAddress, setManualAddress] = useState("");
  const [manualLocation, setManualLocation] = useState<{
    lat: number;
    lng: number;
    label: string;
  } | null>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestId = useRef(0);
  function resetProposal() {
    requestId.current++;
    setQuery("");
    setInternal([]);
    setCandidates([]);
    setSelection(null);
    setExistingPlace(null);
    setManual(false);
    setSearched(false);
    setShowRelated(false);
    setManualAddress("");
    setManualLocation(null);
    setError("");
  }
  async function search() {
    const id = ++requestId.current;
    setBusy(true);
    setError("");
    setSelection(null);
    setManual(false);
    setCandidates([]);
    setInternal([]);
    setExistingPlace(null);
    setSearched(false);
    setShowRelated(false);
    try {
      // Server enforces internal-first, including the second request (race-safe).
      let result = await post<{
        internal: Internal[];
        candidates: Candidate[];
      }>("/api/places/search", {
        mapId: map.id,
        query: query.trim(),
        external: false,
      });
      if (requestId.current !== id) return;
      if (result.internal.length === 0)
        result = await post<typeof result>("/api/places/search", {
          mapId: map.id,
          query: query.trim(),
          external: true,
        });
      if (requestId.current !== id) return;
      setInternal(result.internal);
      setCandidates(result.candidates);
      setSearched(true);
    } catch (e) {
      if (requestId.current === id) {
        setError((e as Error).message);
        setSearched(true);
      }
    } finally {
      if (requestId.current === id) setBusy(false);
    }
  }
  async function choose(candidate: Candidate) {
    const id = ++requestId.current;
    setBusy(true);
    setError("");
    setManual(false);
    try {
      const result = await post<{
        placeId: string | null;
        candidate: Candidate;
      }>("/api/places/details", { mapId: map.id, token: candidate.token });
      if (requestId.current !== id) return;
      setSelection({
        placeId: result.placeId ?? undefined,
        token: result.placeId ? undefined : result.candidate.token,
        label: result.candidate.label,
        lat: result.candidate.lat,
        lng: result.candidate.lng,
      });
    } catch (e) {
      if (requestId.current === id) setError((e as Error).message);
    } finally {
      if (requestId.current === id) setBusy(false);
    }
  }
  async function locateAddress() {
    if (manualAddress.trim().length < 5) {
      setError("주소를 더 자세히 입력해 주세요.");
      return;
    }
    setLocating(true);
    setError("");
    try {
      const location = await post<{ lat: number; lng: number; label: string }>(
        "/api/places/geocode",
        { mapId: map.id, address: manualAddress.trim() },
      );
      setManualLocation(location);
    } catch (error) {
      setManualLocation(null);
      setError((error as Error).message);
    } finally {
      setLocating(false);
    }
  }
  return (
    <div className="space-y-7">
      {!enabled && (
        <p className="rounded-lg border p-4 text-sm">
          로그인하면 누구나 장소를 제안할 수 있어요.{" "}
          <Link href="/login" className="underline">
            로그인하기
          </Link>
        </p>
      )}
      <section className="rounded-xl border bg-card p-6 space-y-4">
        <h2 className="text-sm font-semibold">01. 어떤 장소인가요?</h2>
        <p className="text-xs text-muted-foreground">
          {map.city} 범위에서 커뮤니티 장소를 먼저 찾습니다.
        </p>
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
              setBusy(false);
              setQuery(e.target.value);
              setSelection(null);
              setSearched(false);
              setShowRelated(false);
              setInternal([]);
              setCandidates([]);
              setError("");
            }}
          />
          <Button disabled={!enabled || busy || query.trim().length < 3}>
            <Search size={15} />
            {busy ? "검색 중…" : "검색"}
          </Button>
        </form>
        {internal.map((p) => (
          <button
            key={p.id}
            disabled={busy}
            className="block w-full rounded-lg border p-3 text-left hover:bg-secondary"
            onClick={() => {
              setExistingPlace(p);
            }}
          >
            <span className="text-sm font-medium">{p.name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {p.locality} · {p.category} · {p.address} · 커뮤니티 장소
            </span>
          </button>
        ))}
        {candidates.length > 0 && (
          <p className="text-xs text-muted-foreground">
            검색 결과 제공: {candidates[0].attribution}
          </p>
        )}
        {candidates.slice(0, showRelated ? 10 : 5).map((c, index) => (
          <button
            key={`${c.provider}:${c.externalId}`}
            disabled={busy}
            className="block w-full rounded-lg border p-3 text-left hover:bg-secondary"
            onClick={() => void choose(c)}
          >
            <span className="flex items-center gap-2 text-sm font-medium">
              {c.label}
              {index === 0 && c.matchType === "exact" && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  검색어와 일치
                </span>
              )}
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {c.locality ?? map.city} · {placeCategoryLabel(c.category)}
              {c.address ? ` · ${c.address}` : ""}
            </span>
          </button>
        ))}
        {candidates.length > 5 && !showRelated && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setShowRelated(true)}
          >
            관련 결과 {candidates.length - 5}개 더 보기
          </Button>
        )}
        {searched && !error && !internal.length && !candidates.length && (
          <p className="text-sm text-muted-foreground">
            검색 결과가 없습니다. 아직 지원하지 않는 지역이거나 새 장소일 수
            있습니다.
          </p>
        )}
        <details
          className="rounded-lg border bg-secondary/20 px-4 py-3"
          open={manual}
          onToggle={(event) => {
            const open = event.currentTarget.open;
            setManual(open);
            setSelection(null);
            if (!open) setManualLocation(null);
          }}
        >
          <summary className="cursor-pointer text-sm font-medium">
            찾는 장소가 없나요? 직접 등록
          </summary>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            이름과 정확한 주소를 입력하면 위치를 찾아드려요.
          </p>
        </details>
        {selection && (
          <div className="overflow-hidden rounded-lg border">
            <p className="bg-secondary p-3 text-sm">
              선택한 장소: {selection.label}
            </p>
            {selection.lat !== undefined && selection.lng !== undefined && (
              <div className="h-[300px]">
                <MapCanvas
                  config={config}
                  compact
                  places={[
                    {
                      id: "selected",
                      place_id: "selected",
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
                  selected="selected"
                  onSelect={() => {}}
                  bounds={{
                    south: selection.lat - 0.006,
                    north: selection.lat + 0.006,
                    west: selection.lng - 0.008,
                    east: selection.lng + 0.008,
                  }}
                  onBoundsChange={() => {}}
                />
              </div>
            )}
          </div>
        )}
      </section>
      {(selection || manual) && (
        <form
          className="space-y-6"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            setBusy(true);
            setError("");
            const f = new FormData(form);
            try {
              await post("/api/places/propose", {
                mapId: map.id,
                placeId: selection?.placeId,
                candidateToken: selection?.token,
                rationale: f.get("rationale"),
                ...(manual
                  ? {
                      name: f.get("name"),
                      address: f.get("address"),
                      category: f.get("category"),
                      lat: manualLocation?.lat,
                      lng: manualLocation?.lng,
                      sourceNote:
                        "사용자가 직접 알고 있는 장소 이름과 위치를 등록했습니다.",
                    }
                  : {}),
              });
              form.reset();
              resetProposal();
              router.replace(`/maps/${map.slug}?submitted=1`);
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {manual && (
            <section className="space-y-4 rounded-xl border bg-card p-6">
              <h2 className="text-sm font-semibold">새 장소 정보</h2>
              <p className="text-xs text-muted-foreground">
                이름과 정확한 주소를 입력하면 위치를 찾습니다. 좌표를 직접 입력할 필요는 없어요.
              </p>
              <Label htmlFor="name">장소 이름</Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={120}
                defaultValue={query}
              />
              <Label htmlFor="address">주소</Label>
              <Input
                id="address"
                name="address"
                required
                maxLength={250}
                placeholder="예: 東京都港区南青山6-1-3"
                value={manualAddress}
                onChange={(event) => {
                  setManualAddress(event.target.value);
                  setManualLocation(null);
                }}
              />
              <Button
                type="button"
                variant="outline"
                disabled={locating || manualAddress.trim().length < 5}
                onClick={() => void locateAddress()}
              >
                <Search size={14} />
                {locating ? "위치 찾는 중…" : "주소에서 위치 찾기"}
              </Button>
              {manualLocation && (
                <div className="overflow-hidden rounded-lg border">
                  <p className="bg-secondary p-3 text-sm">
                    위치를 찾았습니다. 핀이 맞는지 확인하고, 다르면 지도에서 원하는 위치를 눌러 조정하세요.
                  </p>
                  <div className="h-[300px]">
                    <MapCanvas
                      config={config}
                      compact
                      places={[
                        {
                          id: "manual-location",
                          place_id: "manual-location",
                          map_id: map.id,
                          name: "등록할 장소",
                          address: manualAddress,
                          category: "",
                          lat: manualLocation.lat,
                          lng: manualLocation.lng,
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
                      selected="manual-location"
                      onSelect={() => {}}
                      onMapClick={({ lat, lng }) =>
                        setManualLocation({ lat, lng, label: "지도에서 조정한 위치" })
                      }
                      bounds={{
                        south: manualLocation.lat - 0.006,
                        north: manualLocation.lat + 0.006,
                        west: manualLocation.lng - 0.008,
                        east: manualLocation.lng + 0.008,
                      }}
                      onBoundsChange={() => {}}
                    />
                  </div>
                </div>
              )}
              <Label htmlFor="category">분류 (선택)</Label>
              <Input
                id="category"
                name="category"
                maxLength={40}
                placeholder="예: 빈티지 숍"
              />
            </section>
          )}
          <section className="space-y-4 rounded-xl border bg-card p-6">
            <h2 className="text-sm font-semibold">02. 어떤 점을 추천하나요?</h2>
            <Label htmlFor="rationale">추천하는 점 한 줄</Label>
            <Textarea
              id="rationale"
              name="rationale"
              required
              minLength={5}
              maxLength={1000}
              placeholder="예: 90년대 일본 빈티지를 찾기 좋아요"
            />
            <p className="text-xs text-muted-foreground">
              제안은 검토 대기 핀으로 표시되며, 승인 후 일반 목록에 공개됩니다.
            </p>
          </section>
          <Button
            disabled={!enabled || busy || (manual && !manualLocation)}
            className="w-full"
          >
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
      <Dialog
        open={Boolean(existingPlace)}
        onOpenChange={(open) => {
          if (!open) setExistingPlace(null);
        }}
      >
        <DialogContent
          className="max-w-md gap-0 overflow-hidden p-0 sm:max-w-md"
          showCloseButton={false}
        >
          <div className="relative bg-primary/10 px-6 pt-7 pb-6">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute top-3 right-3 rounded-full"
              onClick={() => setExistingPlace(null)}
              aria-label="닫기"
            >
              <X size={16} />
            </Button>
            <div className="mb-4 grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <CheckCircle2 size={22} />
            </div>
            <p className="text-xs font-semibold tracking-[0.14em] text-primary uppercase">
              Community place
            </p>
            <DialogHeader className="mt-2 gap-2">
              <DialogTitle className="text-2xl leading-tight font-semibold tracking-tight">
                이미 등록된 장소입니다
              </DialogTitle>
              <DialogDescription className="max-w-sm leading-6">
                같은 장소를 다시 제안할 필요가 없어요. 지도에서 위치와
                커뮤니티의 추천 근거를 확인해 보세요.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-5 px-6 py-6">
            <div className="rounded-xl border bg-secondary/40 p-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MapPin size={14} />
                등록된 장소
              </p>
              <p className="text-base font-semibold">{existingPlace?.name}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {existingPlace?.locality} · {existingPlace?.category}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setExistingPlace(null)}
              >
                계속 검색
              </Button>
            <Button
              type="button"
              onClick={() => {
                if (!existingPlace) return;
                router.push(
                  `/maps/${map.slug}?place=${encodeURIComponent(existingPlace.id)}`,
                );
                setExistingPlace(null);
              }}
            >
              지도에서 보기
              <ArrowUpRight size={15} />
            </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
