"use client";
import Link from "@/i18n/link";
import { useRouter } from "@/i18n/navigation";
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
  externalSearchLimitMessage,
  type ExternalSearchLimit,
  type ProposalSearchResult,
  type InternalProposalPlace as Internal,
} from "@/domain/proposal-search-cache";
import { countryOptions } from "@/domain/countries";
import { browserDb } from "@/lib/supabase/client";
import { useI18n } from "@/i18n/client";
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
  const { t } = useI18n();
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
  const [externalLimit, setExternalLimit] =
    useState<ExternalSearchLimit | null>(null);
  const manualToggle = useRef<HTMLDetailsElement>(null);
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
    setExternalLimit(null);
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
    setExternalLimit(null);
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
      // A limited result is retried once the window reopens, so it is not cached.
      if (!cached && !result.externalLimit)
        searchCache.current.set(key, result);
      setResultQuery(normalizeProposalQuery(keyword));
      setTranslationAvailable(Boolean(result.translationAvailable));
      setExternalLimit(result.externalLimit ?? null);
      setInternal(result.internal);
      setCandidates(result.candidates);
      setSearched(true);
    } catch (e) {
      if (requestId.current === id && !controller.signal.aborted) {
        setSearchError(t.message((e as Error).message));
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
        setSearchError(t.message((e as Error).message));
    } finally {
      if (requestId.current === id) setBusy(false);
    }
  }
  async function locateAddress() {
    if (manualAddress.trim().length < 5) {
      setLocationError(t("propose.pleaseEnterAMoreDetailed"));
      return;
    }
    if (searchScope(map) === "world" && !manualCountry) {
      setLocationError(t("propose.pleaseChooseThePlaceS"));
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
      setLocationError(t.message((error as Error).message));
    } finally {
      if (!controller.signal.aborted) setLocating(false);
    }
  }
  return (
    <div className="proposal-form">
      <nav
        aria-label={t("propose.suggestionSteps")}
        className="proposal-progress"
      >
        <ol>
          {[
            t("propose.choosePlace"),
            t("propose.whyYouRecommendIt"),
            t("propose.submit"),
          ].map((label, index) => (
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
            ? t("propose.whichPlaceWouldYouLike")
            : step === 2
              ? t("propose.whatDoYouRecommendAbout")
              : t("propose.reviewYourSuggestion")}
        </h2>
        <p>
          {step === 1
            ? t("propose.searchForAPlaceTo", { title: map.title })
            : step === 2
              ? t("propose.shareWhatYouLikedOr")
              : t("propose.checkThatThePlaceAnd")}
        </p>
      </div>
      {authChanged && (
        <p role="alert" className="text-sm text-muted-foreground">
          {t("propose.yourSignInStatusChanged")}
        </p>
      )}
      {!enabled && (
        <p className="proposal-login-note rounded-lg border text-sm">
          {t("propose.anyoneWhoSignsInCan")}{" "}
          <Link
            href={loginHref(`/maps/${map.slug}/submit`)}
            className="underline"
          >
            {t("propose.signIn")}
          </Link>
        </p>
      )}
      <section className="space-y-4" aria-label={t("propose.choosePlace")}>
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
              aria-label={t("propose.searchForAPlaceTo2")}
              placeholder={t("propose.searchByPlaceNameOr")}
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
                setExternalLimit(null);
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
              {searching ? t("propose.searching") : t("propose.search")}
            </Button>
          </form>
          {searching && (
            <p role="status" className="text-xs text-muted-foreground">
              {t("propose.lookingForMatchingPlaces")}
            </p>
          )}
          {!searching &&
            !resultStale &&
            (internal.length > 0 || candidates.length > 0) && (
              <p className="text-xs text-muted-foreground">
                {t("propose.matchingPlacesCheckTheName")}
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
                {t("propose.communityPlaceMeta", {
                  locality: p.locality,
                  category: p.category,
                  address: p.address,
                })}
              </span>
              <span className="mt-1 block text-xs text-primary">
                {creator && p.currentMapStatus
                  ? t("propose.alreadyOnThisMap")
                  : !p.currentMapStatus
                    ? t("propose.canBeAddedToThis")
                    : p.currentMapStatus === "pending"
                      ? t("propose.pendingReview")
                      : ["rejected", "archived", "reviewed"].includes(
                            p.currentMapStatus,
                          )
                        ? t("propose.alreadyReviewed")
                        : t("propose.liveOnThisMap")}
              </span>
            </button>
          ))}
          {candidates.length > 0 && (
            <p className="text-xs text-muted-foreground">
              {t("propose.resultsBy", {
                attribution: candidates[0].attribution,
              })}
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
                    {t("propose.matchesYourSearch")}
                  </span>
                )}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {c.locality ?? map.city} ·{" "}
                {t.data("placeCategory", placeCategoryLabel(c.category))}
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
              {t("propose.showMoreResults", { count: candidates.length - 5 })}
            </Button>
          )}
          {searchScope(map) === "world" && (
            <p className="text-xs text-muted-foreground">
              {t("propose.searchingTheAreaDataWe")}
            </p>
          )}
          {!searching && !resultStale && translationAvailable && (
            <Button
              type="button"
              variant="outline"
              onClick={() => void search(true, true)}
            >
              {t("propose.searchByJapaneseName")}
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
                {t("propose.searchAgain")}
              </button>
            </p>
          )}
          {searched &&
            !searching &&
            !resultStale &&
            !searchError &&
            !externalLimit &&
            !internal.length &&
            !candidates.length && (
              <p className="text-sm text-muted-foreground">
                {t("propose.noResultsThisAreaMay")}
              </p>
            )}
          {externalLimit && !searching && !resultStale && (
            <div
              role="status"
              className="rounded-xl border px-4 py-3 text-sm text-muted-foreground"
            >
              {t.message(externalSearchLimitMessage(externalLimit))}{" "}
              <button
                type="button"
                className="inline min-h-0 p-0 font-medium text-foreground underline"
                onClick={() => {
                  const toggle = manualToggle.current;
                  if (!toggle) return;
                  toggle.open = true;
                  toggle.scrollIntoView({ block: "nearest" });
                }}
              >
                {t("propose.addItManually")}
              </button>
            </div>
          )}
          <details
            ref={manualToggle}
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
                setExternalLimit(null);
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
              <span>{t("propose.canTFindItAdd")}</span>
              <ChevronRight size={16} aria-hidden="true" />
            </summary>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {t("propose.enterTheNameAndExact")}
            </p>
          </details>
        </div>
        {selection && step === 2 && (
          <div className="overflow-hidden rounded-lg border">
            <p className="bg-secondary p-3 text-sm">
              {t("propose.selectedPlace")} {selection.label}
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
              {t("propose.chooseADifferentPlace")}
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
              errors.rationale = t("propose.pleaseKeepYourNoteUnder");
            if (manual && !String(f.get("name") ?? "").trim())
              errors.name = t("propose.pleaseEnterThePlaceName");
            if (manual && String(f.get("name") ?? "").trim().length > 120)
              errors.name = t("propose.pleaseKeepThePlaceName");
            if (manual && !manualAddress.trim())
              errors.address = t("propose.pleaseEnterTheExactAddress");
            if (manual && manualAddress.trim().length > 250)
              errors.address = t("propose.pleaseKeepTheAddressUnder");
            if (manual && !manualLocation)
              errors.location = t("propose.findTheLocationFromThe");
            if (
              manual &&
              searchScope(map) === "world" &&
              !/^[A-Z]{2}$/.test(manualCountry)
            )
              errors.countryCode = t("propose.pleaseChooseTheCountryThe");
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
                        sourceNote: t("propose.aUserAddedThisPlace"),
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
              setError(t.message((e as Error).message));
            } finally {
              submitting.current = false;
              setSending(false);
              setBusy(false);
            }
          }}
        >
          {manual && (
            <section hidden={step !== 1} className="proposal-fields space-y-4">
              <h3 className="text-sm font-semibold">
                {t("propose.newPlaceDetails")}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t("propose.enterTheNameAndExact2")}
              </p>
              {searchScope(map) === "world" && (
                <div className="space-y-2">
                  <Label htmlFor="countryCode">{t("propose.country")}</Label>
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
                    <option value="">{t("propose.chooseCountry")}</option>
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
              <Label htmlFor="name">{t("propose.placeName")}</Label>
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
              <Label htmlFor="address">{t("propose.address")}</Label>
              <Input
                id="address"
                name="address"
                required
                maxLength={250}
                placeholder={
                  map.country === "KR"
                    ? t("propose.eG38SinheungRo")
                    : t("propose.eG613")
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
                {locating
                  ? t("propose.findingLocation")
                  : t("propose.findLocationFromAddress")}
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
                    {t("propose.locationFoundCheckThePin")}
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
                          name: t("propose.placeToAdd"),
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
                          label: t("propose.locationAdjustedOnMap"),
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
              <Label htmlFor="category">{t("propose.categoryOptional")}</Label>
              <Input
                id="category"
                name="category"
                maxLength={40}
                placeholder={t("propose.eGVintageShop")}
              />
            </section>
          )}
          <section hidden={step !== 2} className="proposal-fields space-y-4">
            <Label htmlFor="rationale">{t("propose.shortNoteOptional")}</Label>
            <Textarea
              className="min-h-40 resize-y rounded-2xl p-4 text-sm leading-7"
              id="rationale"
              name="rationale"
              maxLength={1000}
              placeholder={t("propose.whatDidYouLikeA")}
              value={rationale}
              onChange={(event) => setRationale(event.target.value)}
              aria-invalid={Boolean(fieldErrors.rationale)}
              aria-describedby="rationale-help rationale-error"
            />
            <p id="rationale-help" className="text-xs text-muted-foreground">
              {t("propose.noteOptional", { count: rationale.length })}
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
            <section
              className="proposal-review"
              aria-label={t("propose.suggestionToSubmit")}
            >
              <p className="kicker">{map.title}</p>
              <h3>{selection?.label ?? manualName}</h3>
              <p className="text-sm text-muted-foreground">
                {selection?.address ?? manualAddress}
              </p>
              {rationale.trim() && (
                <div className="mt-6 border-t pt-5">
                  <p className="mb-2 text-xs text-muted-foreground">
                    {t("propose.shortNote")}
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
              {step === 1
                ? t("propose.backToSearch")
                : t("propose.previousStep")}
            </Button>
            <Button
              type="submit"
              disabled={!enabled || authChanged || busy || sending || locating}
            >
              {sending
                ? t("propose.sending")
                : step === 3
                  ? t("propose.suggestThisPlace")
                  : step === 1
                    ? t("propose.continueWithThisPlace")
                    : t("propose.reviewSuggestion")}
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
              aria-label={t("propose.close")}
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
                  ? t("propose.youVeAlreadyAddedThis")
                  : ["rejected", "archived", "reviewed"].includes(
                        existingPlace?.currentMapStatus ?? "",
                      )
                    ? t("propose.thisPlaceHasAlreadyBeen")
                    : existingPlace?.currentMapStatus === "pending"
                      ? t("propose.thisPlaceIsAlreadyPending")
                      : t("propose.thisPlaceIsAlreadyLive")}
              </DialogTitle>
              <DialogDescription className="max-w-sm leading-6">
                {creator
                  ? t("propose.youCanEditTheReason")
                  : existingPlace?.currentMapStatus === "rejected" ||
                      existingPlace?.currentMapStatus === "archived" ||
                      existingPlace?.currentMapStatus === "reviewed"
                    ? t("propose.thisPlaceHasAlreadyBeen2")
                    : existingPlace?.currentMapStatus === "pending"
                      ? t("propose.thisSuggestionWasAlreadyReceived")
                      : t("propose.thisPlaceIsAlreadyLive2")}
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="space-y-5 px-6 py-6">
            <div className="rounded-xl border bg-secondary/40 p-4">
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <MapPin size={14} />
                {t("propose.addedPlace")}
              </p>
              <p className="text-base font-semibold">{existingPlace?.name}</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {existingPlace?.locality} ·{" "}
                {t.data("placeCategory", existingPlace?.category ?? "")}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setExistingPlace(null)}
              >
                {t("propose.keepSearching")}
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
                  {t("propose.viewOnMap")}
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
          ? t("propose.placesInADraftAppear")
          : autoApprove
            ? t("propose.moderatorSuggestionsGoLiveIn")
            : t("propose.suggestionsAppearAsPendingPins")}
      </p>
      <Link
        href={`/maps/${map.slug}`}
        className="proposal-return flex items-center justify-center gap-2 text-xs text-muted-foreground"
      >
        <ArrowLeft size={13} />
        {t("propose.backToMap")}
      </Link>
    </div>
  );
}
