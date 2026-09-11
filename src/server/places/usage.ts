import "server-only";
import { serviceDb } from "@/lib/supabase/admin";
import { HttpError } from "@/server/http";
// USD micros at the current Google list price, before the monthly free cap and
// volume discounts. This is a safety reservation, not an invoice estimate.
const estimates = { autocomplete: 2830, details: 5000, keyword: 0 };
export async function metered<T>(
  args: {
    provider: string;
    operation: keyof typeof estimates;
    userId: string;
    mapId: string;
    session: string;
  },
  run: () => Promise<T>,
): Promise<T> {
  const client = serviceDb();
  const { data: id, error } = await client.rpc("reserve_provider", {
    p: args.provider,
    op: args.operation,
    u: args.userId,
    m: args.mapId,
    session_id: args.session,
    cost: estimates[args.operation],
  });
  if (error)
    throw new HttpError(
      error.code === "P0001"
        ? error.message
        : "외부 검색 요청을 시작할 수 없습니다.",
      429,
    );
  const started = Date.now();
  let status = "error";
  try {
    const data = await run();
    status = "ok";
    return data;
  } catch {
    throw new HttpError(
      "장소 검색 서비스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      502,
    );
  } finally {
    const { error } = await client.rpc("finish_provider", {
      r: id,
      result: status,
      ms: Date.now() - started,
    });
    if (error) console.error("provider_log_finalize_failed");
  }
}
