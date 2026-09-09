import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/server/queries";
import { ProfileForm } from "@/components/community/profile-form";
import { Button } from "@/components/ui/button";
export default async function Profile() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return (
    <main id="main" className="page-wrap max-w-xl">
      <p className="kicker mb-3">My profile</p>
      <h1 className="mb-3 text-2xl font-semibold">나의 프로필</h1>
      <p className="mb-8 text-sm text-muted-foreground">
        {viewer.role === "member"
          ? "초기 장소 제안·투표·댓글은 초대 기여자에게 열려 있습니다."
          : "관심 있는 장소의 이야기를 함께 만들어 주세요."}
      </p>
      <ProfileForm viewer={viewer} />
      <div className="mt-8 flex items-center justify-between border-t pt-5">
        <Link href={`/u/${viewer.handle}`} className="text-sm underline">
          공개 프로필 보기
        </Link>
        <form action="/auth/signout" method="post">
          <Button variant="ghost">로그아웃</Button>
        </form>
      </div>
    </main>
  );
}
