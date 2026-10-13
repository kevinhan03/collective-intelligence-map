"use client";
import Image from "next/image";
import { useState } from "react";

export function ProfileCardImage({
  src,
  theme = "travel",
}: {
  src?: string | null;
  theme?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const showPhoto = Boolean(src && failed !== src);
  return showPhoto ? (
    <Image
      unoptimized
      src={src!}
      alt=""
      width={640}
      height={400}
      className="profile-map-image"
      loading="lazy"
      onError={() => setFailed(src!)}
    />
  ) : (
    <div
      className="profile-card-gradient"
      data-theme={theme}
      aria-hidden="true"
    />
  );
}
