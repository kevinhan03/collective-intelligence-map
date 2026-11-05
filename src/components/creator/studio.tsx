"use client";
import { useEffect, useState } from "react";
import Link from "@/i18n/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ShareButton } from "@/components/community/share-button";
import { post } from "@/components/community/api";
import type {
  CreatorMap,
  CreatorPlace,
  CreatorSnapshot,
} from "@/domain/creator";
import type { Viewer } from "@/domain/types";
import { useI18n } from "@/i18n/client";
const statusLabel = {
  draft: "creator.statusDraft",
  published: "creator.statusPublished",
  archived: "creator.statusArchived",
} as const;
export function CreatorStudio({
  initial,
  viewer,
}: {
  initial: CreatorSnapshot;
  viewer: Viewer;
}) {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState(initial);
  const params = useSearchParams();
  const [selected, setSelected] = useState<string | null>(
    initial.maps.some((m) => m.id === params.get("map"))
      ? params.get("map")
      : (initial.maps[0]?.id ?? null),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [version, setVersion] = useState(0);
  const map = snapshot.maps.find((m) => m.id === selected);
  async function refresh() {
    const r = await fetch("/api/creator/maps", { cache: "no-store" });
    const result = await r.json();
    if (!r.ok || !result.snapshot)
      throw new Error(result.error ?? t("creator.couldnTRefreshTheList"));
    setSnapshot(result.snapshot);
    setVersion((v) => v + 1);
  }
  async function action(payload: unknown) {
    if (busy) return false;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      let command = payload;
      if ((payload as { action?: string }).action === "profile") {
        const response = await fetch("/api/creator/maps", {
          cache: "no-store",
        });
        const current = await response.json();
        if (!response.ok)
          throw new Error(current.error ?? t("creator.couldnTCheckTheProfile"));
        command = {
          ...(payload as object),
          displayName: current.snapshot?.profile?.display_name ?? "",
          instagram: current.snapshot?.profile?.instagram ?? "",
          bio: current.bio ?? viewer.bio,
        };
      }
      const result = await post<{ id?: string }>("/api/creator/maps", command);
      await refresh();
      if (result.id) setSelected(result.id);
      setMessage(t("creator.changesSaved"));
      return true;
    } catch (e) {
      setError(t.message((e as Error).message));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const p = snapshot.profile;
  return (
    <div className="creator-studio space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="kicker">{t("creator.myPlaceLink")}</p>
          <h1 className="mt-2 text-3xl font-semibold">
            {t("creator.creatorStudio")}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            {t("creator.putThePlacesYouVe")}
          </p>
        </div>
        <ShareButton
          path={`/u/${viewer.handle}`}
          title={p?.display_name || viewer.handle}
        />
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-destructive p-3 text-sm"
        >
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-primary">
          {message}
        </p>
      )}
      <details className="rounded-2xl border p-5">
        <summary className="cursor-pointer font-semibold">
          {t("creator.featuredMap")}
        </summary>
        <Link
          href="/settings/profile"
          className="mt-4 inline-block text-sm text-primary"
        >
          {t("creator.editNameBioAndInstagram")}
        </Link>
        <form
          className="mt-5 grid gap-4"
          onSubmit={async (e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            await action({
              action: "profile",
              displayName: p?.display_name ?? "",
              bio: viewer.bio,
              instagram: p?.instagram ?? "",
              featuredMapId: f.get("featuredMapId"),
            });
          }}
        >
          <label className="grid gap-2 text-sm">
            {t("creator.featuredMap")}
            <select
              className="rounded-xl border bg-background p-3"
              name="featuredMapId"
              defaultValue={p?.featured_map_id ?? ""}
            >
              <option value="">{t("creator.none")}</option>
              {snapshot.maps
                .filter((m) => m.status === "published" && !m.hidden_at)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
            </select>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={busy}>{t("creator.saveFeaturedMap")}</Button>
            <Link href={`/u/${viewer.handle}`} className="text-sm text-primary">
              {t("creator.viewPublicProfile")}
            </Link>
          </div>
        </form>
      </details>
      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">{t("creator.myMaps")}</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelected(null)}
            >
              <Plus size={16} /> {t("creator.newMap")}
            </Button>
          </div>
          {snapshot.maps.map((m, i) => (
            <div
              key={m.id}
              className={`rounded-xl border p-3 ${selected === m.id ? "border-primary" : ""}`}
            >
              <button
                className="w-full text-left"
                onClick={() => setSelected(m.id)}
              >
                <span className="block font-semibold">{m.title}</span>
                <span className="text-xs text-muted-foreground">
                  {m.hidden_at
                    ? t("creator.hiddenByModerator")
                    : t(statusLabel[m.status])}
                </span>
              </button>
              <div className="mt-2 flex gap-2">
                {[-1, 1].map((d) => (
                  <Button
                    key={d}
                    size="icon"
                    variant="ghost"
                    aria-label={`${m.title} ${d < 0 ? t("creator.moveUp") : t("creator.moveDown")}`}
                    disabled={
                      busy || i + d < 0 || i + d >= snapshot.maps.length
                    }
                    onClick={() => {
                      const ids = snapshot.maps.map((x) => x.id);
                      [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
                      void action({ action: "order_maps", ids });
                    }}
                  >
                    {d < 0 ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </aside>
        <section className="min-w-0 space-y-6">
          <MapEditor
            key={map?.id ?? "new"}
            map={map}
            busy={busy}
            action={action}
          />
          {map && (
            <>
              <div className="flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link href={`/studio/${map.id}/preview`}>
                    {t("creator.preview")}
                  </Link>
                </Button>
                {map.status !== "archived" && !map.hidden_at && (
                  <Button asChild>
                    <Link href={`/studio/${map.id}/add`}>
                      {t("creator.addPlace")}
                    </Link>
                  </Button>
                )}
                {map.status === "published" && !map.hidden_at && (
                  <>
                    <Button asChild variant="outline">
                      <Link href={`/maps/${map.slug}`}>
                        {t("creator.viewPublicMap")}
                      </Link>
                    </Button>
                    <ShareButton path={`/maps/${map.slug}`} title={map.title} />
                  </>
                )}
              </div>
              <CoverEditor
                key={`cover:${map.id}`}
                map={map}
                busy={busy}
                refresh={refresh}
                action={action}
              />
              <PlaceEditor
                key={map.id}
                id={map.id}
                version={version}
                busy={busy}
                action={action}
              />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
function MapEditor({
  map,
  busy,
  action,
}: {
  map?: CreatorMap;
  busy: boolean;
  action: (p: unknown) => Promise<boolean>;
}) {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border bg-card p-5 sm:p-6">
      <h2 className="mb-5 text-lg font-semibold">
        {map ? t("creator.mapSettings") : t("creator.createANewMap")}
      </h2>
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          await action({
            action: map ? "update" : "create",
            mapId: map?.id,
            title: f.get("title"),
            description: f.get("description"),
            country: f.get("country"),
          });
        }}
      >
        <label className="grid gap-2 text-sm">
          {t("creator.mapTitle")}
          <Input
            name="title"
            required
            maxLength={80}
            defaultValue={map?.title}
          />
        </label>
        <label className="grid gap-2 text-sm">
          {t("creator.bio")}
          <Textarea
            name="description"
            maxLength={500}
            defaultValue={map?.description}
          />
        </label>
        <label className="grid gap-2 text-sm">
          {t("creator.placeSearchArea")}
          <select
            className="rounded-xl border bg-background p-3"
            name="country"
            defaultValue={map?.country ?? "world"}
          >
            <option value="KR">{t("creator.korea")}</option>
            <option value="JP">{t("creator.japan")}</option>
            <option value="world">
              {t("creator.worldwideAvailableSearchSources")}
            </option>
          </select>
        </label>
        <Button disabled={busy}>
          {map ? t("creator.saveSettings") : t("creator.createDraft")}
        </Button>
      </form>
      {map && (
        <div className="mt-6 border-t pt-4">
          <p className="mb-3 text-xs text-muted-foreground">
            {t("creator.publishingMakesItsPlacesPublic")}
          </p>
          <div className="flex flex-wrap gap-2">
            {(["draft", "published", "archived"] as const).map((status) => (
              <Button
                key={status}
                variant={map.status === status ? "secondary" : "outline"}
                disabled={
                  busy || map.status === status || Boolean(map.hidden_at)
                }
                onClick={() =>
                  void action({ action: "status", mapId: map.id, status })
                }
              >
                {t("creator.switchTo", { status: t(statusLabel[status]) })}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
function CoverEditor({
  map,
  busy,
  refresh,
  action,
}: {
  map: CreatorMap;
  busy: boolean;
  refresh: () => Promise<void>;
  action: (p: unknown) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="rounded-2xl border p-5">
      <h2 className="font-semibold">{t("creator.mapCoverSharePreview")}</h2>
      {map.cover_path ? (
        <Image
          unoptimized
          width={1200}
          height={630}
          alt={t("creator.cover", { title: map.title })}
          src={`/api/creator/maps/${map.id}/cover?v=${encodeURIComponent(map.cover_path)}`}
          className="mt-4 aspect-[1.91/1] w-full rounded-xl object-cover"
        />
      ) : (
        <div className="mt-4 flex aspect-[1.91/1] items-center justify-center rounded-xl bg-secondary text-xl font-semibold text-primary">
          {map.title}
        </div>
      )}
      <h3 className="mt-3 font-semibold">{map.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{map.description}</p>
      <label className="mt-5 grid gap-2 text-sm">
        {t("creator.chooseCoverJpgPngOr")}
        <Input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={busy || uploading || map.status === "archived"}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploading(true);
            setError("");
            try {
              if (file.size > 5 * 1024 * 1024)
                throw new Error(t("creator.pleaseChooseAPhotoOf"));
              const r = await fetch(`/api/creator/maps/${map.id}/cover`, {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
              });
              if (!r.ok) throw new Error((await r.json()).error);
              await refresh();
            } catch (e) {
              setError(t.message((e as Error).message));
            } finally {
              setUploading(false);
            }
          }}
        />
      </label>
      {uploading && (
        <p role="status" className="mt-2 text-sm">
          {t("creator.processingTheCover")}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
      {map.cover_path && (
        <Button
          variant="ghost"
          disabled={busy || uploading}
          onClick={() =>
            void action({ action: "cover", mapId: map.id, path: "" })
          }
        >
          {t("creator.removeCover")}
        </Button>
      )}
    </div>
  );
}
function PlaceEditor({
  id,
  version,
  busy,
  action,
}: {
  id: string;
  version: number;
  busy: boolean;
  action: (p: unknown) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [places, setPlaces] = useState<CreatorPlace[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/creator/maps/${id}/places`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (r) => {
        const result = await r.json();
        if (!r.ok) throw new Error(result.error);
        return result;
      })
      .then(setPlaces)
      .catch((e) => {
        if (e.name !== "AbortError") setError(t.message(e.message));
      });
    return () => controller.abort();
  }, [id, version, t]);
  return (
    <section>
      <h2 className="mb-4 font-semibold">
        {t("creator.placesLimit", { count: places.length })}
      </h2>
      {error && <p role="alert">{error}</p>}
      {!places.length && !error && (
        <p className="text-sm text-muted-foreground">
          {t("creator.addYourFirstPlaceTo")}
        </p>
      )}
      {places.map((p, i) => (
        <article key={p.id} className="mb-3 rounded-xl border p-4">
          <h3 className="font-semibold">
            {i + 1}. {p.name}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">{p.address}</p>
          <form
            className="mt-3 space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              await action({
                action: "edit_place",
                mapId: id,
                id: p.id,
                rationale: new FormData(e.currentTarget).get("rationale"),
              });
            }}
          >
            <label className="grid gap-2 text-sm">
              {t("creator.shortNoteOptional")}
              <Textarea
                key={p.rationale}
                name="rationale"
                defaultValue={p.rationale}
                maxLength={1000}
              />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy}>
                {t("creator.saveNote")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      t("creator.removeFromThisMapThe", { name: p.name }),
                    )
                  )
                    void action({
                      action: "remove_place",
                      mapId: id,
                      id: p.id,
                    });
                }}
                type="button"
              >
                {t("creator.removeFromMap")}
              </Button>
              {[-1, 1].map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`${p.name} ${d < 0 ? t("creator.moveUp") : t("creator.moveDown")}`}
                  disabled={busy || i + d < 0 || i + d >= places.length}
                  onClick={() => {
                    const ids = places.map((x) => x.id);
                    [ids[i], ids[i + d]] = [ids[i + d], ids[i]];
                    void action({ action: "order_places", mapId: id, ids });
                  }}
                >
                  {d < 0 ? <ArrowUp size={15} /> : <ArrowDown size={15} />}
                </Button>
              ))}
            </div>
          </form>
        </article>
      ))}
    </section>
  );
}
