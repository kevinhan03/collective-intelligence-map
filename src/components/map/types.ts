import type { Bounds, MapPlace, RailStation } from "@/domain/types";
export type MapProps = {
  userLocation?: { lat: number; lng: number } | null;
  stationFocus?: {
    station: RailStation;
    place: { lat: number; lng: number };
  } | null;
  places: MapPlace[];
  selected: string | null;
  onFallback?: () => void;
  onSelect: (id: string) => void;
  onFocusComplete?: (id: string) => void;
  focusRequest?: number;
  bounds: Bounds;
  onBoundsChange: (bounds: Bounds) => void;
  onMapClick?: (point: { lat: number; lng: number }) => void;
  apiKey: string;
  mapId?: string;
  compact?: boolean;
};
