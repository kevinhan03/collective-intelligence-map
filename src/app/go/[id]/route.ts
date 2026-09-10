import { NextResponse } from "next/server";
import { z } from "zod";
import { db, configured } from "@/lib/supabase/server";

import { productEvent } from "@/server/events";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success || !configured())
    return new Response("Not found", { status: 404 });
  const client = await db();
  const { data: place, error } = await client
    .from("map_place_cards")
    .select("id,map_id,lat,lng")
    .eq("id", parsed.data)
    .maybeSingle();
  if (
    error ||
    !place?.id ||
    !place.map_id ||
    place.lat === null ||
    place.lng === null
  )
    return new Response("Not found", { status: 404 });
  productEvent("external_map_open", {
    mapId: place.map_id,
    mapPlaceId: place.id,
  });
  const target = new URL("https://www.google.com/maps/search/");
  target.searchParams.set("api", "1");
  target.searchParams.set("query", `${place.lat},${place.lng}`);
  return NextResponse.redirect(target, 303);
}
