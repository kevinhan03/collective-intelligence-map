"use client";
import { useEffect, useRef, useState } from "react";
import Link from "@/i18n/link";
import type { Comment, MapPlace, Viewer } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { post } from "./api";
import { DropdownMenu } from "radix-ui";
import { MoreHorizontal } from "lucide-react";

import { useI18n } from "@/i18n/client";
export function PlaceIntroductions({
  place,
  viewer,
  demo,
  readOnly,
  loginHref,
  onReport,
}: {
  place: MapPlace;
  viewer: Viewer | null;
  demo: boolean;
  readOnly: boolean;
  loginHref: string;
  onReport: (id: string) => void;
}) {
  const { t } = useI18n();
  const [entries, setEntries] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(!demo);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const publicPlace = ["approved", "disputed"].includes(place.status);
  const enabled = Boolean(viewer) && !demo && !readOnly && publicPlace;
  useEffect(() => {
    if (demo) return;
    const controller = new AbortController();
    fetch(`/api/map-places/${place.id}/introductions`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(t("place.couldnTLoadNotes"));
        return response.json();
      })
      .then((data) => {
        setEntries(data.introductions);
        setLoadError("");
      })
      .catch((error) => {
        if (error.name !== "AbortError") setLoadError(t.message(error.message));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [place.id, demo, revision, t]);

  function reset() {
    setOpen(false);
    setEditing(null);
    setText("");
    setError("");
  }
  const menu = !readOnly && !demo && publicPlace && !open && (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="introduction-menu-trigger detail-icon-action"
          aria-label={t("place.placeNoteMenu")}
        >
          <MoreHorizontal size={20} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="place-context-menu"
          align="end"
          sideOffset={4}
        >
          <DropdownMenu.Item
            className="place-context-menu-item"
            asChild={!viewer}
            onSelect={viewer ? () => setOpen(true) : undefined}
          >
            {viewer ? (
              t("place.addANote")
            ) : (
              <Link href={loginHref}>{t("place.signInToAddA")}</Link>
            )}
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
  return (
    <section
      className="place-introductions relative rounded-2xl p-5 space-y-4"
      aria-label={t("place.aboutThisPlace")}
    >
      {place.rationale && (
        <article className="introduction-primary">
          <p className="whitespace-pre-wrap text-sm leading-7">
            {place.rationale}
          </p>
          <div className="introduction-attribution">
            <p className="text-xs text-muted-foreground">
              {place.added_by ? (
                <Link href={`/u/${place.handle}`}>@{place.handle}</Link>
              ) : (
                t.message(place.handle)
              )}{" "}
              {t("place.byContributor")}
            </p>
            {menu}
          </div>
        </article>
      )}
      {!place.rationale && menu && (
        <div className="introduction-attribution introduction-attribution-empty">
          {menu}
        </div>
      )}
      {entries.map((entry) => (
        <article key={entry.id} className="pt-2">
          <p className="whitespace-pre-wrap text-sm leading-7">{entry.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {entry.author_id ? (
              <Link href={`/u/${entry.handle}`}>@{entry.handle}</Link>
            ) : (
              <span>{entry.handle}</span>
            )}
            {enabled && entry.author_id === viewer?.id && (
              <>
                <button
                  disabled={busy}
                  onClick={() => {
                    setEditing(entry.id);
                    setText(entry.body);
                    setError("");
                    setOpen(true);
                  }}
                >
                  {t("place.edit")}
                </button>
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (submitting.current) return;
                    submitting.current = true;
                    setBusy(true);
                    setError("");
                    try {
                      await post("/api/community", {
                        action: "delete_comment",
                        id: entry.id,
                      });
                      setEntries((items) =>
                        items.filter((item) => item.id !== entry.id),
                      );
                      if (editing === entry.id) reset();
                    } catch (error) {
                      setError(t.message((error as Error).message));
                    } finally {
                      submitting.current = false;
                      setBusy(false);
                    }
                  }}
                >
                  {t("place.delete")}
                </button>
              </>
            )}
            {enabled && (
              <button disabled={busy} onClick={() => onReport(entry.id)}>
                {t("place.report")}
              </button>
            )}
          </div>
        </article>
      ))}
      {loading && (
        <p role="status" className="text-xs text-muted-foreground">
          {t("place.loadingNotes")}
        </p>
      )}
      {loadError && (
        <p role="alert" className="text-xs text-destructive">
          {loadError}{" "}
          <button
            onClick={() => setRevision((value) => value + 1)}
            className="underline"
          >
            {t("place.reload")}
          </button>
        </p>
      )}
      {!loading && !loadError && !place.rationale && entries.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {t("place.noNotesYetBeThe")}
        </p>
      )}
      {!open && !readOnly && !demo && publicPlace && !viewer && (
        <div className="introduction-helper text-muted-foreground">
          <Link href={loginHref} className="text-primary underline">
            {t("place.signInToAddA")}
          </Link>
        </div>
      )}
      {!readOnly && !demo && !publicPlace && (
        <p className="text-xs text-muted-foreground">
          {t("place.anyoneCanAddANote")}
        </p>
      )}
      {open && enabled && (
        <form
          className="space-y-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (submitting.current) return;
            submitting.current = true;
            setBusy(true);
            setError("");
            try {
              await post(`/api/map-places/${place.id}/introductions`, {
                body: text,
                ...(editing ? { id: editing } : {}),
              });
              reset();
              setRevision((value) => value + 1);
            } catch (error) {
              setError(t.message((error as Error).message));
            } finally {
              submitting.current = false;
              setBusy(false);
            }
          }}
        >
          <label htmlFor={`introduction-${place.id}`} className="text-sm">
            {editing ? t("place.editMyNote") : t("place.addAPlaceNote")}
          </label>
          <Textarea
            id={`introduction-${place.id}`}
            value={text}
            onChange={(event) => setText(event.target.value)}
            minLength={2}
            maxLength={1000}
            required
            disabled={busy}
            placeholder={t("place.tellUsWhatMakesThis")}
          />
          <p className="text-xs text-muted-foreground">
            {t("place.21000CharactersShown")}
          </p>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy}>
              {busy ? t("place.saving") : t("place.saveNote")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={reset}
            >
              {t("place.cancel")}
            </Button>
          </div>
        </form>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}
