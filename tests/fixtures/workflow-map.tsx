import MapLibre from "@/components/map/renderers/maplibre";
import { MapCanvas as Preview } from "./primitives";
import type { MapProps } from "@/components/map/types";
import type { RendererConfig } from "@/domain/types";
export function MapCanvas({
  config,
  ...props
}: Omit<MapProps, "apiKey"> & { config: RendererConfig }) {
  return config.provider === "maplibre" ? (
    <MapLibre {...props} apiKey={config.key} />
  ) : (
    <Preview {...props} />
  );
}
