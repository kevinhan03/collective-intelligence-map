import Image from "next/image";

const cardPalettes = [
  ["#bd794f", "#533b54", "#1b2829"],
  ["#627d9b", "#59476c", "#202c39"],
  ["#8b9857", "#6d6050", "#242c2b"],
  ["#b56b70", "#744d72", "#252b40"],
  ["#9b8660", "#526c70", "#1e3037"],
] as const;

// Editorial images for the currently curated maps. New maps use the stable
// palette fallback below until an intentional image is selected.
const cardImages: Record<string, string> = {
  "seoul-night-view": "/seoul-night-view.jpg",
  "korea-ramen-restaurant": "/korea-ramen-restaurant.jpg",
  "korea-sauna-map": "/korea-sauna-map.webp",
  "korea-best-burger": "/korea-best-burger-whole.jpeg",
  "korea-fashion-store": "/korea-fashion-store.jpg",
  "choiza-road-restaurants": "/choiza-road-restaurants.jpeg",
  "korea-vintage": "/korea-vintage-shop.jpg",
  "seoul-taco-restaurant": "/seoul-taco-restaurant.jpg",
  "tokyo-fashion": "/tokyo-fashion-store-interior.jpg",
};

export function MapCardBackdrop({
  slug,
  sharp = false,
}: {
  slug: string;
  sharp?: boolean;
}) {
  const image = cardImages[slug];
  if (image && slug === "korea-best-burger") {
    return (
      <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
        <Image
          src={image}
          alt=""
          fill
          sizes="(min-width: 1280px) 32vw, (min-width: 768px) 50vw, 100vw"
          className="scale-110 object-cover blur-xl"
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
          loading={slug === "tokyo-fashion" ? "eager" : "lazy"}
          sizes="(min-width: 1280px) 32vw, (min-width: 768px) 50vw, 100vw"
          className={
            sharp ? "object-cover" : "scale-110 object-cover blur-[1px]"
          }
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
