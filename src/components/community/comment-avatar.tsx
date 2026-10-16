import { UserRound } from "lucide-react";

export function CommentAvatar({
  path,
  handle,
}: {
  path?: string | null;
  handle?: string;
}) {
  return (
    <span className="comment-avatar" aria-hidden="true">
      {path && /^https:\/\//.test(path) ? (
        // Avatars are user-supplied remote images; keep them outside image optimization.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={path} alt="" referrerPolicy="no-referrer" />
      ) : handle && handle !== "탈퇴한 기여자" ? (
        handle.slice(0, 1).toUpperCase()
      ) : (
        <UserRound size={18} />
      )}
    </span>
  );
}
