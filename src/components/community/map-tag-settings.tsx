"use client";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Pencil, X } from "lucide-react";
import { tagNameSchema, type MapTag } from "@/domain/map-tags";
import type { ThemeMap, Viewer } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { post } from "./api";
import styles from "./map-tags.module.css";

import { useI18n } from "@/i18n/client";
export function MapTagSettings({
  map,
  viewer,
  demo,
}: {
  map: ThemeMap;
  viewer: Viewer | null;
  demo: boolean;
}) {
  const { t } = useI18n();
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
      setNotice(t("map.tagSaved"));
      router.refresh();
    } catch (e) {
      setError(t.message((e as Error).message));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className={styles.section} aria-label={t("map.placeTags")}>
      <h3 className={styles.heading}>
        {t("map.placeTags")}{" "}
        <span className={styles.hint}>{tags.length}/30</span>
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
                aria-label={t("map.renameTag", { name: tag.name })}
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
                aria-label={t("map.deleteTag", { name: tag.name })}
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
      {!tags.length && <p className={styles.hint}>{t("map.noPlaceTagsYet")}</p>}
      {canManage && (
        <>
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              const parsed = tagNameSchema.safeParse(name);
              if (!parsed.success) {
                setError(t.message(parsed.error.issues[0].message));
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
              aria-label={t("map.placeTagName")}
              placeholder={t("map.typeTagAndPressEnter")}
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
              {editing ? t("map.save") : t("map.add")}
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
                {t("map.cancel")}
              </Button>
            )}
          </form>
          <p className={styles.hint}>{t("map.managedByAdminsAndThe")}</p>
          {removing && (
            <div
              role="group"
              aria-label={t("map.confirmTagDeletion")}
              className={styles.section}
            >
              <p className={styles.hint}>
                {t("map.deleteTagWarning", { name: removing.name })}
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
                  {t("map.deleteTag2")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => setRemoving(null)}
                >
                  {t("map.cancel")}
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
