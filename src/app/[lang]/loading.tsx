import { getTranslator } from "@/i18n/server";
export default async function Loading() {
  const t = await getTranslator();
  return (
    <main
      id="main"
      className="page-wrap animate-pulse space-y-6"
      aria-label={t("common.loading")}
    >
      <div className="h-10 w-64 rounded bg-muted" />
      <div className="h-80 rounded-xl bg-muted" />
    </main>
  );
}
