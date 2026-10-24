"use client";
import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import type { MapTag } from "@/domain/map-tags";
import styles from "./map-tags.module.css";

export function MapTagBar({
  tags,
  selected,
  onChange,
  floating,
  anchor,
}: {
  tags: MapTag[];
  selected: string[];
  onChange: (ids: string[]) => void;
  floating: boolean;
  anchor: HTMLElement | null;
}) {
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!anchor || !bar.current || !floating || !tags.length) return;
    const element = bar.current;
    const update = () =>
      element.style.setProperty(
        "--tag-bar-top",
        `${Math.max(64, anchor.offsetTop + anchor.offsetHeight + 8)}px`,
      );
    const observer = new ResizeObserver(update);
    observer.observe(anchor);
    update();
    return () => observer.disconnect();
  }, [anchor, floating, tags.length]);
  if (!tags.length) return null;
  return (
    <div
      ref={bar}
      data-map-tag-bar
      className={`${styles.bar} ${floating ? styles.floating : ""}`}
      role="group"
      aria-label="장소 태그 필터"
    >
      <button
        className={styles.chip}
        type="button"
        aria-pressed={!selected.length}
        onClick={() => onChange([])}
      >
        전체
      </button>
      {tags.map((tag) => {
        const active = selected.includes(tag.id);
        return (
          <button
            key={tag.id}
            className={styles.chip}
            type="button"
            aria-pressed={active}
            disabled={!active && selected.length >= 10}
            onClick={(event) => {
              onChange(
                active
                  ? selected.filter((id) => id !== tag.id)
                  : [...selected, tag.id].sort(),
              );
              event.currentTarget.scrollIntoView({
                block: "nearest",
                inline: "nearest",
                behavior: "smooth",
              });
            }}
          >
            {active && <Check size={14} aria-hidden="true" />}#{tag.name}
          </button>
        );
      })}
    </div>
  );
}
