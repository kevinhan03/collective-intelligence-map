import { z } from "zod";
import { revalidateTag } from "next/cache";
import { db } from "@/lib/supabase/server";
import { configured } from "@/lib/supabase/server";
import { publicDb } from "@/lib/supabase/public";
import { getViewer } from "@/server/queries";
import { body, dbError, failure, HttpError, json } from "@/server/http";
const input = z.object({
  action: z.enum(["hype", "save_map"]),
  id: z.uuid(),
  enabled: z.boolean(),
});
export async function GET() {
  try {
    if (!configured())
      return json({ viewerId: null, saved: [], hyped: [], hypeCreatedAt: {} });
    const viewer = await getViewer();
    if (!viewer)
      return json({ viewerId: null, saved: [], hyped: [], hypeCreatedAt: {} });
    const client = await db();
    const [saved, hyped] = await Promise.all([
      client.from("map_follows").select("map_id").eq("user_id", viewer.id),
      client
        .from("map_hypes")
        .select("map_id,created_at")
        .eq("user_id", viewer.id)
        .eq("enabled", true),
    ]);
    dbError(saved.error);
    dbError(hyped.error);
    return json({
      viewerId: viewer.id,
      saved: (saved.data ?? []).map((row) => row.map_id),
      hyped: (hyped.data ?? []).map((row) => row.map_id),
      hypeCreatedAt: Object.fromEntries(
        (hyped.data ?? []).map((row) => [row.map_id, row.created_at]),
      ),
    });
  } catch (error) {
    return failure(error);
  }
}
export async function POST(request: Request) {
  try {
    const payload = input.parse(await body(request));
    if (!(await getViewer())) throw new HttpError("로그인이 필요합니다.", 401);
    const client = await db();
    if (payload.action === "hype") {
      const result = await client.rpc("set_map_hype", {
        p_map: payload.id,
        p_enabled: payload.enabled,
      });
      dbError(result.error);
      revalidateTag("public-community", { expire: 0 });
      return json(result.data);
    }
    const changed = await client.rpc("community_command", {
      payload: { action: "follow", id: payload.id, enabled: payload.enabled },
    });
    dbError(changed.error);
    revalidateTag("public-community", { expire: 0 });
    const stats = await publicDb().rpc("map_engagement_stats");
    // A confirmed save must not be reported as failed just because count refresh failed.
    return json({
      saved: payload.enabled,
      ...(stats.data?.find((row) => row.map_id === payload.id) ?? {}),
    });
  } catch (error) {
    return failure(error);
  }
}
