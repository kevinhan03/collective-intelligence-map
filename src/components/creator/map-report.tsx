"use client";
import { useState } from "react";
import { post } from "@/components/community/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n/client";
export function CreatorMapReport({
  mapId,
  admin = false,
}: {
  mapId: string;
  admin?: boolean;
}) {
  const { t } = useI18n();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [done, setDone] = useState(false);
  return (
    <details className="mt-6 border-t pt-4">
      <summary className="cursor-pointer text-xs text-muted-foreground">
        {t("creator.reportThisMap")}
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
            !window.confirm(t("creator.hideThisMapThisBlocks"))
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
            setError(t.message((e as Error).message));
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
          placeholder={t("creator.reasonForReport51")}
          aria-label={t("creator.reasonForReportingThisMap")}
        />
        <Button size="sm" value="report" disabled={busy || done}>
          {t("creator.sendReport")}
        </Button>
        {admin && (
          <Button
            size="sm"
            variant="outline"
            value="hide"
            disabled={busy || done}
          >
            {t("creator.hiddenByAdmin")}
          </Button>
        )}
        {error && (
          <p role="alert" className="text-xs">
            {error}
          </p>
        )}
        {done && (
          <p role="status" className="text-xs text-primary">
            {t("creator.reportReceived")}
          </p>
        )}
      </form>
    </details>
  );
}
