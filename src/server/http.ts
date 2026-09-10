import { sameOrigin } from "@/domain/request-origin";
import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getViewer } from "./queries";
export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) throw new HttpError("로그인이 필요합니다.", 401);
  return viewer;
}
export function json(data: unknown, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
export function failure(error: unknown) {
  if (error instanceof ZodError)
    return json(
      { error: error.issues[0]?.message ?? "입력을 확인해 주세요." },
      400,
    );
  if (error instanceof HttpError)
    return json({ error: error.message }, error.status);
  console.error(
    "request_failed",
    error instanceof Error ? error.name : "UnknownError",
  );
  return json(
    { error: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요." },
    500,
  );
}
export async function body(request: Request) {
  if (
    !sameOrigin(
      request.headers.get("origin"),
      request.url,
      process.env.NEXT_PUBLIC_SITE_URL,
    )
  )
    throw new HttpError("허용되지 않은 요청입니다.", 403);
  const raw = await request.text();
  if (raw.length > 12000) throw new HttpError("요청이 너무 큽니다.", 413);
  try {
    return JSON.parse(raw);
  } catch {
    throw new HttpError("올바른 요청 형식이 아닙니다.");
  }
}
export function dbError(error: { code?: string; message: string } | null) {
  if (error)
    throw new HttpError(
      error.code === "23505"
        ? "이미 등록된 장소 또는 사용 중인 이름입니다."
        : error.code === "42501"
          ? "이 작업에 대한 권한이 없습니다."
          : error.code === "P0001"
            ? error.message
            : "입력을 확인해 주세요.",
      error.code === "42501" ? 403 : 400,
    );
}
