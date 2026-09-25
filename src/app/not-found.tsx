import Link from "next/link";
export default function NotFound() {
  return (
    <main id="main" className="page-wrap py-24 text-center">
      <h1 className="text-2xl font-semibold">아직 이곳에는 지도가 없어요.</h1>
      <Link href="/" className="mt-5 inline-block text-primary underline">
        발견으로 돌아가기
      </Link>
    </main>
  );
}
