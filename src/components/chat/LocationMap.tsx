import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icons (Leaflet expects asset paths that Vite won't resolve)
const DefaultIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface Props {
  lat: number;
  lng: number;
  accuracy?: number | null;
  interactive?: boolean;
  zoom?: number;
  className?: string;
  label?: string;
}

export function LocationMap({
  lat,
  lng,
  accuracy,
  interactive = false,
  zoom = 15,
  className,
  label,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [lat, lng],
      zoom,
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      attributionControl: interactive,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker([lat, lng], { icon: DefaultIcon }).addTo(map);
    if (label) marker.bindPopup(label);

    if (accuracy && accuracy > 0) {
      circleRef.current = L.circle([lat, lng], {
        radius: accuracy,
        color: "hsl(var(--primary))",
        fillColor: "hsl(var(--primary))",
        fillOpacity: 0.15,
        weight: 1,
      }).addTo(map);
    }

    mapRef.current = map;
    markerRef.current = marker;

    // Force size recalc after mount (container often sized via CSS)
    setTimeout(() => map.invalidateSize(), 50);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update marker on coord change (for live updates)
  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng([lat, lng]);
    mapRef.current.panTo([lat, lng], { animate: true });
    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]);
      if (accuracy) circleRef.current.setRadius(accuracy);
    } else if (accuracy && accuracy > 0 && mapRef.current) {
      circleRef.current = L.circle([lat, lng], {
        radius: accuracy,
        color: "#3b82f6",
        fillColor: "#3b82f6",
        fillOpacity: 0.15,
        weight: 1,
      }).addTo(mapRef.current);
    }
  }, [lat, lng, accuracy]);

  return <div ref={containerRef} className={className} />;
}
