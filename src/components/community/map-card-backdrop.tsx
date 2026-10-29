"use client";
import Image from "next/image";
import { useState } from "react";
import { catalogEditorial } from "@/domain/catalog-config";

const cardPalettes = [
  ["#bd794f", "#533b54", "#1b2829"],
  ["#627d9b", "#59476c", "#202c39"],
  ["#8b9857", "#6d6050", "#242c2b"],
  ["#b56b70", "#744d72", "#252b40"],
  ["#9b8660", "#526c70", "#1e3037"],
] as const;

// Editorial images for the currently curated maps. New maps use the stable
// palette fallback below until an intentional image is selected.

export function MapCardBackdrop({
  slug,
  sharp = false,
  eager = false,
}: {
  slug: string;
  sharp?: boolean;
  eager?: boolean;
}) {
  const entry = catalogEditorial[slug];
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const image = entry?.image !== failedImage ? entry?.image : undefined;
  if (image && entry?.wholeSubject) {
    return (
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <Image
          src={image}
          alt=""
          fill
          sizes="(min-width: 1280px) 32vw, (min-width: 768px) 50vw, 100vw"
          className="scale-110 object-cover blur-xl"
          onError={() => setFailedImage(image)}
        />
        {/* Keep the entire burger (42–83% of the source height) in the card. */}
        <Image
          src={image}
          alt=""
          width={750}
          height={938}
          sizes="(min-width: 1280px) 32vw, (min-width: 768px) 50vw, 100vw"
          className="absolute -top-[80%] left-0 h-[200%] w-full object-contain"
          style={{
            maskImage:
              "linear-gradient(to right, transparent, black 14%, black 86%, transparent)",
          }}
          onError={() => setFailedImage(image)}
        />
      </div>
    );
  }
  if (image) {
    return (
      <div
        aria-hidden="true"
        className={
          sharp
            ? "absolute inset-0 transition-transform duration-500 motion-safe:group-hover:scale-105"
            : "absolute -inset-5 transition-transform duration-500 group-hover:scale-110"
        }
      >
        <Image
          src={image}
          alt=""
          fill
          loading={eager || slug === "tokyo-fashion" ? "eager" : "lazy"}
          sizes="(min-width: 1280px) 32vw, (min-width: 768px) 50vw, 100vw"
          className={
            sharp ? "object-cover" : "scale-110 object-cover blur-[1px]"
          }
          style={{ objectPosition: entry?.focalPoint ?? "50% 50%" }}
          onError={() => setFailedImage(image)}
        />
      </div>
    );
  }

  const index =
    [...slug].reduce((sum, character) => sum + character.charCodeAt(0), 0) %
    cardPalettes.length;
  const [light, middle, dark] = cardPalettes[index];
  return (
    <div
      aria-hidden="true"
      className="absolute -inset-5 scale-110 blur-2xl transition-transform duration-500 group-hover:scale-125"
      style={{
        backgroundImage: `radial-gradient(circle at 75% 20%, ${light} 0%, transparent 52%), radial-gradient(circle at 15% 80%, ${middle} 0%, transparent 60%), linear-gradient(135deg, ${dark}, ${middle})`,
      }}
    />
  );
}
