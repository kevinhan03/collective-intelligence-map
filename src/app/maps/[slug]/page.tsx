import { Suspense } from "react";
import { ProposalNotice } from "@/components/community/proposal-notice";
import {
  HydrateViewer,
  ViewerStateProvider,
} from "@/components/community/viewer-state";
import { notFound } from "next/navigation";
import {
  getMap,
  getMaps,
  getMyState,
  getPendingPlaces,
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
async function MapContent({ map }: { map: Awaited<ReturnType<typeof getMap>> }) {
  if (!map) return null;
  const [places, pendingPlaces] = await Promise.all([
    getPlaces(map),
    getPendingPlaces(map),
  ]);
  return (
    <CommunityExplorer
      map={map}
      initialPlaces={places}
      pendingPlaces={pendingPlaces}
      viewer={null}
      myState={{ votes: {}, saves: [], followed: false }}
      config={rendererFor()}
      demo={!configured()}
    />
  );
}

function MapContentFallback() {
  return (
    <main id="main" className="page-wrap animate-pulse space-y-6" aria-label="지도 불러오는 중">
      <div className="h-10 w-64 rounded bg-muted" />
      <div className="h-80 rounded-xl bg-muted" />
    </main>
  );
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
  return (
    <ViewerStateProvider key={map.id}>
      <Suspense fallback={null}>
        <ProposalNotice />
      </Suspense>
      <Suspense fallback={null}>
        <Personalization mapId={map.id} />
      </Suspense>
      <Suspense fallback={<MapContentFallback />}>
        <MapContent map={map} />
      </Suspense>
    </ViewerStateProvider>
  );
}
