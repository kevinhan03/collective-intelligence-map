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
  const labelsMode = new URLSearchParams(window.location.search).has("labels");
  const focusMode = new URLSearchParams(window.location.search).has("focus");
  const [focusRequest, setFocusRequest] = useState(0);
  const [arrived, setArrived] = useState("");
  const labelPlaces = base.map((place, index) => ({
    ...place,
    lat: 37.54,
    lng: 126.99 + (index - 1) * 0.0052,
    name:
      index === 0
        ? "아주 긴 한글 장소 이름 말줄임 확인용 편집숍"
        : index === 1
          ? "A very long English place name for truncation"
          : "동쪽 매장",
  }));
  const [selected, setSelected] = useState<string | null>(null);
  const [places, setPlaces] = useState(labelsMode ? labelPlaces : base);
  const [revision, setRevision] = useState(0);
  const [zoom, setZoom] = useState(0);
  const onBoundsChange = useCallback((bounds: Bounds) => {
    setRevision((value) => value + 1);
    const width = document
      .querySelector(".maplibregl-canvas")
      ?.getBoundingClientRect().width;
    if (width)
      setZoom(Math.log2((360 * width) / (512 * (bounds.east - bounds.west))));
  }, []);
  return (
    <>
      {labelsMode && (
        <>
          <button onClick={() => setSelected(null)}>선택 해제</button>
          <button onClick={() => setSelected("east")}>가운데 장소 선택</button>
          <button
            onClick={() =>
              setPlaces((places) =>
                places.map((place) => ({ ...place, lng: 126.99, lat: 37.54 })),
              )
            }
          >
            같은 위치로 모으기
          </button>
          <output aria-label="지도 줌">{zoom.toFixed(3)}</output>
        </>
      )}
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
      {focusMode && (
        <>
          <output aria-label="초점 이동 완료">{arrived}</output>
          <button
            onClick={() => {
              setSelected("east");
              setArrived("");
              setFocusRequest((value) => value + 1);
            }}
          >
            동쪽 장소로 이동
          </button>
        </>
      )}
      <div style={{ position: "relative", width: "100%", height: 420 }}>
        <MapLibreMap
          places={places}
          selected={selected}
          onSelect={(id) => {
            setSelected(id);
            if (focusMode) {
              setArrived("");
              setFocusRequest((value) => value + 1);
            }
          }}
          focusRequest={focusRequest}
          onFocusComplete={setArrived}
          onBoundsChange={onBoundsChange}
          bounds={
            labelsMode
              ? { west: 126.93, east: 127.05, south: 37.512, north: 37.568 }
              : bounds
          }
          apiKey="/marker-test-style.json"
        />
      </div>
      {focusMode && selected && (
        <div
          className="fixture-place-sheet"
          style={{
            position: "fixed",
            bottom: 0,
            height: "42vh",
            width: "100%",
            background: "#202831",
            color: "white",
            pointerEvents: "none",
          }}
        >
          장소 미리보기
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
