export const providerPolicies = {
  overture: {
    persistedFields: ["externalId"],
    cacheSeconds: 0,
    policyUrl: "https://docs.overturemaps.org/attribution/",
    reviewedAt: "2026-09-15",
    requiredRenderer: null,
  },
  google: {
    reviewedAt: "2026-09-10",
    policyUrl:
      "https://developers.google.com/maps/documentation/places/web-service/policies",
    persistedFields: ["externalId"],
    cacheSeconds: 0,
    requiredRenderer: "google",
  },
  kakao: {
    reviewedAt: "2026-09-10",
    policyUrl: "https://developers.kakao.com/terms/ko/site-terms",
    persistedFields: [],
    cacheSeconds: 0,
    requiredRenderer: null,
  },
} as const;

export function mayPersistReference(provider: "google" | "kakao" | "overture") {
  return (
    providerPolicies[provider].persistedFields.some(
      (field) => field === "externalId",
    ) ||
    (provider === "kakao" && process.env.KAKAO_REF_STORAGE_ALLOWED === "true")
  );
}

/** Default deny: a reference permission does not authorize copying place fields. */
export function mayPersistPlaceFields(
  provider: "google" | "kakao" | "overture",
) {
  return (
    provider === "overture" ||
    (provider === "kakao" &&
      process.env.KAKAO_PLACE_STORAGE_ALLOWED === "true" &&
      process.env.KAKAO_REF_STORAGE_ALLOWED === "true")
  );
}
