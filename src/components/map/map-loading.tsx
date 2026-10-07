import { MapPin } from "lucide-react";

export function MapLoading() {
  return (
    <div role="status" className="map-grid flex h-full min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center">
      <MapPin className="text-primary" size={28} aria-hidden="true" />
      <p className="text-sm font-medium">지도를 준비하고 있어요.</p>
      <p className="max-w-xs text-xs leading-5 text-muted-foreground">
        장소 정보는 먼저 확인할 수 있어요. 지도가 준비되면 주변 역과 위치를 볼 수 있어요.
      </p>
    </div>
  );
}
