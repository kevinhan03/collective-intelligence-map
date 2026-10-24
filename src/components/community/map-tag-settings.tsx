"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { tagNameSchema, type MapTag } from "@/domain/map-tags";
import type { ThemeMap, Viewer } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { post } from "./api";
import styles from "./map-tags.module.css";

export function MapTagSettings({
  map,
  viewer,
  demo,
}: {
  map: ThemeMap;
  viewer: Viewer | null;
  demo: boolean;
}) {
  const router = useRouter();
  const canManage =
    !demo &&
    !!viewer &&
    (viewer.role === "admin" ||
      (map.kind === "creator" && map.owner_id === viewer.id));
  const [override, setOverride] = useState<MapTag[] | null>(null);
  const tags = override ?? map.place_tags ?? [];
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<MapTag | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  async function save(input: unknown) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await post<{ tags: MapTag[] }>(
        `/api/maps/${map.id}/tags`,
        input,
      );
      setOverride(result.tags);
      setName("");
      setEditing(null);
      setRemoving(null);
      setNotice("태그를 저장했습니다.");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.section} aria-label="장소 분류 태그">
      <h3 className={styles.heading}>
        장소 분류 태그 <span className={styles.hint}>{tags.length}/30</span>
      </h3>
      <div className={styles.chips}>
        {tags.map((tag) =>
          canManage ? (
            <div key={tag.id} className={styles.editorRow}>
              <span>#{tag.name}</span>
              <button
                type="button"
                className={styles.iconButton}
                disabled={busy}
                aria-label={`${tag.name} 태그 이름 변경`}
                onClick={() => {
                  setEditing(tag.id);
                  setName(`#${tag.name}`);
                  setRemoving(null);
                }}
              >
                <Pencil size={13} />
              </button>
              <button
                type="button"
                className={styles.iconButton}
                disabled={busy}
                aria-label={`${tag.name} 태그 삭제`}
                onClick={() => setRemoving(tag)}
              >
                <X size={14} />
              </button>
            </div>
          ) : (
            <span key={tag.id} className={styles.chip}>
              #{tag.name}
            </span>
          ),
        )}
      </div>
      {!tags.length && (
        <p className={styles.hint}>아직 장소 분류 태그가 없습니다.</p>
      )}
      {canManage && (
        <>
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              const parsed = tagNameSchema.safeParse(name);
              if (!parsed.success) {
                setError(parsed.error.issues[0].message);
                return;
              }
              void save(
                editing
                  ? { action: "rename", id: editing, name: parsed.data }
                  : { action: "create", name: parsed.data },
              );
            }}
          >
            <Input
              aria-label="장소 태그 이름"
              placeholder="#태그 입력 후 Enter"
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && event.nativeEvent.isComposing)
                  event.preventDefault();
              }}
            />
            <Button
              size="sm"
              disabled={busy || (!editing && tags.length >= 30)}
            >
              {editing ? "저장" : "추가"}
            </Button>
            {editing && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(null);
                  setName("");
                }}
              >
                취소
              </Button>
            )}
          </form>
          <p className={styles.hint}>
            관리자와 지도 소유자가 관리합니다. 장소 상세에서 여러 태그를 지정할
            수 있어요.
          </p>
          {removing && (
            <div
              role="group"
              aria-label="태그 삭제 확인"
              className={styles.section}
            >
              <p className={styles.hint}>
                #{removing.name} 태그를 삭제하면 지도 필터와 장소 상세에서
                숨겨집니다.
              </p>
              <div className={styles.actions}>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy}
                  onClick={() =>
                    void save({ action: "archive", id: removing.id })
                  }
                >
                  태그 삭제
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setRemoving(null)}
                >
                  취소
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className={styles.hint}>
          {notice}
        </p>
      )}
    </section>
  );
}
