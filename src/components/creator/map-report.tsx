"use client";
import { useState } from "react";
import { post } from "@/components/community/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
export function CreatorMapReport({
  mapId,
  admin = false,
}: {
  mapId: string;
  admin?: boolean;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  return (
    <details className="mt-6 border-t pt-4">
      <summary className="cursor-pointer text-xs text-muted-foreground">
        이 지도 신고하기
      </summary>
      <form
        className="mt-3 space-y-3"
        onSubmit={async (e) => {
          e.preventDefault();
          const reason = new FormData(e.currentTarget).get("reason");
          const action =
            (e.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ===
            "hide"
              ? "hide"
              : "report";
          if (
            action === "hide" &&
            !window.confirm(
              "이 지도를 숨길까요? 공개 링크와 커버 접근을 차단합니다.",
            )
          )
            return;
          setBusy(true);
          setError("");
          try {
            await post(`/api/creator/maps`, {
              action,
              mapId,
              reason,
            });
            setDone(true);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Textarea
          name="reason"
          minLength={5}
          maxLength={1000}
          required
          placeholder="신고 사유 (5~1,000자)"
          aria-label="지도 신고 사유"
        />
        <Button size="sm" value="report" disabled={busy || done}>
          신고 보내기
        </Button>
        {admin && (
          <Button
            size="sm"
            variant="outline"
            value="hide"
            disabled={busy || done}
          >
            관리자 지도 숨김
          </Button>
        )}
        {error && (
          <p role="alert" className="text-xs">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="text-xs text-primary">
            신고를 접수했어요.
          </p>
        )}
      </form>
    </details>
  );
}
