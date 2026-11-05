import { z } from "zod";
import { notFound, redirect } from "next/navigation";
import { ownerMap, creatorPlaces } from "@/server/creator";
import { getViewer, rendererFor } from "@/server/queries";
import { CommunityExplorer } from "@/components/community/community-explorer";
export default async function Preview({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=%2Fstudio");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const map = await ownerMap(id.data);
  const places = await creatorPlaces(map.id, true);
  return (
    <CommunityExplorer
      map={{
        ...map,
        creator_handle: viewer.handle,
        place_count: places.length,
      }}
      initialPlaces={places}
      pendingPlaces={[]}
      viewer={viewer}
      myState={{ votes: {}, saves: [], followed: false }}
      config={rendererFor()}
      demo={false}
      readOnly
    />
  );
}
export const instant = false;
