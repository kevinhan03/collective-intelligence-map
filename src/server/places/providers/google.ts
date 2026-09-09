import "server-only";
import { z } from "zod";
import type { PlaceProvider } from "./types";
import { providerFetch } from "./types";
const predictions = z.object({
  suggestions: z
    .array(
      z.object({
        placePrediction: z
          .object({ placeId: z.string(), text: z.object({ text: z.string() }) })
          .optional(),
      }),
    )
    .default([]),
});
export const GOOGLE_DETAILS_MASK = "id,location";
export function googleProvider(key: string): PlaceProvider {
  return {
    async search(query, { map, session }) {
      const result = predictions.parse(
        await providerFetch(
          "https://places.googleapis.com/v1/places:autocomplete",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": key,
              "X-Goog-FieldMask":
                "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
            },
            body: JSON.stringify({
              input: query,
              sessionToken: session,
              languageCode: "ko",
              includedRegionCodes: [map.country.toLowerCase()],
              locationRestriction: {
                rectangle: {
                  low: {
                    latitude: map.bounds.south,
                    longitude: map.bounds.west,
                  },
                  high: {
                    latitude: map.bounds.north,
                    longitude: map.bounds.east,
                  },
                },
              },
            }),
          },
        ),
      );
      return result.suggestions.flatMap((s) =>
        s.placePrediction
          ? [
              {
                provider: "google" as const,
                externalId: s.placePrediction.placeId,
                label: s.placePrediction.text.text,
                attribution: "Google Maps",
              },
            ]
          : [],
      );
    },
    async details(candidate, { session }) {
      const result = z
        .object({
          id: z.string(),
          location: z.object({ latitude: z.number(), longitude: z.number() }),
        })
        .parse(
          await providerFetch(
            `https://places.googleapis.com/v1/places/${encodeURIComponent(candidate.externalId)}?sessionToken=${encodeURIComponent(session)}`,
            {
              headers: {
                "X-Goog-Api-Key": key,
                "X-Goog-FieldMask": GOOGLE_DETAILS_MASK,
              },
            },
          ),
        );
      return {
        ...candidate,
        externalId: result.id,
        lat: result.location.latitude,
        lng: result.location.longitude,
      };
    },
  };
}
