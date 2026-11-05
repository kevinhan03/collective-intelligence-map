import Link from "@/i18n/link";
import { redirect } from "next/navigation";
import { localizedPath } from "@/i18n/server";
import { z } from "zod";
import { db } from "@/lib/supabase/server";
import { getViewer } from "@/server/queries";

import { getLocale, getTranslator } from "@/i18n/server";
import { intlLocale } from "@/i18n/config";
const proposal = z.object({
  id: z.uuid(),
  place_id: z.uuid(),
  status: z.string(),
  rationale: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  name: z.string(),
  address: z.string(),
  map_slug: z.string(),
  map_title: z.string(),
  rejection_reason: z.string().nullable(),
  reviewed_at: z.string().nullable(),
});

export default async function MyProposals({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const [t, lang] = await Promise.all([getTranslator(), getLocale()]);
  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString(intlLocale(lang));
  const viewer = await getViewer();
  if (!viewer) redirect(await localizedPath("/login?next=%2Fmy-proposals"));
  const requested = Number((await searchParams).page ?? "1");
  const page =
    Number.isSafeInteger(requested) && requested > 0 && requested <= 100000
      ? requested
      : 1;
  const { data, error } = await (
    await db()
  ).rpc("my_proposals", { page_num: page });
  if (error) throw new Error(t("pages.couldnTLoadYourSuggestions"));
  const rows = z.array(proposal).parse(data);
  const hasNext = rows.length > 20;
  const items = rows.slice(0, 20);

  return (
    <main id="main" className="page-wrap max-w-3xl">
      <p className="kicker mb-3">My proposals</p>
      <h1 className="text-3xl font-semibold">{t("pages.mySuggestions")}</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {t("pages.seeTheReviewStatusAnd")}
      </p>
      {items.length === 0 ? (
        <div className="mt-8 rounded-xl border bg-card p-6 text-sm">
          {page === 1
            ? t("pages.youHavenTSuggestedAny")
            : t("pages.noSuggestionsOnThisPage")}{" "}
          <Link href="/discover" className="text-primary underline">
            {t("pages.browseMaps")}
          </Link>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{item.name}</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.map_title} · {item.address}
                  </p>
                </div>
                <span className="rounded-full border px-3 py-1 text-xs">
                  {t.data("proposalStatus", item.status)}
                </span>
              </div>
              <p className="mt-3 text-sm">{item.rationale}</p>
              <p className="mt-3 text-xs text-muted-foreground">
                {t("pages.suggestedOn", { date: formatDate(item.created_at) })}
                {item.reviewed_at &&
                  t("pages.reviewedOn", { date: formatDate(item.reviewed_at) })}
              </p>
              {item.status === "rejected" && item.rejection_reason && (
                <p className="mt-3 rounded-lg bg-secondary p-3 text-sm">
                  {t("pages.rejectionReason", {
                    reason: item.rejection_reason,
                  })}
                </p>
              )}
              {["pending", "approved", "disputed"].includes(item.status) && (
                <Link
                  href={`/maps/${item.map_slug}?proposal=${item.id}`}
                  className="mt-3 inline-block text-sm text-primary underline"
                >
                  {t("pages.viewOnMap")}
                </Link>
              )}
            </article>
          ))}
        </div>
      )}
      <nav
        aria-label={t("pages.mySuggestionsPages")}
        className="mt-6 flex justify-between text-sm"
      >
        {page > 1 ? (
          <Link href={`/my-proposals?page=${page - 1}`} className="underline">
            {t("pages.previous")}
          </Link>
        ) : (
          <span />
        )}
        {hasNext && (
          <Link href={`/my-proposals?page=${page + 1}`} className="underline">
            {t("pages.next")}
          </Link>
        )}
      </nav>
    </main>
  );
}

export const instant = false;
