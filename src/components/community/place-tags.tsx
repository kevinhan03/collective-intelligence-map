"use client";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { MapTag } from "@/domain/map-tags";
import { Button } from "@/components/ui/button";
import { post } from "./api";
import styles from "./map-tags.module.css";
type State = { tags: MapTag[]; tagIds: string[]; canManage: boolean };
export function PlaceTags({
  id,
  onChange,
}: {
  id: string;
  onChange: () => void;
}) {
  const [state, setState] = useState<State | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/map-places/${id}/tags`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("태그를 불러오지 못했습니다.");
        const value = (await response.json()) as Partial<State> | null;
        if (
          !Array.isArray(value?.tags) ||
          !Array.isArray(value.tagIds) ||
          typeof value.canManage !== "boolean"
        )
          throw new Error("태그를 불러오지 못했습니다.");
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
          setError("장소 태그를 불러오지 못했습니다.");
      });
    return () => controller.abort();
  }, [id, attempt]);
  if (!state && !error)
    return (
      <p role="status" className={styles.hint}>
        태그 불러오는 중…
      </p>
    );
  if (state && !state.tags.length && !state.canManage) return null;
  const dirty =
    state && [...draft].sort().join(",") !== [...state.tagIds].sort().join(",");
  return (
    <section className={styles.section} aria-label="이 지도의 태그">
      <h3 className={styles.heading}>이 지도의 태그</h3>
      {state && (
        <div className={styles.chips}>
          {state.tags
            .filter((tag) => state.canManage || state.tagIds.includes(tag.id))
            .map((tag) =>
              state.canManage ? (
                <button
                  className={styles.chip}
                  key={tag.id}
                  type="button"
                  disabled={
                    saving || (!draft.includes(tag.id) && draft.length >= 10)
                  }
                  aria-pressed={draft.includes(tag.id)}
                  onClick={() => {
                    setNotice("");
                    setDraft((ids) =>
                      ids.includes(tag.id)
                        ? ids.filter((id) => id !== tag.id)
                        : [...ids, tag.id],
                    );
                  }}
                >
                  {draft.includes(tag.id) && (
                    <Check size={14} aria-hidden="true" />
                  )}
                  #{tag.name}
                </button>
              ) : (
                <span key={tag.id} className={styles.chip}>
                  #{tag.name}
                </span>
              ),
            )}
        </div>
      )}
      {state && !state.canManage && !state.tagIds.length && (
        <p className={styles.hint}>아직 지정된 태그가 없습니다.</p>
      )}
      {state?.canManage &&
        (!state.tags.length ? (
          <p className={styles.hint}>
            지도 정보에서 분류 태그를 먼저 만들어 주세요.
          </p>
        ) : (
          <div className={styles.actions}>
            <Button
              size="sm"
              disabled={saving || !dirty}
              onClick={async () => {
                setSaving(true);
                setError("");
                setNotice("");
                try {
                  const next = await post<State>(`/api/map-places/${id}/tags`, {
                    tagIds: draft,
                  });
                  setState(next);
                  setDraft(next.tagIds);
                  setNotice("태그를 저장했습니다.");
                  onChange();
                } catch (e) {
                  setError((e as Error).message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              태그 저장
            </Button>
            <span className={styles.hint}>{draft.length}/10</span>
          </div>
        ))}
      {error && (
        <div role="alert" className="text-sm text-destructive">
          <p>{error}</p>
          {!state && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setError("");
                setAttempt((value) => value + 1);
              }}
            >
              다시 시도
            </Button>
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
