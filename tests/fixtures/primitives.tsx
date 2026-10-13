import type { ComponentProps } from "react";
export function Link({
  href,
  children,
  ...props
}: ComponentProps<"a"> & { prefetch?: boolean }) {
  const { prefetch: _, ...rest } = props;
  void _;
  return (
    <a href={href} {...rest}>
      {children}
    </a>
  );
}
export function Image({
  unoptimized: _,
  fill,
  style,
  ...props
}: ComponentProps<"img"> & { unoptimized?: boolean; fill?: boolean }) {
  void _;
  return (
    // Test substitute for next/image, including its fill layout.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      alt={props.alt ?? ""}
      style={
        fill
          ? {
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              ...style,
            }
          : style
      }
    />
  );
}
export function MapCanvas({
  onMapClick,
  places,
  onSelect,
}: {
  onMapClick?: (point: { lat: number; lng: number }) => void;
  places?: { id: string; name: string }[];
  onSelect?: (id: string) => void;
}) {
  return (
    <div aria-label="테스트 지도">
      <button
        type="button"
        onClick={() => onMapClick?.({ lat: 37.5, lng: 127.1 })}
      >
        테스트 지도 위치 조정
      </button>
      {places?.map((place) => (
        <button key={place.id} onClick={() => onSelect?.(place.id)}>
          {place.name} 테스트 핀
        </button>
      ))}
    </div>
  );
}
