import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix Leaflet default marker icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

// Custom marker icons by semantic type
const createIcon = (color) => L.divIcon({
  className: 'custom-marker',
  html: `<div style="
    background: ${color};
    width: 24px;
    height: 24px;
    border-radius: 50%;
    border: 3px solid white;
    box-shadow: 0 2px 5px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12],
  popupAnchor: [0, -12]
})

const icons = {
  home: createIcon('#10b981'),      // green
  work: createIcon('#3b82f6'),      // blue
  default: createIcon('#8b5cf6'),   // purple
}

function getIcon(semanticType) {
  const type = (semanticType || '').toLowerCase()
  if (type.includes('home')) return icons.home
  if (type.includes('work')) return icons.work
  return icons.default
}

// Component to fit bounds when visits change
function FitBounds({ visits, path }) {
  const map = useMap()

  useEffect(() => {
    const points = [
      ...visits.map(v => [v.lat, v.lon]),
      ...path.map(p => [p.lat, p.lon])
    ]

    if (points.length > 0) {
      const bounds = L.latLngBounds(points)
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [visits, path, map])

  return null
}

// Color path segments by activity type
function getPathColor(activityType) {
  const type = (activityType || '').toLowerCase()
  if (type.includes('walk')) return '#10b981'
  if (type.includes('bik') || type.includes('cycl')) return '#f59e0b'
  if (type.includes('vehicle') || type.includes('driv')) return '#ef4444'
  return '#6b7280'
}

export default function MapPane({ visits, path, isLoading }) {
  // Default center (will be overridden by FitBounds)
  const defaultCenter = visits.length > 0
    ? [visits[0].lat, visits[0].lon]
    : [39.95, -75.16] // Philadelphia default

  // Group path into segments by activity type
  const pathSegments = []
  let currentSegment = []
  let currentType = null

  for (const point of path) {
    if (point.activityType !== currentType && currentSegment.length > 0) {
      pathSegments.push({ points: currentSegment, type: currentType })
      currentSegment = []
    }
    currentSegment.push([point.lat, point.lon])
    currentType = point.activityType
  }
  if (currentSegment.length > 0) {
    pathSegments.push({ points: currentSegment, type: currentType })
  }

  return (
    <div className="map-container">
      {isLoading && (
        <div className="map-loading">
          <span>Loading map data...</span>
        </div>
      )}

      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds visits={visits} path={path} />

        {/* Draw path segments colored by activity */}
        {pathSegments.map((segment, idx) => (
          <Polyline
            key={idx}
            positions={segment.points}
            color={getPathColor(segment.type)}
            weight={4}
            opacity={0.7}
          />
        ))}

        {/* Visit markers */}
        {visits.map((visit, idx) => (
          <Marker
            key={visit.id || idx}
            position={[visit.lat, visit.lon]}
            icon={getIcon(visit.semanticType)}
          >
            <Popup>
              <div className="marker-popup">
                <strong>{visit.place?.name || visit.semanticType || 'Unknown Place'}</strong>
                {visit.place?.address && <p>{visit.place.address}</p>}
                {visit.durationMinutes && (
                  <p className="duration">{formatDuration(visit.durationMinutes)}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  )
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}
