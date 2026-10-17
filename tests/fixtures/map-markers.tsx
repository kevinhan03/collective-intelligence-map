import { useCallback, useState } from "react";
import { createRoot } from "react-dom/client";
import MapLibreMap from "@/components/map/renderers/maplibre";
import type { Bounds, MapPlace } from "@/domain/types";
const base: MapPlace[] = [
  { id: "west", name: "서쪽 장소", lng: 126.96, lat: 37.54 },
  { id: "east", name: "동쪽 장소", lng: 127.02, lat: 37.57 },
  { id: "south", name: "남쪽 장소", lng: 127.0, lat: 37.51 },
].map((place) => ({
  ...place,
  place_id: place.id,
  map_id: "map",
  address: "서울",
  category: "restaurant",
  rationale: "",
  status: "approved",
  added_by: null,
  handle: "",
  positive: 0,
  negative: 0,
  saved_count: 0,
  created_at: "2026-01-01",
  last_verified_at: null,
}));
const bounds: Bounds = {
  west: 126.94,
  east: 127.04,
  south: 37.49,
  north: 37.59,
};
function Fixture() {
  const [selected, setSelected] = useState<string | null>(null);
  const [places, setPlaces] = useState(base);
  const [revision, setRevision] = useState(0);
  const onBoundsChange = useCallback(
    () => setRevision((value) => value + 1),
    [],
  );
  return (
    <>
      <button
        onClick={() =>
          setPlaces((places) =>
            places.map((place) => ({ ...place, positive: place.positive + 1 })),
          )
        }
      >
        핀 숫자 갱신
      </button>
      <button
        onClick={() =>
          setPlaces((places) => places.filter((place) => place.id !== "south"))
        }
      >
        남쪽 장소 제거
      </button>
      <output aria-label="지도 이동 횟수">{revision}</output>
      <div style={{ position: "relative", width: "100%", height: 420 }}>
        <MapLibreMap
          places={places}
          selected={selected}
          onSelect={setSelected}
          onBoundsChange={onBoundsChange}
          bounds={bounds}
          apiKey="/marker-test-style.json"
        />
      </div>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
