import { useEffect, useRef, useCallback } from 'react'
import Map, { Marker, Source, Layer } from 'react-map-gl'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import HistoryLayer from './HistoryLayer'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

// Activity type colors (unchanged)
function getPathColor(activityType) {
  const type = (activityType || '').toLowerCase()
  if (type.includes('walk')) return '#34d399'      // green
  if (type.includes('bik') || type.includes('cycl')) return '#2dd4bf'  // teal
  if (type.includes('vehicle') || type.includes('driv')) return '#fb923c'  // coral/orange
  if (type.includes('transit') || type.includes('train') || type.includes('bus') || type.includes('subway')) return '#60a5fa'  // soft blue
  return '#9ca3af'  // warm gray
}

// Marker colors (unchanged)
const colors = {
  home: '#34d399',      // green (matches --color-walk)
  work: '#60a5fa',      // soft blue (matches --blue)
  default: '#f59e0b',   // amber (matches --accent)
}

function getColor(semanticType) {
  const type = (semanticType || '').toLowerCase()
  if (type.includes('home')) return colors.home
  if (type.includes('work')) return colors.work
  return colors.default
}

// Weather mood colors (Golden Hour - warm tints)
function getWeatherMood(condition) {
  const c = (condition || '').toLowerCase()
  if (c.includes('clear') || c.includes('sunny')) return 'rgba(251, 191, 36, 0.06)' // golden hour glow
  if (c.includes('rain') || c.includes('drizzle')) return 'rgba(96, 165, 250, 0.04)' // cool blue
  if (c.includes('snow')) return 'rgba(226, 232, 240, 0.05)' // cool bright
  if (c.includes('fog') || c.includes('mist')) return 'rgba(184, 176, 164, 0.04)' // warm muted
  if (c.includes('cloud') || c.includes('overcast')) return 'rgba(156, 163, 175, 0.03)' // subtle warm gray
  return null
}

export default function MapPane({
  visits,
  path,
  isLoading,
  selectedVisit,
  onVisitClick,
  weatherCondition,
  historyPlaces,
  historyMode,
  onHistoryPlaceClick,
  onMapMove
}) {
  const mapRef = useRef()
  const prevSelectedRef = useRef(undefined)

  // Default center
  const initialViewState = {
    longitude: visits.length > 0 ? visits[0].lon : -75.16,
    latitude: visits.length > 0 ? visits[0].lat : 39.95,
    zoom: 13
  }

  // Fit bounds when visits/path change
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current.getMap()

    const points = [
      ...visits.map(v => [v.lon, v.lat]),
      ...path.map(p => [p.lon, p.lat])
    ]

    if (points.length === 0) return

    const bounds = points.reduce(
      (b, coord) => b.extend(coord),
      new mapboxgl.LngLatBounds()
    )
    map.fitBounds(bounds, { padding: 50, duration: 1000 })
  }, [visits, path])

  // Fly to selected visit
  useEffect(() => {
    if (!mapRef.current) return
    const map = mapRef.current.getMap()
    const hadPrevious = prevSelectedRef.current !== undefined && prevSelectedRef.current !== null

    if (selectedVisit) {
      map.flyTo({
        center: [selectedVisit.lon, selectedVisit.lat],
        zoom: 17,
        duration: 800
      })
    } else if (hadPrevious) {
      // Zoom back out
      const points = [
        ...visits.map(v => [v.lon, v.lat]),
        ...path.map(p => [p.lon, p.lat])
      ]
      if (points.length > 0) {
        const bounds = points.reduce(
          (b, coord) => b.extend(coord),
          new mapboxgl.LngLatBounds()
        )
        map.fitBounds(bounds, { padding: 50, duration: 800 })
      }
    }

    prevSelectedRef.current = selectedVisit
  }, [selectedVisit, visits, path])

  // Build GeoJSON for path segments
  const pathGeoJSON = {
    type: 'FeatureCollection',
    features: []
  }

  let currentSegment = []
  let currentType = null
  for (const point of path) {
    if (point.activityType !== currentType && currentSegment.length > 0) {
      pathGeoJSON.features.push({
        type: 'Feature',
        properties: { color: getPathColor(currentType) },
        geometry: {
          type: 'LineString',
          coordinates: currentSegment
        }
      })
      currentSegment = []
    }
    currentSegment.push([point.lon, point.lat])
    currentType = point.activityType
  }
  if (currentSegment.length > 0) {
    pathGeoJSON.features.push({
      type: 'Feature',
      properties: { color: getPathColor(currentType) },
      geometry: {
        type: 'LineString',
        coordinates: currentSegment
      }
    })
  }

  const weatherMood = getWeatherMood(weatherCondition)

  // Handle map move for viewport tracking
  const handleMoveEnd = useCallback((evt) => {
    if (!onMapMove) return
    const bounds = evt.target.getBounds()
    onMapMove({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest()
    })
  }, [onMapMove])

  // Handle clicks on history layer
  const handleMapClick = useCallback((e) => {
    if (historyMode !== 'active') return
    if (!e.features || e.features.length === 0) return

    const feature = e.features[0]

    if (feature.layer.id === 'history-clusters') {
      // Zoom into cluster
      const clusterId = feature.properties.cluster_id
      const source = e.target.getSource('history')
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return
        e.target.easeTo({
          center: feature.geometry.coordinates,
          zoom: zoom
        })
      })
    } else if (feature.layer.id === 'history-points') {
      // Find the full place data from historyPlaces
      const placeId = feature.properties.placeId
      const place = historyPlaces?.find(p => p.placeId === placeId)
      if (place && onHistoryPlaceClick) {
        onHistoryPlaceClick(place)
      }
    }
  }, [historyMode, historyPlaces, onHistoryPlaceClick])

  const isHistoryActive = historyMode === 'active'

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

      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialViewState}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        onMoveEnd={handleMoveEnd}
        onClick={handleMapClick}
        interactiveLayerIds={isHistoryActive ? ['history-clusters', 'history-points'] : []}
        onLoad={(e) => {
          const map = e.target

          // Filter to notable POIs only (hide commercial clutter)
          // dark-v11 uses 'class' property with these values
          try {
            map.setFilter('poi-label', [
              'match',
              ['get', 'class'],
              ['landmark', 'park', 'food_and_drink', 'lodging', 'restaurant', 'cafe', 'bar'],
              true,
              false
            ])

            // Style POI labels to match app accent color
            map.setPaintProperty('poi-label', 'text-color', '#f59e0b')
            map.setPaintProperty('poi-label', 'text-halo-color', '#1a1a2e')
            map.setPaintProperty('poi-label', 'text-halo-width', 1)
          } catch (err) {
            console.warn('POI layer styling failed:', err.message)
          }
        }}
      >
        {/* History layer - behind everything else */}
        <HistoryLayer
          places={historyPlaces}
          isActive={isHistoryActive}
        />

        {/* Path lines */}
        <Source id="path" type="geojson" data={pathGeoJSON}>
          <Layer
            id="path-line"
            type="line"
            paint={{
              'line-color': ['get', 'color'],
              'line-width': 4,
              'line-opacity': 0.7
            }}
          />
        </Source>

        {/* 3D Buildings - only visible at zoom 14+ */}
        <Layer
          id="3d-buildings"
          source="composite"
          source-layer="building"
          type="fill-extrusion"
          minzoom={14}
          paint={{
            'fill-extrusion-color': '#1a1a2e',
            'fill-extrusion-height': ['get', 'height'],
            'fill-extrusion-base': ['get', 'min_height'],
            'fill-extrusion-opacity': 0.6
          }}
        />

        {/* Visit markers */}
        {visits.map((visit, idx) => {
          const isSelected = selectedVisit?.id === visit.id
          const color = getColor(visit.semanticType)
          const visitNumber = idx + 1

          return (
            <Marker
              key={visit.id || idx}
              longitude={visit.lon}
              latitude={visit.lat}
              anchor="center"
              onClick={(e) => {
                e.originalEvent.stopPropagation()
                onVisitClick(isSelected ? null : visit)
              }}
            >
              <div
                className={`map-marker ${isSelected ? 'selected' : ''} ${isHistoryActive ? 'mist-mode' : ''}`}
                style={{
                  background: color,
                  width: isSelected ? 36 : 24,
                  height: isSelected ? 36 : 24,
                }}
              >
                {visitNumber}
              </div>
            </Marker>
          )
        })}
      </Map>
    </div>
  )
}
