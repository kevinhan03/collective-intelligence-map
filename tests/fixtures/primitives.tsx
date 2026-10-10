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
  ...props
}: ComponentProps<"img"> & { unoptimized?: boolean }) {
  void _;
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  return <img {...props} />;
}
export function MapCanvas({
  onMapClick,
}: {
  onMapClick?: (point: { lat: number; lng: number }) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onMapClick?.({ lat: 37.5, lng: 127.1 })}
    >
      테스트 지도 위치 조정
    </button>
  );
}
