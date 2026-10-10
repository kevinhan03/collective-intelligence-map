"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  LoaderCircle,
  MapPin,
  Search,
  X,
} from "lucide-react";
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
import { loginHref } from "@/domain/login-return";
type Internal = {
  id: string;
  name: string;
  address: string;
  category: string;
  locality: string;
  lat: number;
  lng: number;
  currentMapPlaceId?: string | null;
  currentMapStatus?: string | null;
};
type Selection = {
  placeId?: string;
  token?: string;
  label: string;
  address?: string;
  lat?: number;
  lng?: number;
};
export function ProposalForm({
  map,
  enabled,
  autoApprove,
  config,
}: {
  map: ThemeMap;
  enabled: boolean;
  autoApprove: boolean;
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
  const [locationError, setLocationError] = useState("");
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [searching, setSearching] = useState(false);
  const [composing, setComposing] = useState(false);
  const [rationale, setRationale] = useState("");
  const [searchError, setSearchError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const searchController = useRef<AbortController | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitting = useRef(false);
  const requestId = useRef(0);
  const geocodeController = useRef<AbortController | null>(null);
  const autoSearch = useEffectEvent(() => search(false));
  useEffect(() => {
    if (!enabled || manual || selection || composing || query.trim().length < 2)
      return;
    searchTimer.current = setTimeout(() => void autoSearch(), 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [query, composing, manual, enabled, selection]);
  useEffect(
    () => () => {
      searchController.current?.abort();
      geocodeController.current?.abort();
    },
    [],
  );
  function resetProposal() {
    searchController.current?.abort();
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
    setLocationError("");
    setSearching(false);
    setRationale("");
    setFieldErrors({});
    setSearchError("");
  }
  async function search(external = true) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    const id = ++requestId.current;
    if (external) setBusy(true);
    setSearching(true);
    setSearchError("");
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
      }>(
        "/api/places/search",
        {
          mapId: map.id,
          query: query.trim(),
          external: false,
        },
        controller.signal,
      );
      if (requestId.current !== id || controller.signal.aborted) return;
      if (external && result.internal.length === 0)
        result = await post<typeof result>(
          "/api/places/search",
          {
            mapId: map.id,
            query: query.trim(),
            external: true,
          },
          controller.signal,
        );
      if (requestId.current !== id || controller.signal.aborted) return;
      setInternal(result.internal);
      setCandidates(result.candidates);
      setSearched(true);
    } catch (e) {
      if (requestId.current === id && !controller.signal.aborted) {
        setSearchError((e as Error).message);
        setSearched(true);
      }
    } finally {
      if (requestId.current === id) {
        setBusy(false);
        setSearching(false);
      }
    }
  }
  async function choose(candidate: Candidate) {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    const id = ++requestId.current;
    setBusy(true);
    setError("");
    setManual(false);
    try {
      const result = await post<{
        placeId: string | null;
        currentMapPlaceId: string | null;
        currentMapStatus: string | null;
        candidate: Candidate;
      }>(
        "/api/places/details",
        { mapId: map.id, token: candidate.token },
        controller.signal,
      );
      if (requestId.current !== id || controller.signal.aborted) return;
      if (result.placeId) {
        const place = {
          id: result.placeId,
          name: result.candidate.label,
          address: result.candidate.address ?? "",
          category: result.candidate.category ?? "",
          locality: result.candidate.locality ?? map.city,
          lat: result.candidate.lat ?? 0,
          lng: result.candidate.lng ?? 0,
          currentMapPlaceId: result.currentMapPlaceId,
          currentMapStatus: result.currentMapStatus,
        };
        if (result.currentMapStatus) setExistingPlace(place);
        else
          setSelection({
            placeId: place.id,
            label: place.name,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
          });
        return;
      }
      setSelection({
        placeId: undefined,
        token: result.candidate.token,
        label: result.candidate.label,
        address: result.candidate.address,
        lat: result.candidate.lat,
        lng: result.candidate.lng,
      });
    } catch (e) {
      if (requestId.current === id && !controller.signal.aborted)
        setSearchError((e as Error).message);
    } finally {
      if (requestId.current === id) setBusy(false);
    }
  }
  async function locateAddress() {
    if (manualAddress.trim().length < 5) {
      setLocationError("주소를 더 자세히 입력해 주세요.");
      return;
    }
    setLocating(true);
    setLocationError("");
    geocodeController.current?.abort();
    const controller = new AbortController();
    geocodeController.current = controller;
    try {
      const location = await post<{ lat: number; lng: number; label: string }>(
        "/api/places/geocode",
        { mapId: map.id, address: manualAddress.trim() },
        controller.signal,
      );
      if (controller.signal.aborted) return;
      setManualLocation(location);
    } catch (error) {
      if (controller.signal.aborted) return;
      setManualLocation(null);
      setLocationError((error as Error).message);
    } finally {
      if (!controller.signal.aborted) setLocating(false);
    }
  }
  return (
    <div className="proposal-form space-y-7">
      {!enabled && (
        <p className="rounded-lg border p-4 text-sm">
          로그인하면 누구나 장소를 제안할 수 있어요.{" "}
          <Link
            href={loginHref(`/maps/${map.slug}/submit`)}
            className="underline"
          >
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
          aria-busy={searching}
          onSubmit={(e) => {
            e.preventDefault();
            if (composing) return;
            void search();
          }}
        >
          <Input
            aria-label="제안할 장소 검색"
            placeholder="장소 이름을 입력하세요"
            value={query}
            maxLength={100}
            disabled={!enabled || sending}
            onCompositionStart={() => {
              searchController.current?.abort();
              requestId.current++;
              setComposing(true);
            }}
            onCompositionEnd={() => setComposing(false)}
            onChange={(e) => {
              searchController.current?.abort();
              requestId.current++;
              setBusy(false);
              setSearching(false);
              setQuery(e.target.value);
              setSelection(null);
              setSearched(false);
              setShowRelated(false);
              setInternal([]);
              setCandidates([]);
              setSearchError("");
            }}
          />
          <Button
            disabled={!enabled || busy || sending || query.trim().length === 0}
          >
            {searching ? (
              <LoaderCircle
                size={15}
                className="animate-spin"
                aria-hidden="true"
              />
            ) : (
              <Search size={15} aria-hidden="true" />
            )}
            {searching ? "검색 중…" : "검색"}
          </Button>
        </form>
        {internal.map((p) => (
          <button
            key={p.id}
            disabled={busy}
            className="block w-full rounded-lg border p-3 text-left hover:bg-secondary"
            onClick={() => {
              if (searchTimer.current) clearTimeout(searchTimer.current);
              searchController.current?.abort();
              requestId.current++;
              setSearching(false);
              if (p.currentMapStatus) setExistingPlace(p);
              else
                setSelection({
                  placeId: p.id,
                  label: p.name,
                  address: p.address,
                  lat: p.lat,
                  lng: p.lng,
                });
            }}
          >
            <span className="text-sm font-medium">{p.name}</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              {p.locality} · {p.category} · {p.address} · 커뮤니티 장소
            </span>
            <span className="mt-1 block text-xs text-primary">
              {!p.currentMapStatus
                ? "이 지도에 추천 가능"
                : p.currentMapStatus === "pending"
                  ? "검토 대기"
                  : ["rejected", "archived", "reviewed"].includes(
                        p.currentMapStatus,
                      )
                    ? "이미 검토됨"
                    : "이 지도에 공개됨"}
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
        {searchError && (
          <p role="alert" className="text-sm text-destructive">
            {searchError}
          </p>
        )}
        {searched && !searchError && !internal.length && !candidates.length && (
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
            if (sending) {
              event.currentTarget.open = manual;
              return;
            }
            if (open === manual) return;
            if (searchTimer.current) clearTimeout(searchTimer.current);
            searchController.current?.abort();
            geocodeController.current?.abort();
            setLocating(false);
            requestId.current++;
            setBusy(false);
            setSearching(false);
            setManual(open);
            setError("");
            setLocationError("");
            setFieldErrors({});
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
              <span className="mt-1 block text-xs text-muted-foreground">
                {selection.address}
              </span>
            </p>
            <Button
              type="button"
              variant="ghost"
              disabled={sending}
              onClick={() => setSelection(null)}
            >
              다른 장소 선택
            </Button>
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
          noValidate
          onSubmit={async (e) => {
            e.preventDefault();
            if (submitting.current) return;
            const form = e.currentTarget;
            const f = new FormData(form);
            const errors: Record<string, string> = {};
            if (rationale.trim().length < 5 || rationale.trim().length > 1000)
              errors.rationale = "추천 이유를 5~1,000자로 입력해 주세요.";
            if (manual && !String(f.get("name") ?? "").trim())
              errors.name = "장소 이름을 입력해 주세요.";
            if (manual && String(f.get("name") ?? "").trim().length > 120)
              errors.name = "장소 이름은 120자 이내로 입력해 주세요.";
            if (manual && !manualAddress.trim())
              errors.address = "정확한 주소를 입력해 주세요.";
            if (manual && manualAddress.trim().length > 250)
              errors.address = "주소는 250자 이내로 입력해 주세요.";
            if (manual && !manualLocation)
              errors.location = "주소에서 위치를 찾고 지도에서 확인해 주세요.";
            setFieldErrors(errors);
            if (Object.keys(errors).length) return;
            submitting.current = true;
            setSending(true);
            setBusy(true);
            setError("");
            try {
              const result = await post<{
                id: string;
                placeId: string;
                status: string;
                created: boolean;
              }>("/api/places/propose", {
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
              router.replace(
                `/maps/${map.slug}?proposal=${encodeURIComponent(result.id)}&submitted=1&created=${result.created ? "1" : "0"}`,
              );
              router.refresh();
            } catch (e) {
              setError((e as Error).message);
            } finally {
              submitting.current = false;
              setSending(false);
              setBusy(false);
            }
          }}
        >
          {manual && (
            <section className="space-y-4 rounded-xl border bg-card p-6">
              <h2 className="text-sm font-semibold">새 장소 정보</h2>
              <p className="text-xs text-muted-foreground">
                이름과 정확한 주소를 입력하면 위치를 찾습니다. 좌표를 직접
                입력할 필요는 없어요.
              </p>
              <Label htmlFor="name">장소 이름</Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={120}
                defaultValue={query}
                aria-invalid={Boolean(fieldErrors.name)}
                aria-describedby={fieldErrors.name ? "name-error" : undefined}
              />
              {fieldErrors.name && (
                <p
                  id="name-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {fieldErrors.name}
                </p>
              )}
              <Label htmlFor="address">주소</Label>
              <Input
                id="address"
                name="address"
                required
                maxLength={250}
                placeholder={
                  map.country === "KR"
                    ? "예: 서울 용산구 신흥로 20길 38"
                    : "예: 東京都港区南青山6-1-3"
                }
                className="min-h-11"
                value={manualAddress}
                aria-invalid={Boolean(fieldErrors.address)}
                aria-describedby={
                  fieldErrors.address ? "address-error" : undefined
                }
                onChange={(event) => {
                  geocodeController.current?.abort();
                  setLocating(false);
                  setLocationError("");
                  setManualAddress(event.target.value);
                  setManualLocation(null);
                }}
              />
              {fieldErrors.address && (
                <p
                  id="address-error"
                  role="alert"
                  className="text-sm text-destructive"
                >
                  {fieldErrors.address}
                </p>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={locating || manualAddress.trim().length < 5}
                onClick={() => void locateAddress()}
              >
                <Search size={14} />
                {locating ? "위치 찾는 중…" : "주소에서 위치 찾기"}
              </Button>
              {fieldErrors.location && (
                <p role="alert" className="text-sm text-destructive">
                  {fieldErrors.location}
                </p>
              )}
              {locationError && (
                <p role="alert" className="text-sm text-destructive">
                  {locationError}
                </p>
              )}
              {manualLocation && (
                <div className="overflow-hidden rounded-lg border">
                  <p className="bg-secondary p-3 text-sm">
                    위치를 찾았습니다. 핀이 맞는지 확인하고, 다르면 지도에서
                    원하는 위치를 눌러 조정하세요.
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
                        setManualLocation({
                          lat,
                          lng,
                          label: "지도에서 조정한 위치",
                        })
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
              placeholder={
                map.country === "KR"
                  ? "예: 빈티지 의류를 천천히 살펴보기 좋아요"
                  : "예: 90년대 일본 빈티지를 찾기 좋아요"
              }
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              aria-invalid={Boolean(fieldErrors.rationale)}
              aria-describedby="rationale-help rationale-error"
            />
            <p id="rationale-help" className="text-xs text-muted-foreground">
              5~1,000자 · {rationale.length.toLocaleString()} / 1,000자
            </p>
            <p
              id="rationale-error"
              role={fieldErrors.rationale ? "alert" : undefined}
              className="text-sm text-destructive"
            >
              {fieldErrors.rationale}
            </p>
            <p className="text-xs text-muted-foreground">
              {autoApprove
                ? "운영자 제안은 제출 즉시 일반 목록에 공개됩니다."
                : "제안은 검토 대기 핀으로 표시되며, 승인 후 일반 목록에 공개됩니다."}
            </p>
          </section>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button disabled={!enabled || busy || sending} className="w-full">
            {sending ? "보내는 중…" : "장소 제안하기"}
          </Button>
        </form>
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
                {["rejected", "archived", "reviewed"].includes(
                  existingPlace?.currentMapStatus ?? "",
                )
                  ? "이미 검토된 장소입니다"
                  : existingPlace?.currentMapStatus === "pending"
                    ? "이미 검토 대기 중인 장소입니다"
                    : "이미 공개된 장소입니다"}
              </DialogTitle>
              <DialogDescription className="max-w-sm leading-6">
                {existingPlace?.currentMapStatus === "rejected" ||
                existingPlace?.currentMapStatus === "archived" ||
                existingPlace?.currentMapStatus === "reviewed"
                  ? "이 지도에서 이미 검토된 장소입니다. 다른 장소를 선택해 주세요."
                  : existingPlace?.currentMapStatus === "pending"
                    ? "이미 접수된 제안입니다. 지도에서 위치와 추천 근거를 확인해 보세요."
                    : "이 지도에 이미 공개된 장소입니다. 지도에서 위치와 추천 근거를 확인해 보세요."}
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
              {existingPlace?.currentMapPlaceId && (
                <Button
                  type="button"
                  onClick={() => {
                    if (!existingPlace?.currentMapPlaceId) return;
                    router.push(
                      `/maps/${map.slug}?proposal=${encodeURIComponent(existingPlace.currentMapPlaceId)}`,
                    );
                    setExistingPlace(null);
                  }}
                >
                  지도에서 보기
                  <ArrowUpRight size={15} />
                </Button>
              )}
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
