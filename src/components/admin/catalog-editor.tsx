"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  Map as MapIcon,
  Check,
  ExternalLink,
  ImagePlus,
  Info,
  Maximize,
  Monitor,
  Smartphone,
  RotateCcw,
  Focus,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { UnifiedDesktopHome } from "@/components/community/unified-desktop-home";
import { MapCatalog } from "@/components/community/map-catalog";
import { MapCardBackdrop } from "@/components/community/map-card-backdrop";
import { catalogCategories } from "@/domain/catalog-config";
import {
  buildCatalog,
  emptyCatalogFilters,
  filterCatalog,
  type CatalogFilters,
  type CatalogMap,
} from "@/domain/map-catalog";
import {
  catalogBatchSchema,
  catalogDraftKey,
  catalogDraftSchema,
  editForMap,
  previewEditorial,
  sameCatalogEdit,
  type CatalogAdminSnapshot,
  type CatalogEdit,
} from "@/domain/catalog-admin";
import styles from "./catalog-editor.module.css";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, { ...init, cache: "no-store" });
  const data = await r.json();
  if (!r.ok)
    throw Object.assign(
      new Error(data.error ?? "요청을 처리하지 못했습니다."),
      { status: r.status },
    );
  return data as T;
}
function MobilePreview({
  maps,
  selectedId,
  onSelect,
  filters,
  onFiltersChange,
}: {
  maps: CatalogMap[];
  selectedId: string;
  onSelect: (id: string) => void;
  filters: CatalogFilters;
  onFiltersChange: (f: CatalogFilters) => void;
}) {
  const [mode, setMode] = useState<"home" | "discover">(
    filters.q || filters.category ? "discover" : "home",
  );
  return (
    <div className={styles.mobileCatalog}>
      <MapCatalog
        maps={maps}
        mode={mode}
        demo
        editor={{
          filters,
          onFiltersChange,
          selectedId,
          onSelect,
          onNavigate: setMode,
        }}
      />
    </div>
  );
}

export function CatalogEditor({
  initial,
  userId,
}: {
  initial: CatalogAdminSnapshot;
  userId: string;
}) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState(initial);
  const [drafts, setDrafts] = useState<Record<string, CatalogEdit>>({});
  const [selectedId, setSelectedId] = useState(
    filterCatalog(initial.maps, { ...emptyCatalogFilters, sort: "popular" })[0]
      ?.id ?? "",
  );
  const [ready, setReady] = useState(false);
  const [storageWarning, setStorageWarning] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [conflict, setConflict] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [pane, setPane] = useState<"preview" | "edit">("preview");
  const [full, setFull] = useState(false);
  const [crop, setCrop] = useState(false);
  const [point, setPoint] = useState({ x: 50, y: 50 });
  const [alias, setAlias] = useState("");
  const [imageFailed, setImageFailed] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const settings = new Map(snapshot.settings.map((s) => [s.map_id, s]));
  const bases = Object.fromEntries(
    snapshot.maps.map((m) => [m.id, editForMap(m, settings.get(m.id))]),
  );
  const changedIds = Object.keys(drafts).filter(
    (id) => bases[id] && !sameCatalogEdit(drafts[id], bases[id]),
  );
  const selected = snapshot.maps.find((m) => m.id === selectedId);
  const edit = selected ? (drafts[selectedId] ?? bases[selectedId]) : undefined;
  const editorial =
    selected && edit ? previewEditorial(selected.editorial, edit) : undefined;
  const [filters, setFilters] = useState<CatalogFilters>({
    ...emptyCatalogFilters,
    sort: "popular",
  });
  const maps = buildCatalog(
    snapshot.maps,
    Object.fromEntries(snapshot.maps.map((m) => [m.id, m.regions])),
    Object.fromEntries(
      snapshot.maps
        .map((m) => [
          m.slug,
          drafts[m.id]
            ? previewEditorial(m.editorial, drafts[m.id])
            : m.editorial,
        ])
        .filter(([, v]) => v),
    ),
  );

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const raw = sessionStorage.getItem(catalogDraftKey(userId));
        if (raw) {
          const parsed = catalogDraftSchema.safeParse(JSON.parse(raw));
          if (parsed.success)
            setDrafts(
              Object.fromEntries(parsed.data.changes.map((d) => [d.mapId, d])),
            );
          else setMessage("저장된 임시 변경을 읽을 수 없어 초기화했습니다.");
        }
      } catch {
        setStorageWarning(
          "임시 변경을 저장할 수 없습니다. 이 화면을 떠나면 변경 내용이 사라질 수 있습니다.",
        );
      }
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, [userId]);
  useEffect(() => {
    if (!ready) return;
    try {
      const values = Object.values(drafts);
      if (values.length)
        sessionStorage.setItem(
          catalogDraftKey(userId),
          JSON.stringify({ changes: values }),
        );
      else sessionStorage.removeItem(catalogDraftKey(userId));
    } catch {
      queueMicrotask(() =>
        setStorageWarning(
          "임시 변경을 저장할 수 없습니다. 이 화면을 떠나면 변경 내용이 사라질 수 있습니다.",
        ),
      );
    }
  }, [drafts, ready, userId]);
  useEffect(() => {
    if (!changedIds.length) return;
    const unload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const click = (e: MouseEvent) => {
      const link = (e.target as Element).closest("a");
      if (
        !link ||
        link.target === "_blank" ||
        link.getAttribute("href") === "#" ||
        e.defaultPrevented ||
        e.ctrlKey ||
        e.metaKey
      )
        return;
      const url = new URL(link.href);
      if (url.pathname === location.pathname) return;
      if (
        !window.confirm(
          "아직 적용하지 않은 변경사항이 있습니다. 이 화면을 떠날까요?",
        )
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", unload);
    document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", unload);
      document.removeEventListener("click", click, true);
    };
  }, [changedIds.length]);
  // On return from a signed-out/background tab, discard its private drafts.
  useEffect(() => {
    const verify = () => {
      void fetch("/api/admin/catalog", { cache: "no-store" })
        .then((r) => {
          if (r.status === 401 || r.status === 403) {
            try {
              sessionStorage.removeItem(catalogDraftKey(userId));
            } catch {}
            setDrafts({});
            router.replace("/login?next=/admin/catalog");
          }
        })
        .catch(() => {});
    };
    window.addEventListener("focus", verify);
    window.addEventListener("pageshow", verify);
    return () => {
      window.removeEventListener("focus", verify);
      window.removeEventListener("pageshow", verify);
    };
  }, [userId, router]);
  function patch(value: Partial<CatalogEdit>) {
    if (!edit) return;
    setDrafts((d) => ({ ...d, [selectedId]: { ...edit, ...value } }));
    setMessage("");
    setError("");
  }
  function select(id: string) {
    setFull(false);
    setSelectedId(id);
    setPane("edit");
    setAlias("");
    setImageFailed(false);
  }
  function revert(all = false) {
    if (all && !window.confirm("모든 임시 변경을 되돌릴까요?")) return;
    setDrafts((d) => {
      if (all) return {};
      const next = { ...d };
      delete next[selectedId];
      return next;
    });
    setError("");
    setMessage("");
    setAlias("");
  }
  async function apply() {
    setError("");
    setMessage("");
    setConflict(false);
    const parsed = catalogBatchSchema.safeParse({
      changes: changedIds.map((id) => drafts[id]),
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "입력 내용을 확인해 주세요.");
      return;
    }
    setBusy(true);
    try {
      await api("/api/admin/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      setDrafts({});
      try {
        sessionStorage.removeItem(catalogDraftKey(userId));
      } catch {}
      setMessage("변경사항을 적용했습니다.");
      try {
        setSnapshot(await api<CatalogAdminSnapshot>("/api/admin/catalog"));
      } catch {
        setError(
          "적용은 완료됐지만 최신 화면을 불러오지 못했습니다. 새로고침해 주세요.",
        );
        setConflict(true);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "변경사항을 적용하지 못했습니다.",
      );
      setConflict((e as { status?: number }).status === 409);
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    setBusy(true);
    try {
      setSnapshot(await api<CatalogAdminSnapshot>("/api/admin/catalog"));
      setConflict(false);
      setMessage(
        "최신 내용을 불러왔습니다. 충돌한 지도의 변경을 되돌린 뒤 다시 편집해 주세요.",
      );
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "최신 내용을 불러오지 못했습니다.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function upload(chosen: File) {
    if (busy || uploading || !ready) return;
    const id = selectedId;
    const base = edit;
    if (!base) return;
    if (
      chosen.size > 5 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(chosen.type)
    ) {
      setError("5MB 이하 JPG, PNG, WebP 파일을 선택해 주세요.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const r = await api<{ id: string }>(
        `/api/admin/catalog/images?mapId=${id}`,
        {
          method: "POST",
          headers: { "Content-Type": chosen.type },
          body: chosen,
        },
      );
      setDrafts((d) => ({
        ...d,
        [id]: { ...(d[id] ?? base), imageId: r.id, focalX: 50, focalY: 50 },
      }));
      setImageFailed(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "사진 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
      if (file.current) file.current.value = "";
    }
  }
  function addAlias() {
    const value = alias.trim();
    if (!value || !edit) return;
    if (value.length > 60 || edit.aliases.length >= 20) {
      setError("검색 별칭은 60자 이하로 20개까지 입력할 수 있습니다.");
      return;
    }
    if (!edit.aliases.includes(value))
      patch({ aliases: [...edit.aliases, value] });
    setAlias("");
  }
  const preview = (
    <div
      className={`${styles.previewContent} ${full ? styles.fullContent : ""}`}
      data-viewport={viewport}
    >
      {viewport === "desktop" ? (
        <UnifiedDesktopHome
          maps={maps}
          demo
          editor={{
            selectedId,
            changedIds,
            filters,
            onFiltersChange: setFilters,
            onSelect: select,
          }}
        />
      ) : (
        <MobilePreview
          maps={maps}
          selectedId={selectedId}
          onSelect={select}
          filters={filters}
          onFiltersChange={setFilters}
        />
      )}
    </div>
  );
  const deviceControls = (
    <div className={styles.devices} aria-label="미리보기 화면 크기">
      <button
        type="button"
        aria-pressed={viewport === "desktop"}
        onClick={() => setViewport("desktop")}
      >
        <Monitor size={16} />
        데스크톱
      </button>
      <button
        type="button"
        aria-pressed={viewport === "mobile"}
        onClick={() => setViewport("mobile")}
      >
        <Smartphone size={16} />
        모바일
      </button>
    </div>
  );
  return (
    <main id="main" className={styles.editor} data-catalog-editor>
      <header className={styles.topbar}>
        <div>
          <Link href="/" className={styles.brand} aria-label="Ting map 홈">
            <span>
              <MapIcon size={20} />
            </span>
            Ting map
          </Link>
          <h1>홈 콘텐츠</h1>
          <span>변경한 지도 {changedIds.length}개</span>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            disabled={!changedIds.length || busy || uploading || !ready}
            onClick={() => revert(true)}
          >
            <RotateCcw size={16} />
            전체 되돌리기
          </button>
          <button
            type="button"
            className={styles.primary}
            disabled={
              !changedIds.length ||
              busy ||
              uploading ||
              !ready ||
              Boolean(alias.trim())
            }
            onClick={() => void apply()}
          >
            <Check size={16} />
            {busy ? "적용 중…" : "변경사항 적용"}
          </button>
        </div>
      </header>
      {storageWarning && (
        <p className={styles.warning} role="status">
          {storageWarning}
        </p>
      )}
      {message && (
        <p className={styles.success} role="status">
          {message}
        </p>
      )}
      {error && (
        <div className={styles.error} role="alert">
          {error}
          {conflict && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void refresh()}
            >
              최신 내용 확인
            </button>
          )}
        </div>
      )}
      <div className={styles.paneTabs}>
        <button
          type="button"
          aria-pressed={pane === "preview"}
          onClick={() => setPane("preview")}
        >
          홈 미리보기
        </button>
        <button
          type="button"
          aria-pressed={pane === "edit"}
          onClick={() => setPane("edit")}
        >
          카드 편집
        </button>
      </div>
      <div className={styles.workspace} data-pane={pane}>
        <section className={styles.preview} aria-label="홈 미리보기">
          <div className={styles.previewHeader}>
            <div>
              <h2>홈 미리보기</h2>
              <p>카드를 선택해 표시 정보를 수정하세요.</p>
            </div>
            <div>
              {deviceControls}
              <button type="button" onClick={() => setFull(true)}>
                <Maximize size={16} />
                전체 화면 보기
              </button>
            </div>
          </div>
          {preview}
        </section>
        <aside className={styles.inspector} aria-label="카드 정보">
          <header>
            <h2>카드 정보</h2>
            <button
              type="button"
              onClick={() => revert()}
              disabled={!drafts[selectedId] || busy || uploading}
            >
              <RotateCcw size={15} />이 지도 되돌리기
            </button>
          </header>
          {!selected || !edit ? (
            <p>편집할 공개 지도가 없습니다.</p>
          ) : (
            <fieldset disabled={busy || uploading || !ready}>
              <div className={styles.selected}>
                <div>
                  <span>선택한 지도</span>
                  <h3>{selected.displayTitle}</h3>
                </div>
                <Link
                  href={`/maps/${selected.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  지도 열기
                  <ExternalLink size={14} />
                </Link>
              </div>
              <div className={styles.image}>
                <MapCardBackdrop
                  key={`${selectedId}:${edit.imageId}`}
                  slug={selected.slug}
                  editorial={editorial}
                  sharp
                />
                <button type="button" onClick={() => file.current?.click()}>
                  <ImagePlus size={15} />
                  {uploading ? "업로드 중…" : "이미지 변경"}
                </button>
              </div>
              <input
                ref={file}
                type="file"
                className={styles.file}
                accept="image/jpeg,image/png,image/webp"
                aria-label="대표 이미지 업로드"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                }}
              />
              <button
                type="button"
                className={styles.cropButton}
                disabled={editorial?.wholeSubject || !editorial?.image}
                onClick={() => {
                  setPoint({ x: edit.focalX, y: edit.focalY });
                  setCrop(true);
                }}
              >
                <Focus size={16} />
                사진 중심 조정
              </button>
              {editorial?.wholeSubject && (
                <p className={styles.hint}>
                  이 사진은 전체 피사체 표현을 유지합니다. 사진을 교체하면 중심
                  위치를 조정할 수 있어요.
                </p>
              )}
              <label>
                표시 이름
                <input
                  value={edit.title}
                  maxLength={80}
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </label>
              <label>
                카테고리
                <select
                  value={edit.category ?? ""}
                  onChange={(e) =>
                    patch({
                      category: (e.target.value ||
                        null) as CatalogEdit["category"],
                    })
                  }
                >
                  <option value="">미분류</option>
                  {catalogCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                표시 지역
                <input
                  value={edit.region}
                  maxLength={60}
                  placeholder={`기본: ${selected.regionLabel}`}
                  onChange={(e) => patch({ region: e.target.value })}
                />
              </label>
              <div className={styles.aliases}>
                <label htmlFor="catalog-alias">
                  검색 별칭 <small>{edit.aliases.length}/20</small>
                </label>
                <div className={styles.chips}>
                  {edit.aliases.map((a) => (
                    <button
                      key={a}
                      type="button"
                      aria-label={`${a} 별칭 삭제`}
                      onClick={() =>
                        patch({ aliases: edit.aliases.filter((v) => v !== a) })
                      }
                    >
                      {a}
                      <X size={12} />
                    </button>
                  ))}
                </div>
                <div className={styles.aliasInput}>
                  <input
                    id="catalog-alias"
                    value={alias}
                    maxLength={60}
                    placeholder="검색어를 입력하고 Enter"
                    onChange={(e) => setAlias(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        addAlias();
                      }
                    }}
                  />
                  <button
                    type="button"
                    disabled={!alias.trim()}
                    onClick={addAlias}
                  >
                    추가
                  </button>
                </div>
                {alias.trim() && (
                  <p className={styles.hint}>
                    ‘추가’를 눌러 별칭 입력을 완료해 주세요.
                  </p>
                )}
              </div>
              <footer>
                <p>
                  <Info size={15} />
                  적용 전까지 실제 홈은 변경되지 않습니다.
                </p>
                <p>
                  <Info size={15} />
                  인기순 정렬은 자동으로 반영됩니다.
                </p>
              </footer>
            </fieldset>
          )}
        </aside>
      </div>
      <Dialog open={full} onOpenChange={setFull}>
        <DialogContent className={styles.fullDialog}>
          <DialogTitle>홈 전체 미리보기</DialogTitle>
          <DialogDescription>
            카드를 선택하면 편집 대상으로 지정됩니다. 실제 지도는 ‘지도 열기’로
            확인하세요.
          </DialogDescription>
          {deviceControls}
          {preview}
        </DialogContent>
      </Dialog>
      <Dialog open={crop} onOpenChange={setCrop}>
        <DialogContent className={styles.cropDialog}>
          <DialogTitle>사진 중심 조정</DialogTitle>
          <DialogDescription>
            사진을 클릭하거나 드래그하세요. 슬라이더 또는 방향키로도 조정할 수
            있습니다.
          </DialogDescription>
          {editorial?.image && (
            <>
              <div
                className={styles.cropSurface}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture(e.pointerId);
                  const rect = e.currentTarget.getBoundingClientRect();
                  setPoint({
                    x: Math.round(
                      Math.max(
                        0,
                        Math.min(
                          100,
                          ((e.clientX - rect.left) / rect.width) * 100,
                        ),
                      ),
                    ),
                    y: Math.round(
                      Math.max(
                        0,
                        Math.min(
                          100,
                          ((e.clientY - rect.top) / rect.height) * 100,
                        ),
                      ),
                    ),
                  });
                }}
                onPointerMove={(e) => {
                  if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                  const r = e.currentTarget.getBoundingClientRect();
                  setPoint({
                    x: Math.round(
                      Math.max(
                        0,
                        Math.min(100, ((e.clientX - r.left) / r.width) * 100),
                      ),
                    ),
                    y: Math.round(
                      Math.max(
                        0,
                        Math.min(100, ((e.clientY - r.top) / r.height) * 100),
                      ),
                    ),
                  });
                }}
              >
                {/* Native img preserves the source's natural aspect ratio for focal-point picking. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={editorial.image}
                  alt="중심을 조정할 원본 사진"
                  draggable={false}
                  onLoad={() => setImageFailed(false)}
                  onError={() => setImageFailed(true)}
                />
                <Focus
                  size={32}
                  className={styles.crosshair}
                  style={{ left: `${point.x}%`, top: `${point.y}%` }}
                />
              </div>
              {imageFailed && (
                <p role="alert">
                  사진을 불러오지 못했습니다. 임시 사진이 만료됐다면 다시 선택해
                  주세요.
                </p>
              )}
              <label>
                가로 위치 {point.x}%
                <input
                  aria-label="사진 가로 위치"
                  type="range"
                  min={0}
                  max={100}
                  value={point.x}
                  onChange={(e) =>
                    setPoint((p) => ({ ...p, x: Number(e.target.value) }))
                  }
                />
              </label>
              <label>
                세로 위치 {point.y}%
                <input
                  aria-label="사진 세로 위치"
                  type="range"
                  min={0}
                  max={100}
                  value={point.y}
                  onChange={(e) =>
                    setPoint((p) => ({ ...p, y: Number(e.target.value) }))
                  }
                />
              </label>
              <div className={styles.cropPreviews}>
                {["데스크톱", "모바일"].map((name, i) => (
                  <div key={name}>
                    <p>{name}</p>
                    <div
                      style={{
                        aspectRatio: i ? "1.6" : "2.05",
                        position: "relative",
                        overflow: "hidden",
                        borderRadius: 12,
                      }}
                    >
                      <MapCardBackdrop
                        slug={selected?.slug ?? ""}
                        editorial={{
                          ...editorial,
                          focalPoint: `${point.x}% ${point.y}%`,
                        }}
                        sharp
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.actions}>
                <button type="button" onClick={() => setCrop(false)}>
                  취소
                </button>
                <button
                  type="button"
                  className={styles.primary}
                  disabled={imageFailed}
                  onClick={() => {
                    patch({ focalX: point.x, focalY: point.y });
                    setCrop(false);
                  }}
                >
                  위치 반영
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
