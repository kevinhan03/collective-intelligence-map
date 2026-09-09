export const providerPolicies = {
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
    requiredRenderer: "kakao",
  },
} as const;
