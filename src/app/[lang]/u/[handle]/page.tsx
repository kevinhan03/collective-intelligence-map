import { notFound } from "next/navigation";
import { connection } from "next/server";
import { creatorCatalog, publicCreatorIdentity } from "@/server/creator";
import { publicDb } from "@/lib/supabase/public";
import { canIndex, noIndex } from "@/lib/seo";
import { configured } from "@/lib/supabase/server";
import { ProfilePresentation } from "@/components/creator/profile-presentation";
import { getLocale, getTranslator } from "@/i18n/server";
import { localeAlternates } from "@/i18n/metadata";
import { localizePath } from "@/i18n/config";
import { recommendedPlaces } from "@/server/profile";
export default async function PublicProfile({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  if (!configured()) notFound();
  await connection();
  const { handle } = await params;
  const client = publicDb();
  const { data: profile } = await client
    .from("profiles")
    .select("id,handle,bio")
    .eq("handle", handle)
    .maybeSingle();
  if (!profile) notFound();
  const [catalog, identity, contributions] = await Promise.all([
    creatorCatalog(),
    publicCreatorIdentity(profile.id),
    recommendedPlaces(profile.id),
  ]);
  const own = catalog.filter((c) => c.handle === handle);
  return (
    <main id="main" className="page-wrap profile-page profile-public-page">
      <ProfilePresentation
        handle={profile.handle}
        displayName={identity?.display_name}
        instagram={identity?.instagram}
        bio={profile.bio}
        maps={own.map((c) => c.map)}
        featuredId={own[0]?.profile?.featured_map_id}
        recommendationCount={contributions.length}
      />
    </main>
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
  const maps = (await creatorCatalog()).filter(
    (item) => item.handle === handle,
  );
  const p = maps[0]?.profile;
  return {
    title: t("meta.creatorMaps", { name: p?.display_name || handle }),
    description: t("meta.creatorMapsDescription"),
    alternates: localeAlternates(`/u/${handle}`, lang),
    robots: canIndex && maps.length ? { index: true, follow: true } : noIndex,
    openGraph: {
      title: t("meta.creatorMaps", { name: p?.display_name || handle }),
      url: localizePath(`/u/${handle}`, lang),
      images: maps[0]?.map.cover_path
        ? [`/maps/${maps[0].map.slug}/cover`]
        : undefined,
    },
  };
}
