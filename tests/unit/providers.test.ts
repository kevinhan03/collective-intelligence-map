import { afterEach, describe, expect, it, vi } from "vitest";
import {
  googleProvider,
  GOOGLE_DETAILS_MASK,
} from "@/server/places/providers/google";
import { kakaoProvider } from "@/server/places/providers/kakao";
import {
  signCandidate,
  verifyCandidate,
} from "@/server/places/candidate-token";
import { demoMap } from "@/server/demo";
const session = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const user = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("provider boundaries", () => {
  it("uses Google New server API, session, region and minimal FieldMask", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          suggestions: [
            {
              placePrediction: { placeId: "abc", text: { text: "Example" } },
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const result = await googleProvider("SECRET").search("test", {
      map: demoMap,
      session,
    });
    expect(result[0].externalId).toBe("abc");
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe("https://places.googleapis.com/v1/places:autocomplete");
    const payload = JSON.parse(init.body);
    expect(payload.sessionToken).toBe(session);
    expect(payload.includedRegionCodes).toEqual(["jp"]);
    expect(init.cache).toBe("no-store");
    expect(JSON.stringify(result)).not.toContain("SECRET");
    expect(GOOGLE_DETAILS_MASK).toBe(
      "id,displayName,formattedAddress,location",
    );
  });
  it("rejects malformed provider data", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ suggestions: "bad" })),
        ),
    );
    await expect(
      googleProvider("secret").search("test", { map: demoMap, session }),
    ).rejects.toThrow();
  });
  it("Kakao search authenticates via header and details add no call", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          documents: [
            {
              id: "1",
              place_name: "예시",
              address_name: "주소",
              x: "127",
              y: "37",
            },
          ],
        }),
      ),
    );
    vi.stubGlobal("fetch", fetch);
    const provider = kakaoProvider("SECRET");
    const result = await provider.search("예시", {
      map: { ...demoMap, country: "KR" },
      session,
    });
    await provider.details(result[0], { map: demoMap, session });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe("KakaoAK SECRET");
  });
  it("rejects tampering, cross-user tokens and expired selection", () => {
    vi.stubEnv("PROVIDER_SIGNING_SECRET", "x".repeat(32));
    const claims = {
      provider: "google" as const,
      externalId: "abc",
      userId: user,
      mapId: demoMap.id,
      session,
      expires: Date.now() + 60000,
      selected: true,
    };
    const token = signCandidate(claims);
    expect(verifyCandidate(token, user, demoMap.id).externalId).toBe("abc");
    expect(() => verifyCandidate(token + "X", user, demoMap.id)).toThrow();
    expect(() => verifyCandidate(token, session, demoMap.id)).toThrow();
    expect(() =>
      verifyCandidate(
        signCandidate({ ...claims, expires: 1 }),
        user,
        demoMap.id,
      ),
    ).toThrow();
  });
});
