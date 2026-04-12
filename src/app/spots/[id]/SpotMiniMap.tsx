"use client";

import { useRef, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { WindDirectionRose } from "@/components/spot/WindDirectionRose";

export default function SpotMiniMap({
  lat,
  lng,
  name,
  bestDirections,
}: {
  lat: number;
  lng: number;
  name: string;
  bestDirections: string[];
}) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const roseRef = useRef<HTMLDivElement>(null);

  const initMap = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || mapRef.current) return;
      mapContainer.current = node;

      const map = new maplibregl.Map({
        container: node,
        style:
          process.env.NEXT_PUBLIC_MAP_STYLE ||
          "https://tiles.openfreemap.org/styles/liberty",
        center: [lng, lat],
        zoom: 10,
        interactive: true,
        attributionControl: false,
      });

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "top-right",
      );

      const positionRose = () => {
        if (!roseRef.current) return;
        const px = map.project([lng, lat]);
        roseRef.current.style.left = `${px.x}px`;
        roseRef.current.style.top = `${px.y}px`;
      };

      map.on("load", () => {
        new maplibregl.Marker({ color: "#0ea5e9" })
          .setLngLat([lng, lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25, closeButton: false }).setText(
              name,
            ),
          )
          .addTo(map);
        positionRose();
      });

      map.on("move", positionRose);
      map.on("zoom", positionRose);
      map.on("resize", positionRose);

      mapRef.current = map;
    },
    [lat, lng, name],
  );

  return (
    <div ref={initMap} className="w-full h-full relative">
      {bestDirections.length > 0 && (
        <div
          ref={roseRef}
          className="absolute z-10 pointer-events-none -translate-x-1/2 -translate-y-1/2"
          style={{ left: "50%", top: "50%" }}
        >
          <WindDirectionRose bestDirections={bestDirections} size={180} />
        </div>
      )}
    </div>
  );
}
