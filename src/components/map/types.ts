import type { Bounds, MapPlace } from "@/domain/types";
export type MapProps = {
  places: MapPlace[];
  selected: string | null;
  onSelect: (id: string) => void;
  onFocusComplete?: (id: string) => void;
  focusRequest?: number;
  bounds: Bounds;
  onBoundsChange: (bounds: Bounds) => void;
  apiKey: string;
  mapId?: string;
  compact?: boolean;
};
