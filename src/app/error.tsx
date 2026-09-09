"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main" className="page-wrap py-24 text-center">
      <h1 className="text-2xl font-semibold">잠시 연결이 끊겼어요.</h1>
      <p className="my-5 text-muted-foreground">
        데이터를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>
      <Button onClick={reset}>다시 시도</Button>
    </main>
  );
}
