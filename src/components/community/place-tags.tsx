"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Pencil } from "lucide-react";
import type { MapTag } from "@/domain/map-tags";
import { Button } from "@/components/ui/button";
import { post } from "./api";
import styles from "./place-tags.module.css";
import { useI18n } from "@/i18n/client";
type State = { tags: MapTag[]; tagIds: string[]; canManage: boolean };
type Props = { id: string; onChange: () => void };

// A different map-place is a different assignment, even for the same physical venue.
export function PlaceTags(props: Props) {
  return <PlaceTagContent key={props.id} {...props} />;
}
function PlaceTagContent({ id, onChange }: Props) {
  const { t } = useI18n();
  const [state, setState] = useState<State | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const editButton = useRef<HTMLButtonElement>(null);
  const firstChoice = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    request.current = controller;
    fetch(`/api/map-places/${id}/tags`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(t("place.couldnTLoadTags"));
        const value = (await response.json()) as Partial<State> | null;
        if (
          !Array.isArray(value?.tags) ||
          !Array.isArray(value.tagIds) ||
          typeof value.canManage !== "boolean"
        )
          throw new Error(t("place.couldnTLoadTags"));
        return value as State;
      })
      .then((value) => {
        if (!controller.signal.aborted) {
          setState(value);
          setDraft(value.tagIds);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setError(t("place.couldnTLoadPlaceTags"));
      });
    return () => controller.abort();
  }, [id, attempt, t]);
  useEffect(() => {
    if (editing) {
      wasEditing.current = true;
      firstChoice.current?.focus();
    } else if (wasEditing.current) {
      editButton.current?.focus();
      wasEditing.current = false;
    }
  }, [editing]);
  if (!state && !error)
    return (
      <p role="status" className={styles.hint}>
        {t("place.loadingTags")}
      </p>
    );
  if (state && !state.tags.length && !state.canManage) return null;
  const dirty =
    state && [...draft].sort().join(",") !== [...state.tagIds].sort().join(",");
  const assigned =
    state?.tags.filter((tag) => state.tagIds.includes(tag.id)) ?? [];
  const firstEnabledIndex =
    state?.tags.findIndex(
      (tag) => draft.length < 10 || draft.includes(tag.id),
    ) ?? -1;
  function cancel() {
    if (saving || !state) return;
    setDraft(state.tagIds);
    setError("");
    setNotice("");
    setEditing(false);
  }
  async function save() {
    if (!state || !dirty || saving) return;
    const signal = request.current?.signal;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const next = await post<State>(
        `/api/map-places/${id}/tags`,
        { tagIds: draft },
        signal,
      );
      if (signal?.aborted) return;
      setState(next);
      setDraft(next.tagIds);
      setEditing(false);
      setNotice(t("place.tagSaved"));
      onChange();
    } catch (e) {
      if (!signal?.aborted) setError(t.message((e as Error).message));
    } finally {
      if (!signal?.aborted) setSaving(false);
    }
  }
  return (
    <section
      className={styles.section}
      aria-label={t("place.tagsOnThisMap")}
      data-place-tags
    >
      <div className={styles.header}>
        <h3 className={styles.heading}>{t("place.tagsHeading")}</h3>
        {editing ? (
          <span className={styles.hint}>{t("place.editing")}</span>
        ) : (
          state?.canManage &&
          state.tags.length > 0 && (
            <button
              ref={editButton}
              type="button"
              className={styles.edit}
              aria-label={t("place.editTags")}
              onClick={() => {
                setDraft(state.tagIds);
                setNotice("");
                setError("");
                setEditing(true);
              }}
            >
              <Pencil size={14} aria-hidden="true" />
              {t("place.edit")}
            </button>
          )
        )}
      </div>
      {editing && state?.canManage ? (
        <form
          className={styles.editor}
          aria-label={t("place.editTagsForm")}
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              cancel();
            }
          }}
        >
          <p className={styles.hint}>{t("place.chooseTagsHint")}</p>
          <div className={styles.choices}>
            {state.tags.map((tag, index) => (
              <button
                ref={index === firstEnabledIndex ? firstChoice : undefined}
                className={styles.choice}
                key={tag.id}
                type="button"
                disabled={
                  saving || (!draft.includes(tag.id) && draft.length >= 10)
                }
                aria-pressed={draft.includes(tag.id)}
                onClick={() => {
                  setNotice("");
                  setError("");
                  setDraft((ids) =>
                    ids.includes(tag.id)
                      ? ids.filter((value) => value !== tag.id)
                      : [...ids, tag.id],
                  );
                }}
              >
                {draft.includes(tag.id) && (
                  <Check size={14} aria-hidden="true" />
                )}
                {tag.name}
              </button>
            ))}
          </div>
          <div className={styles.actions}>
            <span className={styles.hint} aria-live="polite">
              {draft.length}/10
            </span>
            <div>
              <button
                type="button"
                className={styles.cancel}
                disabled={saving}
                aria-label={t("place.cancelTagEdit")}
                onClick={cancel}
              >
                {t("place.cancel")}
              </button>
              <Button
                type="submit"
                size="sm"
                className={styles.save}
                aria-label={t("place.saveTags")}
                disabled={saving || !dirty}
              >
                {saving ? t("place.saving") : t("place.save2")}
              </Button>
            </div>
          </div>
        </form>
      ) : (
        state && (
          <>
            {assigned.length ? (
              <ul
                className={styles.assigned}
                aria-label={t("place.assignedTags")}
              >
                {assigned.map((tag) => (
                  <li key={tag.id} className={styles.tag}>
                    {tag.name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.hint}>
                {!state.tags.length && state.canManage
                  ? t("place.createPlaceTagsInMap")
                  : t("place.noTagsAssignedYet")}
              </p>
            )}
          </>
        )
      )}
      {error && (
        <div role="alert" className={styles.error}>
          <p>{error}</p>
          {!state && (
            <button
              type="button"
              className={styles.retry}
              onClick={() => {
                setError("");
                setAttempt((value) => value + 1);
              }}
            >
              {t("place.tryAgain")}
            </button>
          )}
        </div>
      )}
      {notice && (
        <p role="status" className={styles.hint}>
          {notice}
        </p>
      )}
    </section>
  );
}
