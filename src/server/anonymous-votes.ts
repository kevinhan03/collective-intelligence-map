import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

export const anonymousVoteCookie = "collective_vote_token";
const maxAge = 60 * 60 * 24 * 365;

function validToken(value: string | undefined) {
  return Boolean(value && /^[A-Za-z0-9_-]{43}$/.test(value));
}

export function anonymousVoteHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function storedAnonymousVoteHash() {
  const token = (await cookies()).get(anonymousVoteCookie)?.value;
  return token && validToken(token) ? anonymousVoteHash(token) : null;
}

export async function ensureAnonymousVoteHash() {
  const jar = await cookies();
  const current = jar.get(anonymousVoteCookie)?.value;
  if (current && validToken(current)) return anonymousVoteHash(current);
  const token = randomBytes(32).toString("base64url");
  jar.set(anonymousVoteCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
  return anonymousVoteHash(token);
}
