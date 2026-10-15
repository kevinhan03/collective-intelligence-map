"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  LoaderCircle,
  Info,
  ChevronRight,
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
import { normalizeProposalQuery, searchScope } from "@/domain/search-scope";
import {
  ProposalSearchCache,
  type ProposalSearchResult,
  type InternalProposalPlace as Internal,
} from "@/domain/proposal-search-cache";
import { countryOptions } from "@/domain/countries";
import { browserDb } from "@/lib/supabase/client";
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
  viewerId,
  autoApprove,
  config,
  creator = false,
}: {
  creator?: boolean;
  map: ThemeMap;
  enabled: boolean;
  viewerId?: string;
  autoApprove: boolean;
  config: RendererConfig;
}) {
  const router = useRouter();
  const [authChanged, setAuthChanged] = useState(false);
  const [manualCountry, setManualCountry] = useState("");
  const [translationAvailable, setTranslationAvailable] = useState(false);
  const [resultQuery, setResultQuery] = useState("");
  const searchCache = useRef(new ProposalSearchCache());

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [manualName, setManualName] = useState("");
  const stepHeading = useRef<HTMLHeadingElement>(null);
  const previousStep = useRef(step);
  useEffect(() => {
    if (previousStep.current !== step) stepHeading.current?.focus();
    previousStep.current = step;
  }, [step]);
  function selectPlace(place: Selection) {
    setSelection(place);
    setStep(2);
    setFieldErrors({});
    setError("");
  }
  const [query, setQuery] = useState("");
  const resultStale =
    authChanged || !enabled || resultQuery !== normalizeProposalQuery(query);
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
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSearch = useRef<
    | ((
        external?: boolean,
        translate?: boolean,
        keyword?: string,
        allowComposition?: boolean,
      ) => Promise<void>)
    | null
  >(null);
  function cancelDebounce() {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = null;
  }
  const activeSearch = useRef<{
    key: string;
    controller: AbortController;
  } | null>(null);
  const submitting = useRef(false);
  const requestId = useRef(0);
  const geocodeController = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      cancelDebounce();
      searchController.current?.abort();
      requestId.current++;
      geocodeController.current?.abort();
    },
    [],
  );
  useEffect(() => {
    const cache = searchCache.current;
    cache.clear();
    if (
      !viewerId ||
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    )
      return;
    const { data } = browserDb().auth.onAuthStateChange((_event, session) => {
      if (session?.user.id !== viewerId) {
        cancelDebounce();
        searchCache.current.clear();
        searchController.current?.abort();
        requestId.current++;
        setAuthChanged(true);
        setInternal([]);
        setCandidates([]);
        setSelection(null);
        setExistingPlace(null);
        setSearching(false);
        setBusy(false);
      }
    });
    return () => {
      data.subscription.unsubscribe();
      cache.clear();
    };
  }, [map.id, viewerId, enabled]);
  function resetProposal() {
    cancelDebounce();
    searchController.current?.abort();
    requestId.current++;
    setStep(1);
    setManualName("");
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
    setTranslationAvailable(false);
    setManualCountry("");
    searchCache.current.clear();
  }
  async function search(
    external = true,
    translate = false,
    keyword = query,
    allowComposition = false,
  ) {
    cancelDebounce();
    if (
      !enabled ||
      authChanged ||
      (composing && !allowComposition) ||
      keyword.trim().length < 2
    )
      return;
    const key = `${viewerId ?? "fixture"}:${map.id}:${external}:${translate}:${normalizeProposalQuery(keyword)}`;
    if (
      activeSearch.current?.key === key &&
      !activeSearch.current.controller.signal.aborted
    )
      return;
    searchController.current?.abort();
    const controller = new AbortController();
    searchController.current = controller;
    activeSearch.current = { key, controller };
    const id = ++requestId.current;
    setBusy(true);
    setSearching(true);
    setSearchError("");
    setSelection(null);
    setManual(false);
    setExistingPlace(null);
    setSearched(false);
    setShowRelated(false);
    try {
      const cached = searchCache.current.get(key);
      const result =
        cached ??
        (await post<ProposalSearchResult>(
          "/api/places/search",
          { mapId: map.id, query: keyword.trim(), external, translate },
          controller.signal,
        ));
      if (requestId.current !== id || controller.signal.aborted) return;
      if (!cached) searchCache.current.set(key, result);
      setResultQuery(normalizeProposalQuery(keyword));
      setTranslationAvailable(Boolean(result.translationAvailable));
      setInternal(result.internal);
      setCandidates(result.candidates);
      setSearched(true);
    } catch (e) {
      if (requestId.current === id && !controller.signal.aborted) {
        setSearchError((e as Error).message);
        setSearched(true);
      }
    } finally {
      if (activeSearch.current?.controller === controller)
        activeSearch.current = null;
      if (requestId.current === id) {
        setBusy(false);
        setSearching(false);
      }
    }
  }
  useEffect(() => {
    latestSearch.current = search;
  });
  async function choose(candidate: Candidate) {
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
          selectPlace({
            placeId: place.id,
            label: place.name,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
          });
        return;
      }
      selectPlace({
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
    if (searchScope(map) === "world" && !manualCountry) {
      setLocationError("장소가 있는 국가를 먼저 선택해 주세요.");
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
        {
          mapId: map.id,
          address: manualAddress.trim(),
          countryCode: searchScope(map) === "world" ? manualCountry : undefined,
        },
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
    <div className="proposal-form">
      <nav aria-label="장소 제안 진행 단계" className="proposal-progress">
        <ol>
          {["장소 선택", "추천 이유", "제출"].map((label, index) => (
            <li
              key={label}
              aria-current={step === index + 1 ? "step" : undefined}
              data-complete={step > index + 1}
            >
              <span className="proposal-step-number">
                {step > index + 1 ? (
                  <CheckCircle2 size={20} aria-hidden="true" />
                ) : (
                  index + 1
                )}
              </span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
      </nav>
      <div className="proposal-question">
        <h2 ref={stepHeading} tabIndex={-1}>
          {step === 1
            ? "어떤 장소를 추천하고 싶나요?"
            : step === 2
              ? "어떤 점을 추천하나요?"
              : "제안 내용을 확인해 주세요"}
        </h2>
        <p>
          {step === 1
            ? `${map.title} 지도에 추가할 장소를 검색해 주세요.`
            : step === 2
              ? "직접 경험한 장점이나 방문할 이유를 남겨주세요."
              : "장소와 추천 이유가 맞는지 확인하고 제출해 주세요."}
        </p>
      </div>
      {authChanged && (
        <p role="alert" className="text-sm text-muted-foreground">
          로그인 상태가 변경됐습니다. 페이지를 새로고침해 주세요.
        </p>
      )}
      {!enabled && (
        <p className="proposal-login-note rounded-lg border text-sm">
          로그인하면 누구나 장소를 제안할 수 있어요.{" "}
          <Link
            href={loginHref(`/maps/${map.slug}/submit`)}
            className="underline"
          >
            로그인하기
          </Link>
        </p>
      )}
      <section className="space-y-4" aria-label="장소 선택">
        <div hidden={step !== 1} className="space-y-4">
          <form
            className="proposal-search"
            aria-busy={searching}
            onSubmit={(e) => {
              e.preventDefault();
              if (composing) return;
              void search();
            }}
          >
            <Search
              className="proposal-search-icon"
              size={20}
              aria-hidden="true"
            />
            <Input
              aria-label="제안할 장소 검색"
              placeholder="장소 이름이나 주소 검색"
              value={query}
              maxLength={100}
              disabled={!enabled || authChanged || sending}
              onCompositionStart={() => {
                cancelDebounce();
                searchController.current?.abort();
                requestId.current++;
                setSearching(false);
                setBusy(false);
                setComposing(true);
              }}
              onCompositionEnd={(e) => {
                setComposing(false);
                setQuery(e.currentTarget.value);
                void search(true, false, e.currentTarget.value, true);
              }}
              onChange={(e) => {
                // Some IMEs emit a final change after compositionend. Keep its
                // already-started request when the input has not changed.
                if (e.target.value === query) return;
                cancelDebounce();
                searchController.current?.abort();
                requestId.current++;
                setBusy(false);
                setSearching(false);
                setQuery(e.target.value);
                if (e.target.value.trim().length < 2) {
                  setInternal([]);
                  setCandidates([]);
                }
                setSelection(null);
                setSearched(false);
                setShowRelated(false);
                setTranslationAvailable(false);
                setSearchError("");
                const inComposition =
                  composing || (e.nativeEvent as InputEvent).isComposing;
                // Korean IMEs may keep the last syllable composing until blur.
                // Search complete Hangul syllables without forcing IME commit;
                // skip standalone jamo and other languages' preedit text.
                const completeHangul =
                  /[가-힣]$/.test(e.target.value.trim()) &&
                  !/[\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]/.test(
                    e.target.value,
                  );
                if (!inComposition || completeHangul) {
                  const value = e.target.value;
                  debounceTimer.current = setTimeout(() => {
                    debounceTimer.current = null;
                    void latestSearch.current?.(
                      true,
                      false,
                      value,
                      completeHangul,
                    );
                  }, 400);
                }
              }}
            />
            <Button
              disabled={
                !enabled ||
                authChanged ||
                busy ||
                sending ||
                query.trim().length < 2
              }
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
          {searching && (
            <p role="status" className="text-xs text-muted-foreground">
              관련 장소를 찾고 있어요…
            </p>
          )}
          {!searching &&
            !resultStale &&
            (internal.length > 0 || candidates.length > 0) && (
              <p className="text-xs text-muted-foreground">
                관련 장소 · 이름과 주소를 확인하고 선택해 주세요.
              </p>
            )}
          {internal.map((p) => (
            <button
              key={p.id}
              disabled={busy || searching || composing || resultStale}
              className="block w-full rounded-lg border p-3 text-left hover:bg-secondary"
              onClick={() => {
                searchController.current?.abort();
                requestId.current++;
                setSearching(false);
                if (p.currentMapStatus) setExistingPlace(p);
                else
                  selectPlace({
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
                {creator && p.currentMapStatus
                  ? "이 지도에 추가됨"
                  : !p.currentMapStatus
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
              disabled={busy || searching || composing || resultStale}
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
          {searchScope(map) === "world" && (
            <p className="text-xs text-muted-foreground">
              현재 확보된 지역 데이터에서 검색합니다.
            </p>
          )}
          {!searching && !resultStale && translationAvailable && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void search(true, true)}
            >
              일본어 이름으로 찾아보기
            </Button>
          )}
          {searchError && (
            <p role="alert" className="text-sm text-destructive">
              {searchError}{" "}
              <button
                type="button"
                className="underline"
                onClick={() => void search()}
              >
                다시 검색
              </button>
            </p>
          )}
          {searched &&
            !searching &&
            !resultStale &&
            !searchError &&
            !internal.length &&
            !candidates.length && (
              <p className="text-sm text-muted-foreground">
                검색 결과가 없습니다. 아직 지원하지 않는 지역이거나 새 장소일 수
                있습니다.
              </p>
            )}
          <details
            className="proposal-manual-toggle"
            open={manual}
            onToggle={(event) => {
              const open = event.currentTarget.open;
              if (sending) {
                event.currentTarget.open = manual;
                return;
              }
              if (open === manual) return;
              searchController.current?.abort();
              geocodeController.current?.abort();
              setLocating(false);
              requestId.current++;
              setBusy(false);
              setSearching(false);
              setManual(open);
              setStep(1);
              if (open) {
                setManualName(query);
                setInternal([]);
                setCandidates([]);
                setTranslationAvailable(false);
                setSearched(false);
              }
              setError("");
              setLocationError("");
              setFieldErrors({});
              setSelection(null);
              if (!open) setManualLocation(null);
            }}
          >
            <summary className="cursor-pointer text-sm font-medium">
              <span>찾는 장소가 없나요? 직접 등록</span>
              <ChevronRight size={16} aria-hidden="true" />
            </summary>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              이름과 정확한 주소를 입력하면 위치를 찾아드려요.
            </p>
          </details>
        </div>
        {selection && step === 2 && (
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
              onClick={() => {
                setSelection(null);
                setStep(1);
                setError("");
              }}
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
            if (submitting.current || !enabled || authChanged) return;
            const form = e.currentTarget;
            const f = new FormData(form);
            const errors: Record<string, string> = {};
            if (step !== 1 && rationale.trim().length > 1000)
              errors.rationale = "소개는 1,000자 이내로 입력해 주세요.";
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
            if (
              manual &&
              searchScope(map) === "world" &&
              !/^[A-Z]{2}$/.test(manualCountry)
            )
              errors.countryCode = "장소가 있는 국가를 선택해 주세요.";
            setFieldErrors(errors);
            if (Object.keys(errors).length) {
              if (
                errors.name ||
                errors.address ||
                errors.location ||
                errors.countryCode
              )
                setStep(1);
              else setStep(2);
              return;
            }
            if (step !== 3) {
              setError("");
              setStep(step === 1 ? 2 : 3);
              return;
            }
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
              }>(
                creator
                  ? `/api/creator/maps/${map.id}/places`
                  : "/api/places/propose",
                {
                  mapId: map.id,
                  placeId: selection?.placeId,
                  candidateToken: selection?.token,
                  rationale: f.get("rationale"),
                  ...(manual
                    ? {
                        name: f.get("name"),
                        countryCode:
                          searchScope(map) === "world"
                            ? manualCountry
                            : undefined,
                        address: f.get("address"),
                        category: f.get("category"),
                        lat: manualLocation?.lat,
                        lng: manualLocation?.lng,
                        sourceNote:
                          "사용자가 직접 알고 있는 장소 이름과 위치를 등록했습니다.",
                      }
                    : {}),
                },
              );
              form.reset();
              resetProposal();
              router.replace(
                creator
                  ? `/studio?map=${map.id}`
                  : `/maps/${map.slug}?proposal=${encodeURIComponent(result.id)}&submitted=1&created=${result.created ? "1" : "0"}`,
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
            <section hidden={step !== 1} className="proposal-fields space-y-4">
              <h3 className="text-sm font-semibold">새 장소 정보</h3>
              <p className="text-xs text-muted-foreground">
                이름과 정확한 주소를 입력하면 위치를 찾습니다. 좌표를 직접
                입력할 필요는 없어요.
              </p>
              {searchScope(map) === "world" && (
                <div className="space-y-2">
                  <Label htmlFor="countryCode">국가</Label>
                  <select
                    id="countryCode"
                    name="countryCode"
                    value={manualCountry}
                    className="h-10 w-full rounded-md border bg-background px-3 text-sm"
                    aria-invalid={Boolean(fieldErrors.countryCode)}
                    onChange={(event) => {
                      setManualCountry(event.target.value);
                      setManualLocation(null);
                      geocodeController.current?.abort();
                    }}
                  >
                    <option value="">국가 선택</option>
                    {countryOptions.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.label}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.countryCode && (
                    <p role="alert" className="text-sm text-destructive">
                      {fieldErrors.countryCode}
                    </p>
                  )}
                </div>
              )}
              <Label htmlFor="name">장소 이름</Label>
              <Input
                id="name"
                name="name"
                required
                maxLength={120}
                value={manualName}
                onChange={(event) => setManualName(event.target.value)}
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
          <section hidden={step !== 2} className="proposal-fields space-y-4">
            <Label htmlFor="rationale">한줄 소개 (선택)</Label>
            <Textarea
              className="min-h-40 resize-y rounded-2xl p-4 text-sm leading-7"
              id="rationale"
              name="rationale"
              maxLength={1000}
              placeholder="어떤 점이 좋았나요? 짧게 남겨주시면 다른 사람에게 도움이 돼요."
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              aria-invalid={Boolean(fieldErrors.rationale)}
              aria-describedby="rationale-help rationale-error"
            />
            <p id="rationale-help" className="text-xs text-muted-foreground">
              비워두고 등록해도 괜찮아요. 나중에 소개를 추가할 수 있어요.{" "}
              {rationale.length.toLocaleString()} / 1,000자
            </p>
            <p
              id="rationale-error"
              role={fieldErrors.rationale ? "alert" : undefined}
              className="text-sm text-destructive"
            >
              {fieldErrors.rationale}
            </p>
          </section>
          {step === 3 && (
            <section className="proposal-review" aria-label="제출할 제안 내용">
              <p className="kicker">{map.title}</p>
              <h3>{selection?.label ?? manualName}</h3>
              <p className="text-sm text-muted-foreground">
                {selection?.address ?? manualAddress}
              </p>
              {rationale.trim() && (
                <div className="mt-6 border-t pt-5">
                  <p className="mb-2 text-xs text-muted-foreground">
                    한줄 소개
                  </p>
                  <p className="whitespace-pre-wrap break-words text-sm leading-7">
                    {rationale}
                  </p>
                </div>
              )}
            </section>
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="proposal-actions">
            <Button
              type="button"
              variant="ghost"
              disabled={sending}
              onClick={() => {
                if (step === 1) {
                  geocodeController.current?.abort();
                  setLocating(false);
                  setManual(false);
                }
                setStep(step === 3 ? 2 : 1);
                setError("");
              }}
            >
              <ArrowLeft size={15} />{" "}
              {step === 1 ? "검색으로 돌아가기" : "이전 단계"}
            </Button>
            <Button
              type="submit"
              disabled={!enabled || authChanged || busy || sending || locating}
            >
              {sending
                ? "보내는 중…"
                : step === 3
                  ? "장소 제안하기"
                  : step === 1
                    ? "이 장소로 계속"
                    : "제안 내용 확인"}
              {!sending && step !== 3 && <ChevronRight size={16} />}
            </Button>
          </div>
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
                {creator
                  ? "이미 이 지도에 추가한 장소입니다"
                  : ["rejected", "archived", "reviewed"].includes(
                        existingPlace?.currentMapStatus ?? "",
                      )
                    ? "이미 검토된 장소입니다"
                    : existingPlace?.currentMapStatus === "pending"
                      ? "이미 검토 대기 중인 장소입니다"
                      : "이미 공개된 장소입니다"}
              </DialogTitle>
              <DialogDescription className="max-w-sm leading-6">
                {creator
                  ? "관리 화면에서 추천 이유와 순서를 수정할 수 있어요."
                  : existingPlace?.currentMapStatus === "rejected" ||
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
                      creator
                        ? `/studio/${map.id}/preview`
                        : `/maps/${map.slug}?proposal=${encodeURIComponent(existingPlace.currentMapPlaceId)}`,
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
      <p className="proposal-policy">
        <Info size={15} aria-hidden="true" />
        {creator
          ? "초안의 장소는 지도 공개 후 표시되며, 공개 지도에 추가하면 즉시 표시됩니다."
          : autoApprove
            ? "운영자 제안은 제출 즉시 일반 목록에 공개됩니다."
            : "제안은 검토 대기 핀으로 표시되며, 승인 후 일반 목록에 공개됩니다."}
      </p>
      <Link
        href={`/maps/${map.slug}`}
        className="proposal-return flex items-center justify-center gap-2 text-xs text-muted-foreground"
      >
        <ArrowLeft size={13} />
        맵으로 돌아가기
      </Link>
    </div>
  );
}
