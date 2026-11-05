"use client";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useI18n();
  return (
    <main id="main" className="page-wrap py-24 text-center">
      <h1 className="text-2xl font-semibold">{t("error.title")}</h1>
      <p className="my-5 text-muted-foreground">{t("error.body")}</p>
      <Button onClick={reset}>{t("common.retry")}</Button>
    </main>
  );
}
