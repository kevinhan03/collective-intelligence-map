"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { browserDb } from "@/lib/supabase/client";
import { post } from "./api";
import type { Viewer } from "@/domain/types";
export function ProfileForm({ viewer }: { viewer: Viewer }) {
  const [handle, setHandle] = useState(viewer.handle),
    [bio, setBio] = useState(viewer.bio),
    [file, setFile] = useState<File | null>(null),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setMessage("");
        try {
          let avatar_path = viewer.avatar_path;
          if (file) {
            if (
              file.size > 2 * 1024 * 1024 ||
              !["image/jpeg", "image/png", "image/webp"].includes(file.type)
            )
              throw new Error("2MB 이하 JPG, PNG, WebP만 가능합니다.");
            const path = `${viewer.id}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
            const { error } = await browserDb()
              .storage.from("avatars")
              .upload(path, file, { contentType: file.type });
            if (error) throw new Error("이미지를 업로드하지 못했습니다.");
            avatar_path = path;
          }
          await post("/api/community", {
            action: "profile",
            handle,
            bio,
            avatar_path,
          });
          setMessage("프로필을 저장했습니다.");
          router.refresh();
        } catch (e) {
          setMessage((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="handle">사용자 이름</Label>
        <Input
          id="handle"
          value={handle}
          onChange={(e) => setHandle(e.target.value)}
          pattern="[a-zA-Z0-9_]{3,30}"
          required
        />
        <p className="text-xs text-muted-foreground">영문·숫자·밑줄, 3–30자</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="bio">소개</Label>
        <Textarea
          id="bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          maxLength={500}
          placeholder="어떤 장소와 주제에 관심이 있나요?"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="avatar">프로필 이미지</Label>
        <Input
          id="avatar"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <p className="text-xs text-muted-foreground">
          공개 프로필에 사용됩니다. 최대 2MB.
        </p>
      </div>
      <Button disabled={busy}>{busy ? "저장 중" : "프로필 저장"}</Button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </form>
  );
}
