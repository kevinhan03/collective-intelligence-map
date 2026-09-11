import { productEvent } from "@/server/events";
import { notFound } from "next/navigation";
import {
  getMap,
  getMyState,
  getPlaces,
  getViewer,
  rendererFor,
} from "@/server/queries";
import { configured } from "@/lib/supabase/server";
import { CommunityExplorer } from "@/components/community/community-explorer";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const map = await getMap((await params).slug);
  if (!map) return { title: "Theme Map" };
  return {
    title: map.title,
    description: map.description,
    openGraph: { title: map.title, description: map.description },
    twitter: { title: map.title, description: map.description },
  };
}
export default async function MapPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const map = await getMap((await params).slug);
  if (!map) notFound();
  if (configured()) productEvent("map_view", { mapId: map.id });
  const [places, viewer, myState] = await Promise.all([
    getPlaces(map),
    getViewer(),
    getMyState(map.id),
  ]);
  return (
    <CommunityExplorer
      map={map}
      initialPlaces={places}
      viewer={viewer}
      myState={myState}
      config={rendererFor(map)}
      demo={!configured()}
    />
  );
}
