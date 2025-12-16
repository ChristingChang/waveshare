import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icons in Leaflet with Vite
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
});

// Custom icons for visited and unvisited spots
const visitedIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const unvisitedIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-grey.png",
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

interface MapMarker {
  name: string;
  coordinates: [number, number];
  visited: boolean;
  visitCount?: number;
}

interface LeafletMapProps {
  markers: MapMarker[];
}

// Component to fit bounds when markers change
function FitBounds({ markers }: { markers: MapMarker[] }) {
  const map = useMap();

  useEffect(() => {
    if (markers.length > 0) {
      const bounds = L.latLngBounds(markers.map((m) => m.coordinates));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 10 });
    }
  }, [markers, map]);

  return null;
}

export function LeafletMap({ markers }: LeafletMapProps) {
  return (
    <MapContainer
      center={[23.5, 121.0]}
      zoom={7}
      style={{ height: "100%", width: "100%" }}
      className="z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {markers.map((marker, index) => (
        <Marker
          key={`${marker.name}-${index}`}
          position={marker.coordinates}
          icon={marker.visited ? visitedIcon : unvisitedIcon}
        >
          <Popup>
            <div className="text-center">
              <strong className="text-base">{marker.name}</strong>
              {marker.visited && marker.visitCount && (
                <p className="text-sm text-muted-foreground mt-1">
                  已衝浪 {marker.visitCount} 次
                </p>
              )}
              {!marker.visited && (
                <p className="text-sm text-muted-foreground mt-1">
                  尚未造訪
                </p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
      
      <FitBounds markers={markers} />
    </MapContainer>
  );
}
