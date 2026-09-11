import { Suspense } from "react";
import {
  HydrateViewer,
  ViewerStateProvider,
} from "@/components/community/viewer-state";
import { notFound } from "next/navigation";
import {
  getMap,
  getMaps,
  getMyState,
  getPlaces,
  getViewer,
  rendererFor,
} from "@/server/queries";
import { configured } from "@/lib/supabase/server";
import { CommunityExplorer } from "@/components/community/community-explorer";
export async function generateStaticParams() {
  return (await getMaps()).map((map) => ({ slug: map.slug }));
}
async function Personalization({ mapId }: { mapId: string }) {
  const [viewer, myState] = await Promise.all([getViewer(), getMyState(mapId)]);
  return <HydrateViewer state={{ viewer, myState }} />;
}
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
  const places = await getPlaces(map);
  return (
    <ViewerStateProvider key={map.id}>
      <Suspense fallback={null}>
        <Personalization mapId={map.id} />
      </Suspense>
      <CommunityExplorer
        map={map}
        initialPlaces={places}
        viewer={null}
        myState={{ votes: {}, saves: [], followed: false }}
        config={rendererFor(map)}
        demo={!configured()}
      />
    </ViewerStateProvider>
  );
}
