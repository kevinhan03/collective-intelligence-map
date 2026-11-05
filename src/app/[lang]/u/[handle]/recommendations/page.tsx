import { notFound } from "next/navigation";
import { connection } from "next/server";
import { configured } from "@/lib/supabase/server";
import { publicDb } from "@/lib/supabase/public";
import { recommendedPlaces } from "@/server/profile";
import { publicCreatorIdentity } from "@/server/creator";
import { getViewer, getMyState, rendererFor } from "@/server/queries";
import { RecommendationsExplorer } from "@/components/creator/recommendations-explorer";

import { getLocale, getTranslator } from "@/i18n/server";
import { localeAlternates } from "@/i18n/metadata";
export default async function RecommendationsPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const t = await getTranslator();
  if (!configured()) notFound();
  await connection();
  const { handle } = await params;
  const { data: profile, error } = await publicDb()
    .from("profiles")
    .select("id,handle")
    .eq("handle", handle)
    .maybeSingle();
  if (error) throw new Error(t("pages.couldnTLoadThisProfile"));
  if (!profile) notFound();
  const [places, identity, viewer] = await Promise.all([
    recommendedPlaces(profile.id),
    publicCreatorIdentity(profile.id),
    getViewer(),
  ]);
  const state =
    viewer && places.length
      ? await getMyState(places[0].map_id)
      : { saves: [], votes: {} };
  return (
    <RecommendationsExplorer
      handle={profile.handle}
      displayName={identity?.display_name || profile.handle}
      places={places}
      config={rendererFor()}
      viewer={viewer}
      myState={state}
    />
  );
}
export const instant = false;
export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const [{ handle }, t, lang] = await Promise.all([
    params,
    getTranslator(),
    getLocale(),
  ]);
  return {
    title: t("meta.recommendations", { handle }),
    description: t("meta.recommendationsDescription"),
    alternates: localeAlternates(
      `/u/${encodeURIComponent(handle)}/recommendations`,
      lang,
    ),
  };
}
