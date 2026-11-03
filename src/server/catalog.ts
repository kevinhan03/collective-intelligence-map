import "server-only";
import { db } from "@/lib/supabase/server";
import { buildCatalog } from "@/domain/map-catalog";
import { type CatalogSetting } from "@/domain/catalog-admin";
import { getMaps, getCatalogRegions, getViewer } from "./queries";
import { HttpError } from "./http";

export { readCatalogSettings, resolveEditorial } from "./catalog-read";
import { resolveEditorial } from "./catalog-read";

export async function requireCatalogAdmin() {
  const viewer = await getViewer();
  if (!viewer) throw new HttpError("로그인이 필요합니다.", 401);
  if (viewer.role !== "admin")
    throw new HttpError("관리자 권한이 필요합니다.", 403);
  return viewer;
}
export function catalogDbError(
  error: { code?: string; message: string } | null,
) {
  if (!error) return;
  if (error.code === "40001")
    throw new HttpError(
      "다른 관리자가 수정한 내용이 있습니다. 최신 내용을 확인해 주세요.",
      409,
    );
  if (error.code === "42501")
    throw new HttpError("관리자 권한이 필요합니다.", 403);
  if (error.code === "P0001") throw new HttpError(error.message, 400);
  throw new HttpError(
    "홈 설정을 처리하지 못했습니다. 연결과 마이그레이션을 확인해 주세요.",
    503,
  );
}
export async function getPublicCatalog() {
  const maps = await getMaps();
  return buildCatalog(
    maps,
    await getCatalogRegions(maps),
    Object.fromEntries(
      maps.filter((m) => m.editorial).map((m) => [m.slug, m.editorial!]),
    ),
  );
}
export async function getCatalogAdminSnapshot() {
  await requireCatalogAdmin();
  const { data, error } = await (
    await db()
  ).rpc("admin_catalog_command", { payload: { action: "snapshot" } });
  catalogDbError(error);
  const settings = data as unknown as CatalogSetting[];
  const maps = await getMaps();
  return {
    maps: buildCatalog(
      maps,
      await getCatalogRegions(maps),
      resolveEditorial(maps, settings),
    ),
    settings,
  };
}
