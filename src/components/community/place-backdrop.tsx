"use client";
import { useCallback, useState } from "react";
import Image from "next/image";
import { photoImageUrl, type PhotoPage } from "@/domain/place-photo";
import { usePlaceResource } from "./place-resources";

/** Blurred first photo behind a place card's top; renders nothing without a photo. */
export function PlaceBackdrop({
  placeId,
  demo,
}: {
  placeId: string;
  demo: boolean;
}) {
  // Same key and request as PlacePhotos, so the shared cache serves both.
  const fetchPage = useCallback(
    async (signal: AbortSignal): Promise<PhotoPage> => {
      const response = await fetch(`/api/places/${placeId}/photos`, {
        signal,
      });
      if (!response.ok) throw new Error("사진을 불러오지 못했습니다.");
      return response.json();
    },
    [placeId],
  );
  const { data } = usePlaceResource(
    `photos:${placeId}`,
    !demo && Boolean(placeId),
    fetchPage,
  );
  const photo = data?.photos[0]?.id;
  const [loaded, setLoaded] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  if (!photo || failed === photo) return null;
  return (
    <div
      className="place-backdrop"
      data-loaded={loaded === photo}
      aria-hidden="true"
    >
      <Image
        key={photo}
        unoptimized
        src={photoImageUrl(photo, true)}
        alt=""
        fill
        sizes="400px"
        onLoad={() => setLoaded(photo)}
        onError={() => setFailed(photo)}
      />
    </div>
  );
}
