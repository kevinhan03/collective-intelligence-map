import { revalidateTag } from "next/cache";
import { db } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { catalogBatchSchema } from "@/domain/catalog-admin";
import {
  getCatalogAdminSnapshot,
  requireCatalogAdmin,
  catalogDbError,
} from "@/server/catalog";
import { body, failure, json } from "@/server/http";
export async function GET() {
  try {
    return json(await getCatalogAdminSnapshot());
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    await requireCatalogAdmin();
    const { changes } = catalogBatchSchema.parse(
      await body(request, 256 * 1024),
    );
    const { error } = await (
      await db()
    ).rpc("admin_catalog_command", {
      payload: { action: "apply", changes } as Json,
    });
    catalogDbError(error);
    revalidateTag("public-community", { expire: 0 });
    // Once committed, return success independently of a subsequent snapshot read.
    return json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
