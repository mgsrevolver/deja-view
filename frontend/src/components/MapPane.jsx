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

// Custom marker icons with visit number
const createIcon = (color, isSelected = false, number = null) => L.divIcon({
  className: 'custom-marker',
  html: isSelected
    ? `<div style="
        position: relative;
        width: 36px;
        height: 36px;
      ">
        <div style="
          position: absolute;
          inset: 0;
          background: ${color};
          border-radius: 50%;
          opacity: 0.3;
          animation: pulse 1.5s ease-in-out infinite;
        "></div>
        <div style="
          position: absolute;
          top: 6px;
          left: 6px;
          background: ${color};
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 11px;
          font-weight: 600;
          font-family: system-ui, sans-serif;
        ">${number || ''}</div>
      </div>`
    : `<div style="
        background: ${color};
        width: 24px;
        height: 24px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 11px;
        font-weight: 600;
        font-family: system-ui, sans-serif;
      ">${number || ''}</div>`,
  iconSize: isSelected ? [36, 36] : [24, 24],
  iconAnchor: isSelected ? [18, 18] : [12, 12],
  popupAnchor: [0, -12]
})

const colors = {
  home: '#10b981',      // green
  work: '#3b82f6',      // blue
  default: '#8b5cf6',   // purple
}

function getColor(semanticType) {
  const type = (semanticType || '').toLowerCase()
  if (type.includes('home')) return colors.home
  if (type.includes('work')) return colors.work
  return colors.default
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
  if (type.includes('transit') || type.includes('train') || type.includes('bus') || type.includes('subway')) return '#3b82f6'
  return '#6b7280'
}

// Weather mood colors (very subtle - 5% opacity max)
function getWeatherMood(condition) {
  const c = (condition || '').toLowerCase()
  if (c.includes('clear') || c.includes('sunny')) return 'rgba(251, 191, 36, 0.05)' // warm golden
  if (c.includes('rain') || c.includes('drizzle')) return 'rgba(96, 165, 250, 0.04)' // cool blue
  if (c.includes('snow')) return 'rgba(226, 232, 240, 0.05)' // cool bright
  if (c.includes('fog') || c.includes('mist')) return 'rgba(148, 163, 184, 0.04)' // muted gray
  if (c.includes('cloud') || c.includes('overcast')) return 'rgba(148, 163, 184, 0.03)' // subtle gray
  return null
}

export default function MapPane({ visits, path, isLoading, selectedVisit, onVisitClick, weatherCondition }) {
  // Default center (will be overridden by FitBounds)
  const defaultCenter = visits.length > 0
    ? [visits[0].lat, visits[0].lon]
    : [39.95, -75.16] // Philadelphia default

  const weatherMood = getWeatherMood(weatherCondition)

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

      {/* Weather mood overlay - subliminal tinting */}
      {weatherMood && (
        <div
          className="weather-mood-overlay"
          style={{ background: weatherMood }}
        />
      )}

      <MapContainer
        center={defaultCenter}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
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
        {visits.map((visit, idx) => {
          const isSelected = selectedVisit?.id === visit.id
          const color = getColor(visit.semanticType)
          const visitNumber = idx + 1
          return (
            <Marker
              key={visit.id || idx}
              position={[visit.lat, visit.lon]}
              icon={createIcon(color, isSelected, visitNumber)}
              zIndexOffset={isSelected ? 1000 : 0}
              eventHandlers={{
                click: () => onVisitClick(isSelected ? null : visit)
              }}
            />
          )
        })}
      </MapContainer>
    </div>
  )
}
