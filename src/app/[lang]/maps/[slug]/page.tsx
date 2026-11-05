import { Suspense } from "react";
import Link from "@/i18n/link";
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
import { mapSearchTitle } from "@/domain/seo";
import { noIndex, ogImage } from "@/lib/seo";
import { getLocale, getTranslator } from "@/i18n/server";
import { localeAlternates } from "@/i18n/metadata";
import { localizePath } from "@/i18n/config";
import { getPublicPlace } from "@/server/seo-queries";
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
  linkedPlaceId,
  submitted,
  created,
}: {
  map: Awaited<ReturnType<typeof getMap>>;
  proposalId: string | null;
  linkedPlaceId: string | null;
  submitted: boolean;
  created: boolean;
}) {
  const t = await getTranslator();
  if (!map) return null;
  const [places, pendingPlaces, proposal, linkedPlace] = await Promise.all([
    getInitialPlaces(map),
    getPendingPlaces(map),
    proposalId ? getMapPlaceById(map, proposalId) : null,
    linkedPlaceId ? getPublicPlace(map.id, linkedPlaceId) : null,
  ]);
  const linkedPlaces =
    linkedPlace && !places.some((p) => p.place_id === linkedPlace.place_id)
      ? [linkedPlace, ...places]
      : places;
  const publicPlaces =
    proposal &&
    proposal.status !== "pending" &&
    !linkedPlaces.some((p) => p.id === proposal.id)
      ? [proposal, ...linkedPlaces]
      : linkedPlaces;
  const allPending =
    proposal?.status === "pending" &&
    !pendingPlaces.some((p) => p.id === proposal.id)
      ? [proposal, ...pendingPlaces]
      : pendingPlaces;
  return (
    <>
      {submitted &&
        (proposal ? (
          <ProposalNotice
            status={proposal.status}
            created={created}
            mapSlug={map.slug}
            id={proposal.id}
          />
        ) : (
          <p
            role="status"
            className="mx-auto max-w-7xl px-6 py-3 text-sm text-primary"
          >
            {t("pages.theReviewStatusMayHave")}{" "}
            <Link href="/my-proposals" className="underline">
              {t("pages.checkMySuggestions")}
            </Link>
          </p>
        ))}
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

async function MapContentFallback() {
  const t = await getTranslator();
  return (
    <main
      id="main"
      className="page-wrap animate-pulse space-y-6"
      aria-label={t("pages.loadingMap")}
    >
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
  const [map, t, lang] = await Promise.all([
    params.then(({ slug }) => getMap(slug)),
    getTranslator(),
    getLocale(),
  ]);
  if (!map) return { title: t("meta.mapNotFound"), robots: noIndex };
  const images =
    map.kind === "creator" && map.cover_path
      ? [`/maps/${map.slug}/cover`]
      : [ogImage];
  return {
    title: mapSearchTitle(map),
    description: map.description,
    alternates: localeAlternates(`/maps/${map.slug}`, lang),
    openGraph: {
      title: mapSearchTitle(map),
      description: map.description,
      url: localizePath(`/maps/${map.slug}`, lang),
      images,
    },
    twitter: {
      title: mapSearchTitle(map),
      description: map.description,
      images,
    },
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
  const proposalId =
    typeof query.proposal === "string" &&
    /^[0-9a-f-]{36}$/i.test(query.proposal)
      ? query.proposal
      : null;
  return (
    <ViewerStateProvider key={map.id}>
      <Suspense fallback={null}>
        <Personalization mapId={map.id} />
      </Suspense>
      <Suspense fallback={<MapContentFallback />}>
        <MapContent
          map={map}
          proposalId={proposalId}
          linkedPlaceId={typeof query.place === "string" ? query.place : null}
          submitted={query.submitted === "1"}
          created={query.created === "1"}
        />
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
