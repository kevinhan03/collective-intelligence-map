import { Suspense } from "react";
import Link from "next/link";
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
  getMapPlaceById,
  getInitialPlaces,
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
async function MapContent({
  map,
  proposalId,
  submitted,
  created,
}: {
  map: Awaited<ReturnType<typeof getMap>>;
  proposalId: string | null;
  submitted: boolean;
  created: boolean;
}) {
  if (!map) return null;
  const [places, pendingPlaces, proposal] = await Promise.all([
    getInitialPlaces(map),
    getPendingPlaces(map),
    proposalId ? getMapPlaceById(map, proposalId) : null,
  ]);
  const publicPlaces = proposal && proposal.status !== "pending" && !places.some((p) => p.id === proposal.id)
    ? [proposal, ...places]
    : places;
  const allPending = proposal?.status === "pending" && !pendingPlaces.some((p) => p.id === proposal.id)
    ? [proposal, ...pendingPlaces]
    : pendingPlaces;
  return (
    <>
    {submitted && (proposal
      ? <ProposalNotice status={proposal.status} created={created} mapSlug={map.slug} id={proposal.id} />
      : <p role="status" className="mx-auto max-w-7xl px-6 py-3 text-sm text-primary">
          처리 상태가 변경됐을 수 있어요. <Link href="/my-proposals" className="underline">내 제안에서 확인하기</Link>
        </p>)}
    <CommunityExplorer
      map={map}
      initialPlaces={publicPlaces}
      pendingPlaces={allPending}
      viewer={null}
      myState={{ votes: {}, saves: [], followed: false }}
      config={rendererFor()}
      demo={!configured()}
    />
    </>
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
async function MapRoute({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [route, query] = await Promise.all([params, searchParams]);
  const map = await getMap(route.slug);
  if (!map) notFound();
  const proposalId = typeof query.proposal === "string" && /^[0-9a-f-]{36}$/i.test(query.proposal)
    ? query.proposal
    : null;
  return (
    <ViewerStateProvider key={map.id}>
      <Suspense fallback={null}>
        <Personalization mapId={map.id} />
      </Suspense>
      <Suspense fallback={<MapContentFallback />}>
        <MapContent map={map} proposalId={proposalId} submitted={query.submitted === "1"} created={query.created === "1"} />
      </Suspense>
    </ViewerStateProvider>
  );
}

export default function MapPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  return (
    <Suspense fallback={<MapContentFallback />}>
      <MapRoute params={params} searchParams={searchParams} />
    </Suspense>
  );
}
