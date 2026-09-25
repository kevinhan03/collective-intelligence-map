"use client";

import Link from "next/link";
import { Bookmark, ChevronUp, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MapPlace } from "@/domain/types";
import { placeArea } from "@/domain/place-location";

export function PlacePreview({
  place,
  saved,
  vote,
  demo,
  signedIn,
  loginHref,
  busy,
  onClose,
  onOpenDetail,
  onVote,
  onSave,
}: {
  place: MapPlace;
  saved: boolean;
  vote: number;
  demo: boolean;
  signedIn: boolean;
  loginHref: string;
  busy: boolean;
  onClose: () => void;
  onOpenDetail: () => void;
  onVote: (value: 1 | -1) => void;
  onSave: () => void;
}) {
  const total = place.positive + place.negative;
  return (
    <aside className="place-preview-card" aria-label={`${place.name} 미리보기`}>
      <div className="flex items-start justify-between gap-3">
        <button
          className="min-w-0 text-left"
          onClick={onOpenDetail}
          aria-label={`${place.name} 자세히 보기`}
        >
          <span className="text-xs text-primary">
            {[place.category, placeArea(place.address)].filter(Boolean).join(" · ")}
          </span>
          <h2 className="mt-1 truncate text-lg font-semibold">{place.name}</h2>
        </button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="장소 미리보기 닫기"
          onClick={onClose}
        >
          <X size={18} />
        </Button>
      </div>
      <p className="mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground">
        {place.rationale}
      </p>
      <p className="mt-3 text-xs text-muted-foreground">
        {total
          ? `${total}명 중 ${place.positive}명이 이 주제에 추천했어요.`
          : "아직 검증 전인 장소예요."}
      </p>
      <div
        className="place-card-votes mt-3 flex items-center gap-2"
        aria-label={`${place.name} 주제 적합성 투표`}
      >
        <button
          type="button"
          className="vote-control"
          aria-label={`${place.name} 테마에 잘 맞아요 ${place.positive}`}
          aria-pressed={vote === 1}
          disabled={demo || busy}
          onClick={() => onVote(1)}
        >
          <ThumbsUp size={14} fill="none" strokeWidth={1.8} />
          <span>{place.positive}</span>
        </button>
        <button
          type="button"
          className="vote-control"
          aria-label={`${place.name} 테마와 달라요 ${place.negative}`}
          aria-pressed={vote === -1}
          disabled={demo || busy}
          onClick={() => onVote(-1)}
        >
          <ThumbsDown size={14} fill="none" strokeWidth={1.8} />
          <span>{place.negative}</span>
        </button>
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-2">
        <Button className="h-11" onClick={onOpenDetail}>
          자세히 보기
          <ChevronUp size={17} />
        </Button>
        {demo ? (
          <Button
            className="h-11"
            variant="outline"
            disabled
            aria-label="미리보기에서는 저장할 수 없어요"
          >
            <Bookmark size={17} />
          </Button>
        ) : signedIn ? (
          <Button
            className="h-11"
            variant={saved ? "secondary" : "outline"}
            disabled={busy}
            aria-pressed={saved}
            aria-label={
              saved ? `${place.name} 저장 해제` : `${place.name} 저장`
            }
            onClick={onSave}
          >
            <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
            <span className="sr-only">{saved ? "저장 해제" : "저장"}</span>
          </Button>
        ) : (
          <Button asChild className="h-11" variant="outline">
            <Link href={loginHref} aria-label="로그인하고 장소 저장">
              <Bookmark size={17} />
            </Link>
          </Button>
        )}
      </div>
    </aside>
  );
}
