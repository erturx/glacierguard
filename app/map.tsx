"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type Coordinates, type Map } from "maplibre-gl";

type Point = [number, number];
type Overlay = { image: string; corners: Coordinates };

export default function RadarMap({
  center, name, overlay, opacity,
}: { center: Point; name: string; overlay?: Overlay; opacity: number }) {
  const container = useRef<HTMLDivElement>(null);
  const instance = useRef<Map | null>(null);
  const marker = useRef<maplibregl.Marker | null>(null);
  const image = useRef<string | undefined>(undefined);
  const state = useRef({ center, name, overlay, opacity });

  useEffect(() => {
    state.current = { center, name, overlay, opacity };
    const map = instance.current;
    if (map?.getSource("radar")) {
      update(map, state.current, marker.current, image);
    }
  }, [center, name, overlay, opacity]);

  useEffect(() => {
    if (!container.current || typeof WebGL2RenderingContext === "undefined") return;
    const { center, overlay } = state.current;
    if (!overlay) return;
    image.current = overlay.image;
    let map: Map;
    try {
      map = new maplibregl.Map({
      container: container.current, center, zoom: 11.1, minZoom: 5, maxZoom: 17,
      attributionControl: false, scrollZoom: false, maxPitch: 0,
      style: {
        version: 8, sources: {
          satellite: {
            type: "raster", tileSize: 256, maxzoom: 17,
            tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
            attribution: "Esri, Maxar, Earthstar Geographics and the GIS User Community",
          },
          radar: { type: "image", url: overlay.image, coordinates: overlay.corners },
        },
        layers: [
          { id: "ground", type: "background", paint: { "background-color": "#1b332e" } },
          { id: "satellite", type: "raster", source: "satellite", paint: { "raster-saturation": -0.24, "raster-brightness-max": 0.76 } },
          { id: "radar", type: "raster", source: "radar", paint: { "raster-fade-duration": 0 } },
        ],
      },
      });
    } catch {
      return; // The cached raster still works on browsers lacking a usable GPU context.
    }
    instance.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl(), "bottom-left");
    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    const dot = document.createElement("div");
    dot.className = "map-marker";
    marker.current = new maplibregl.Marker({ element: dot }).setLngLat(center).addTo(map);
    map.once("load", () => {
      update(map, state.current, marker.current, image);
      container.current?.classList.add("map-loaded");
    });
    return () => { map.remove(); instance.current = null; marker.current = null; };
  }, []);

  return <div className="map-shell">
    {overlay && <img src={overlay.image} className="map-fallback" style={{ opacity }} alt={`NISAR raster near ${name}`} />}
    <div className="map-canvas" ref={container} role="region" aria-label={`Interactive satellite map of ${name}`} />
  </div>;
}

function update(map: Map, state: { center: Point; name: string; overlay?: Overlay; opacity: number }, marker: maplibregl.Marker | null, image: { current: string | undefined }) {
  const { center, overlay, name, opacity } = state;
  const source = map.getSource<maplibregl.ImageSource>("radar");
  if (!source || !map.getLayer("radar")) return;
  if (overlay && image.current !== overlay.image) {
    source.updateImage({ url: overlay.image, coordinates: overlay.corners });
    image.current = overlay.image;
  }
  map.setPaintProperty("radar", "raster-opacity", overlay ? opacity : 0);
  const current = marker?.getLngLat();
  if (current && (current.lng !== center[0] || current.lat !== center[1])) {
    marker?.setLngLat(center);
    map.jumpTo({ center, zoom: 11.1 });
  }
  marker?.getElement().setAttribute("title", name);
}
