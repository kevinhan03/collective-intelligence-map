import Link from "next/link";
import { redirect } from "next/navigation";
import { Bookmark } from "lucide-react";
import { getViewer } from "@/server/queries";
import { db } from "@/lib/supabase/server";
import type { MapPlace } from "@/domain/types";
import { Button } from "@/components/ui/button";
export default async function Saved() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const { data, error } = await (await db()).rpc("saved_place_cards");
  if (error) throw new Error("저장 목록을 불러올 수 없습니다.");
  const cards = (data ?? []) as (MapPlace & {
    map_slug: string;
    map_title: string;
  })[];
  const groups = Array.from(new Set(cards.map((p) => p.map_id))).map((id) => ({
    map: {
      id,
      slug: cards.find((p) => p.map_id === id)!.map_slug,
      title: cards.find((p) => p.map_id === id)!.map_title,
    },
    places: cards.filter((p) => p.map_id === id),
  }));
  return (
    <main id="main" className="page-wrap max-w-3xl">
      <p className="kicker">My discoveries</p>
      <h1 className="mt-3 text-3xl font-semibold">저장한 장소</h1>
      <p className="mt-3 mb-8 text-sm text-muted-foreground">
        공개 Theme Map에서 발견한 장소를 다시 만나보세요.
      </p>
      {groups.every((g) => !g.places.length) ? (
        <div className="rounded-xl border bg-card px-6 py-16 text-center">
          <Bookmark className="mx-auto mb-4 text-primary" />
          <h2 className="font-medium">다음에 가고 싶은 곳을 모아보세요.</h2>
          <Button asChild className="mt-6">
            <Link href="/">커뮤니티 탐색</Link>
          </Button>
        </div>
      ) : (
        groups.map(
          (g) =>
            g.places.length > 0 && (
              <section key={g.map.id} className="mb-8">
                <Link
                  href={`/maps/${g.map.slug}`}
                  className="text-lg font-semibold"
                >
                  {g.map.title} →
                </Link>
                {g.places.map((p) => (
                  <article key={p.id} className="border-b py-5">
                    <h3 className="font-medium">{p.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {p.rationale}
                    </p>
                    <Link
                      className="mt-2 inline-block text-xs text-primary"
                      href={`/maps/${g.map.slug}`}
                    >
                      맵에서 검증 확인하기
                    </Link>
                  </article>
                ))}
              </section>
            ),
        )
      )}
    </main>
  );
}
