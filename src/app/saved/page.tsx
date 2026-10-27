import { redirect } from "next/navigation";
import { getMaps, getViewer, rendererFor } from "@/server/queries";
import { db } from "@/lib/supabase/server";
import {
  SavedPlaces,
  type SavedPlace,
} from "@/components/community/saved-places";
export default async function Saved() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { data, error } = await (await db()).rpc("saved_place_cards");
  if (error) throw new Error("저장 목록을 불러올 수 없습니다.");
  const cards = (data ?? []) as SavedPlace[];
  const maps = await getMaps();
  const saved = await (
    await db()
  )
    .from("map_follows")
    .select("map_id")
    .eq("user_id", viewer.id);
  if (saved.error) throw new Error("저장한 지도를 불러올 수 없습니다.");
  const savedIds = new Set((saved.data ?? []).map((row) => row.map_id));
  return (
    <SavedPlaces
      initialCards={cards}
      savedMaps={maps.filter((map) => savedIds.has(map.id))}
      maps={maps}
      config={rendererFor()}
    />
  );
}
// Keep authenticated flows blocking during the incremental cache migration.
export const instant = false;
