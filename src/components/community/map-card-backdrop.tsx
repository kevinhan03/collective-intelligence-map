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
  "choiza-road-restaurants": "/choiza-road-restaurants.jpeg",
  "korea-vintage": "/korea-vintage-gyeongbokgung.jpg",
  "seoul-taco-restaurant": "/seoul-taco-restaurant.jpg",
  "tokyo-fashion": "/tokyo-fashion-shinjuku.jpg",
};

export function MapCardBackdrop({ slug }: { slug: string }) {
  const image = cardImages[slug];
  if (image) {
    return (
      <div
        aria-hidden="true"
        className="absolute -inset-5 transition-transform duration-500 group-hover:scale-110"
      >
        <Image
          src={image}
          alt=""
          fill
          sizes="(min-width: 1280px) 32vw, (min-width: 768px) 50vw, 100vw"
          className="scale-110 object-cover blur-[1px]"
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
