"use client";
import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { post } from "@/components/community/api";
import { useI18n } from "@/i18n/client";
export function AdminGateForm() {
  const { t } = useI18n();
  const [password, setPassword] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="max-w-sm space-y-4 rounded-xl border bg-card p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await post("/api/admin/usage/unlock", { password });
          router.refresh();
        } catch (e) {
          setError((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-sm">
        {t("admin.adminPassword")}
        <Input
          className="mt-2"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
        />
      </label>
      {error && (
        <p role="status" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <Button disabled={busy} size="sm" className="w-full">
        {t("admin.confirm")}
      </Button>
    </form>
  );
}
