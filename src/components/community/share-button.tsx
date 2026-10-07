"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ShareButton({ path, title }: { path: string; title: string }) {
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
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={share}
        aria-label={`${title} 공유`}
      >
        <Share2 size={14} aria-hidden="true" /> 공유
      </Button>
      {message && (
        <span role="status" className="text-xs text-muted-foreground">
          {message}
        </span>
      )}
    </span>
  );
}
