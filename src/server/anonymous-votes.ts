import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";

export const anonymousVoteCookie = "collective_vote_token";

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
