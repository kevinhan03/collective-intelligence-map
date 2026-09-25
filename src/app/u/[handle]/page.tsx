import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { configured, db } from "@/lib/supabase/server";
export default async function PublicProfile({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  if (!configured()) notFound();
  const { handle } = await params;
  const client = await db();
  const { data: profile } = await client
    .from("profiles")
    .select("id,handle,bio,created_at,avatar_path")
    .eq("handle", handle)
    .maybeSingle();
  if (!profile) notFound();
  const { data: contributions, error } = await client
    .from("map_places")
    .select("id,place_id,rationale,places(name),theme_maps(slug,title)")
    .eq("added_by", profile.id)
    .eq("status", "approved")
    .limit(100);
  if (error) throw new Error("기여 이력을 불러올 수 없습니다.");
  return (
    <main id="main" className="page-wrap max-w-2xl">
      <p className="kicker">Community contributor</p>
      {profile.avatar_path && (
        <Image
          unoptimized
          src={
            client.storage.from("avatars").getPublicUrl(profile.avatar_path)
              .data.publicUrl
          }
          alt={`${profile.handle} 프로필`}
          width={72}
          height={72}
          className="mt-5 size-18 rounded-full object-cover"
        />
      )}
      <h1 className="mt-3 text-3xl font-semibold">@{profile.handle}</h1>
      <p className="mt-4 whitespace-pre-wrap leading-7 text-muted-foreground">
        {profile.bio || "아직 소개가 없습니다."}
      </p>
      <h2 className="mt-10 mb-5 text-lg font-semibold">
        추천한 장소 {contributions?.length ?? 0}
      </h2>
      {contributions?.map((c) => {
        const m = c.theme_maps as unknown as { slug: string; title: string };
        const place = c.places as unknown as { name: string };
        return (
          <article key={c.id} className="border-b py-5">
            <Link
              href={`/maps/${m.slug}?place=${c.place_id}`}
              className="text-base font-semibold text-foreground hover:underline"
            >
              {place.name}
            </Link>
            <p className="mt-1 text-xs text-primary">{m.title}</p>
            <p className="mt-2 text-sm leading-6">{c.rationale}</p>
          </article>
        );
      })}
      {!contributions?.length && (
        <p className="text-sm text-muted-foreground">
          아직 공개된 기여가 없습니다.
        </p>
      )}
    </main>
  );
}
// Keep authenticated flows blocking during the incremental cache migration.
export const instant = false;
