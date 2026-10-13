import { notFound } from "next/navigation";
import { connection } from "next/server";
import { creatorCatalog, publicCreatorIdentity } from "@/server/creator";
import { publicDb } from "@/lib/supabase/public";
import { canIndex, noIndex } from "@/lib/seo";
import { configured } from "@/lib/supabase/server";
import { ProfilePresentation } from "@/components/creator/profile-presentation";
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
  const { handle } = await params;
  const maps = (await creatorCatalog()).filter(
    (item) => item.handle === handle,
  );
  const p = maps[0]?.profile;
  return {
    title: `${p?.display_name || handle}의 장소 지도`,
    description: "크리에이터가 직접 고른 장소를 지도에서 찾아보세요.",
    alternates: { canonical: `/u/${handle}` },
    robots: canIndex && maps.length ? { index: true, follow: true } : noIndex,
    openGraph: {
      title: `${p?.display_name || handle}의 장소 지도`,
      url: `/u/${handle}`,
      images: maps[0]?.map.cover_path
        ? [`/maps/${maps[0].map.slug}/cover`]
        : undefined,
    },
  };
}
