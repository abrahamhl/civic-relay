import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import type { MessageEnvelope } from '@civic-relay/schemas';
import L from 'leaflet';
import './IncidentMap.css';

// Fix Leaflet default marker icon issue with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface Props {
  messages: MessageEnvelope[];
}

const IncidentMap: React.FC<Props> = ({ messages }) => {
  const incidents = useMemo(() => {
    return messages.filter((msg) => msg.approximateLocation !== null);
  }, [messages]);

  const getMarkerColor = (verification: string): string => {
    switch (verification) {
      case 'OFFICIAL':
        return '#28a745'; // Green
      case 'CORROBORATED':
        return '#17a2b8'; // Blue
      case 'DISPUTED':
        return '#dc3545'; // Red
      default:
        return '#ffc107'; // Yellow (unverified)
    }
  };

  const getMarkerIcon = (type: string): string => {
    const icons: Record<string, string> = {
      SAFE: '✓',
      SOS: '🆘',
      MEDICAL: '⚕️',
      FIRE: '🔥',
      INFRASTRUCTURE: '⚠️',
      ROAD_BLOCKED: '🚧',
      RESOURCE_REQUEST: '📦',
      MISSING_PERSON: '👤',
      GENERAL_REPORT: '📝',
    };
    return icons[type] || '📍';
  };

  return (
    <div className="incident-map">
      <div className="map-legend">
        <h3>Incident Dashboard</h3>
        <div className="legend-items">
          <div className="legend-item">
            <span className="legend-dot official"></span>
            <span>Official</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot corroborated"></span>
            <span>Corroborated</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot unverified"></span>
            <span>Unverified</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot disputed"></span>
            <span>Disputed</span>
          </div>
        </div>
        <div className="stats">
          <p>Total Incidents: {incidents.length}</p>
          <p>Unverified: {incidents.filter((m) => m.verificationState === 'UNVERIFIED').length}</p>
        </div>
      </div>

      <MapContainer
        center={[40.4168, -3.7038]} // Madrid
        zoom={12}
        style={{ height: '500px', width: '100%', borderRadius: '8px' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {incidents.map((msg) => {
          if (!msg.approximateLocation) return null;

          const { lat, lon, confidence } = msg.approximateLocation;
          const color = getMarkerColor(msg.verificationState);
          const icon = getMarkerIcon(msg.payloadType);

          // Confidence radius in meters
          const radius =
            confidence === 'HIGH' ? 100 : confidence === 'MEDIUM' ? 500 : 2000;

          return (
            <React.Fragment key={msg.id}>
              <Circle
                center={[lat, lon]}
                radius={radius}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.2 }}
              />
              <Marker position={[lat, lon]}>
                <Popup>
                  <div>
                    <strong>
                      {icon} {msg.payloadType}
                    </strong>
                    <br />
                    Priority: {msg.priority}
                    <br />
                    Verification: {msg.verificationState}
                    <br />
                    Time: {new Date(msg.createdAt).toLocaleString()}
                    <br />
                    Location Confidence: {confidence}
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default IncidentMap;
