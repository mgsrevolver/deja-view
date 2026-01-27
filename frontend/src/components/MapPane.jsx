import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
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

// Component to zoom to a selected visit
function ZoomToVisit({ visit }) {
  const map = useMap()

  useEffect(() => {
    if (visit) {
      map.flyTo([visit.lat, visit.lon], 17, { duration: 0.8 })
    }
  }, [visit, map])

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

export default function MapPane({ visits, path, isLoading, selectedVisit, onVisitClick, onCloseOverlay }) {
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
        {selectedVisit && <ZoomToVisit visit={selectedVisit} />}

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
            eventHandlers={{
              click: () => onVisitClick(selectedVisit?.id === visit.id ? null : visit)
            }}
          />
        ))}
      </MapContainer>

      {/* Selected visit overlay */}
      {selectedVisit && (
        <div className="visit-overlay">
          <button className="overlay-close" onClick={onCloseOverlay} aria-label="Close">
            &times;
          </button>

          {selectedVisit.place?.imageUrl && (
            <div className="overlay-image">
              <img
                src={selectedVisit.place.imageUrl}
                alt={selectedVisit.place?.name || 'Place'}
              />
            </div>
          )}

          <div className="overlay-content">
            <div className="overlay-header">
              <div className="overlay-icon">{getSemanticIcon(selectedVisit.semanticType)}</div>
              <div className="overlay-title">
                <h3 className="overlay-name">
                  {selectedVisit.place?.name || selectedVisit.semanticType || 'Unknown Place'}
                </h3>
                {selectedVisit.place?.address && (
                  <p className="overlay-address">{selectedVisit.place.address}</p>
                )}
              </div>
            </div>

            {selectedVisit.durationMinutes && (
              <p className="overlay-visit-duration">
                This visit: {formatDuration(selectedVisit.durationMinutes)}
              </p>
            )}

            {/* Place statistics */}
            <div className="overlay-stats">
              {selectedVisit.place?.firstVisitDate && (
                <div className="overlay-stat">
                  <div className="overlay-stat-label">First Visit</div>
                  <div className="overlay-stat-value">{formatDate(selectedVisit.place.firstVisitDate)}</div>
                </div>
              )}
              {selectedVisit.place?.lastVisitDate && (
                <div className="overlay-stat">
                  <div className="overlay-stat-label">Last Visit</div>
                  <div className="overlay-stat-value">{formatDate(selectedVisit.place.lastVisitDate)}</div>
                </div>
              )}
              {selectedVisit.place?.totalVisits && (
                <div className="overlay-stat">
                  <div className="overlay-stat-label">Total Visits</div>
                  <div className="overlay-stat-value highlight">{selectedVisit.place.totalVisits.toLocaleString()}</div>
                </div>
              )}
              {selectedVisit.place?.totalMinutes && (
                <div className="overlay-stat">
                  <div className="overlay-stat-label">Total Time</div>
                  <div className="overlay-stat-value highlight">{formatDuration(selectedVisit.place.totalMinutes)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getSemanticIcon(semanticType) {
  const type = (semanticType || '').toLowerCase()
  if (type.includes('home')) return '🏠'
  if (type.includes('work')) return '💼'
  if (type.includes('restaurant') || type.includes('food')) return '🍽️'
  if (type.includes('gym') || type.includes('fitness')) return '🏋️'
  if (type.includes('store') || type.includes('shop')) return '🛒'
  if (type.includes('park')) return '🌳'
  if (type.includes('airport')) return '✈️'
  if (type.includes('hotel')) return '🏨'
  return '📍'
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    if (remainingHours > 0) return `${days}d ${remainingHours}h`
    return `${days}d`
  }
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
