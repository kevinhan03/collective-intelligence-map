"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareButton({
  path,
  title,
  iconOnly = false,
}: {
  path: string;
  title: string;
  iconOnly?: boolean;
}) {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function share() {
    setBusy(true);
    setMessage("");
    const url = new URL(path, window.location.origin).toString();
    try {
      if (window.matchMedia("(max-width: 1023px)").matches && navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setMessage("링크를 복사했어요.");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError"))
        setMessage("공유하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <span
      className={
        iconOnly
          ? "detail-share-action"
          : "inline-flex flex-col items-start gap-1"
      }
    >
      <Button
        type="button"
        size={iconOnly ? "icon" : "sm"}
        variant={iconOnly ? "ghost" : "outline"}
        className={iconOnly ? "detail-icon-action" : undefined}
        disabled={busy}
        onClick={share}
        aria-label={`${title} 공유`}
      >
        <Share2 size={iconOnly ? 21 : 14} aria-hidden="true" />
        {!iconOnly && "공유"}
      </Button>
      {message && (
        <span
          role="status"
          className={
            iconOnly ? "detail-share-feedback" : "text-xs text-muted-foreground"
          }
        >
          {message}
        </span>
      )}
    </span>
  );
}
