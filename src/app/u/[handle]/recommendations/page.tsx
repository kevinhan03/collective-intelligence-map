import { notFound } from "next/navigation";
import { connection } from "next/server";
import { configured } from "@/lib/supabase/server";
import { publicDb } from "@/lib/supabase/public";
import { recommendedPlaces } from "@/server/profile";
import { publicCreatorIdentity } from "@/server/creator";
import { getViewer, getMyState, rendererFor } from "@/server/queries";
import { RecommendationsExplorer } from "@/components/creator/recommendations-explorer";

export default async function RecommendationsPage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  if (!configured()) notFound();
  await connection();
  const { handle } = await params;
  const { data: profile, error } = await publicDb()
    .from("profiles")
    .select("id,handle")
    .eq("handle", handle)
    .maybeSingle();
  if (error) throw new Error("프로필을 불러오지 못했습니다.");
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
  const { handle } = await params;
  return {
    title: `${handle}님의 내가 추천한 장소`,
    description: "추천한 공개 장소를 목록과 하나의 지도에서 확인하세요.",
    alternates: {
      canonical: `/u/${encodeURIComponent(handle)}/recommendations`,
    },
  };
}
