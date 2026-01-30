# PRD: Mapbox Migration - Frontend

**Date:** 2026-01-30
**Status:** Planning
**Role:** FRONTEND

## Overview

Replace Leaflet/react-leaflet with Mapbox GL JS/react-map-gl for improved styling control, better performance, and POI customization capabilities.

---

## Why Mapbox?

| Capability | Leaflet (Current) | Mapbox GL JS |
|------------|-------------------|--------------|
| Tile styling | Limited (use pre-made) | Full control via Studio |
| POI visibility | None | Toggle by category |
| Performance | Canvas-based | WebGL-based (faster) |
| 3D buildings | Plugin required | Native support |
| Custom fonts | Not supported | Full typography control |
| Terrain | Plugin required | Native support |

---

## Prerequisites

### 1. Mapbox Account Setup
1. Create free account at [mapbox.com](https://www.mapbox.com/)
2. Get default public access token from Account → Tokens
3. Free tier: 50,000 map loads/month (sufficient for personal use)

### 2. Environment Variable
Add to `frontend/.env.local`:
```bash
VITE_MAPBOX_TOKEN=pk.eyJ1Ijoi...your_token_here
```

### 3. Custom Map Style (Optional)
Create in Mapbox Studio or use preset:
- **Dark preset:** `mapbox://styles/mapbox/dark-v11`
- **Custom:** Create style, copy style URL

---

## Dependencies

### Remove
```bash
npm uninstall leaflet react-leaflet
```

### Add
```bash
npm install react-map-gl mapbox-gl
```

### Package Versions (as of Jan 2026)
- `react-map-gl`: ^7.x
- `mapbox-gl`: ^3.x

---

## Files to Modify

| File | Action |
|------|--------|
| `src/components/MapPane.jsx` | Complete rewrite |
| `src/App.css` | Update map styles, remove Leaflet overrides |
| `package.json` | Dependency swap |
| `.env.local` | Add Mapbox token |

---

## MapPane.jsx Rewrite Spec

### Current Leaflet Structure
```jsx
<MapContainer>
  <TileLayer url="..." />
  <FitBounds />
  <ZoomToVisit />
  <Polyline /> // multiple
  <Marker />   // multiple
</MapContainer>
```

### New Mapbox Structure
```jsx
<Map ref={mapRef} mapboxAccessToken={...} mapStyle={...}>
  <Source type="geojson" data={pathGeoJSON}>
    <Layer type="line" paint={...} />
  </Source>
  {visits.map(v => <Marker />)}
</Map>
```

---

## Component Mapping

### 1. Map Container

**Leaflet:**
```jsx
<MapContainer center={[lat, lng]} zoom={13} style={{height: '100%'}}>
  <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png" />
</MapContainer>
```

**Mapbox:**
```jsx
import Map from 'react-map-gl'

<Map
  ref={mapRef}
  mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
  initialViewState={{
    longitude: lng,
    latitude: lat,
    zoom: 13
  }}
  style={{ width: '100%', height: '100%' }}
  mapStyle="mapbox://styles/mapbox/dark-v11"
/>
```

### 2. Markers (Numbered)

**Leaflet:**
```jsx
<Marker
  position={[lat, lon]}
  icon={L.divIcon({ html: '<div>1</div>' })}
  eventHandlers={{ click: () => ... }}
/>
```

**Mapbox:**
```jsx
import { Marker } from 'react-map-gl'

<Marker
  longitude={lon}
  latitude={lat}
  anchor="center"
  onClick={(e) => {
    e.originalEvent.stopPropagation()
    onVisitClick(visit)
  }}
>
  <div className="custom-marker" style={{...}}>
    {visitNumber}
  </div>
</Marker>
```

### 3. Path Lines (Activity-Colored Segments)

**Leaflet:**
```jsx
{pathSegments.map((segment, idx) => (
  <Polyline
    key={idx}
    positions={segment.points}  // [[lat, lon], ...]
    color={getPathColor(segment.type)}
    weight={4}
    opacity={0.7}
  />
))}
```

**Mapbox:**
```jsx
import { Source, Layer } from 'react-map-gl'

// Convert to GeoJSON
const pathGeoJSON = {
  type: 'FeatureCollection',
  features: pathSegments.map((segment, idx) => ({
    type: 'Feature',
    properties: {
      activityType: segment.type,
      color: getPathColor(segment.type)
    },
    geometry: {
      type: 'LineString',
      coordinates: segment.points.map(([lat, lon]) => [lon, lat]) // GeoJSON is [lng, lat]
    }
  }))
}

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
```

### 4. Fit Bounds

**Leaflet:**
```jsx
function FitBounds({ visits, path }) {
  const map = useMap()
  useEffect(() => {
    const bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [50, 50] })
  }, [visits, path])
}
```

**Mapbox:**
```jsx
import { useMap } from 'react-map-gl'

function FitBounds({ visits, path }) {
  const { current: map } = useMap()

  useEffect(() => {
    if (!map || points.length === 0) return

    const bounds = points.reduce(
      (bounds, [lat, lon]) => bounds.extend([lon, lat]),
      new mapboxgl.LngLatBounds()
    )

    map.fitBounds(bounds, { padding: 50, duration: 1000 })
  }, [visits, path, map])
}
```

**Alternative (cleaner):** Use `mapRef` directly:
```jsx
const mapRef = useRef()

useEffect(() => {
  if (!mapRef.current) return
  const map = mapRef.current.getMap()
  // ... fitBounds logic
}, [visits, path])

<Map ref={mapRef} ... />
```

### 5. Fly To Selected Visit

**Leaflet:**
```jsx
map.flyTo([visit.lat, visit.lon], 17, { duration: 0.8 })
```

**Mapbox:**
```jsx
map.flyTo({
  center: [visit.lon, visit.lat],  // [lng, lat]
  zoom: 17,
  duration: 800
})
```

### 6. Weather Mood Overlay

**No change needed** - This is a CSS overlay on top of the map container:
```jsx
{weatherMood && (
  <div
    className="weather-mood-overlay"
    style={{ background: weatherMood }}
  />
)}
```

---

## Complete MapPane.jsx Template

```jsx
import { useEffect, useRef, useCallback } from 'react'
import Map, { Marker, Source, Layer } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN

// Activity type colors (unchanged)
function getPathColor(activityType) {
  const type = (activityType || '').toLowerCase()
  if (type.includes('walk')) return '#34d399'
  if (type.includes('bik') || type.includes('cycl')) return '#2dd4bf'
  if (type.includes('vehicle') || type.includes('driv')) return '#fb923c'
  if (type.includes('transit')) return '#60a5fa'
  return '#9ca3af'
}

// Marker colors (unchanged)
const colors = {
  home: '#34d399',
  work: '#60a5fa',
  default: '#f59e0b',
}

function getColor(semanticType) {
  const type = (semanticType || '').toLowerCase()
  if (type.includes('home')) return colors.home
  if (type.includes('work')) return colors.work
  return colors.default
}

// Weather mood (unchanged)
function getWeatherMood(condition) {
  const c = (condition || '').toLowerCase()
  if (c.includes('clear') || c.includes('sunny')) return 'rgba(251, 191, 36, 0.06)'
  if (c.includes('rain') || c.includes('drizzle')) return 'rgba(96, 165, 250, 0.04)'
  if (c.includes('snow')) return 'rgba(226, 232, 240, 0.05)'
  if (c.includes('fog') || c.includes('mist')) return 'rgba(184, 176, 164, 0.04)'
  if (c.includes('cloud') || c.includes('overcast')) return 'rgba(156, 163, 175, 0.03)'
  return null
}

export default function MapPane({ visits, path, isLoading, selectedVisit, onVisitClick, weatherCondition }) {
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

    const bounds = points.reduce((b, coord) => b.extend(coord), new mapboxgl.LngLatBounds())
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
        const bounds = points.reduce((b, coord) => b.extend(coord), new mapboxgl.LngLatBounds())
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

  return (
    <div className="map-container">
      {isLoading && (
        <div className="map-loading">
          <span>Loading map data...</span>
        </div>
      )}

      {weatherMood && (
        <div className="weather-mood-overlay" style={{ background: weatherMood }} />
      )}

      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        initialViewState={initialViewState}
        style={{ width: '100%', height: '100%' }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
      >
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
                className={`map-marker ${isSelected ? 'selected' : ''}`}
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
```

---

## CSS Updates (App.css)

### Remove Leaflet-specific styles
Delete any `.leaflet-*` overrides.

### Add/Update marker styles
```css
/* Map marker base */
.map-marker {
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
  cursor: pointer;
  transition: all 0.2s ease;
}

.map-marker.selected {
  box-shadow: 0 0 0 8px rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.4);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 8px rgba(255,255,255,0.2), 0 2px 8px rgba(0,0,0,0.4); }
  50% { box-shadow: 0 0 0 12px rgba(255,255,255,0.1), 0 2px 8px rgba(0,0,0,0.4); }
}

/* Mapbox overrides */
.mapboxgl-canvas {
  outline: none;
}

.mapboxgl-ctrl-logo,
.mapboxgl-ctrl-attrib {
  opacity: 0.5;
}
```

---

## Testing Checklist

- [ ] Map loads with dark style
- [ ] All visit markers display with correct numbers
- [ ] Marker colors match semantic type (home/work/other)
- [ ] Clicking marker selects visit, updates sidebar
- [ ] Clicking selected marker deselects it
- [ ] Selected marker has pulse animation
- [ ] Path segments render with correct colors
- [ ] Walking = green, cycling = teal, driving = orange, transit = blue
- [ ] Map fits bounds on initial load
- [ ] Map zooms to selected visit
- [ ] Map zooms back out when deselecting
- [ ] Weather mood overlay tints map
- [ ] Loading spinner shows while data loading
- [ ] No console errors
- [ ] Performance feels smooth (WebGL)

---

## Optional Enhancements (Post-Migration)

### 1. Custom Map Style
Create in Mapbox Studio:
- Muted road colors
- Hidden POI labels (or specific categories only)
- Custom water/land colors
- 3D building extrusions

### 2. POI Toggle
```jsx
// Toggle POI layer visibility
map.setLayoutProperty('poi-label', 'visibility', showPOIs ? 'visible' : 'none')
```

### 3. Terrain/Satellite Toggle
```jsx
<Map
  mapStyle={is3D ? 'mapbox://styles/mapbox/satellite-streets-v12' : 'mapbox://styles/mapbox/dark-v11'}
  terrain={is3D ? { source: 'mapbox-dem', exaggeration: 1.5 } : undefined}
/>
```

---

## Rollback Plan

If issues arise, the migration can be reverted:
1. `git revert` the MapPane changes
2. Restore leaflet/react-leaflet dependencies
3. The backend is unchanged, so no data migration needed

---

## Success Criteria

- [ ] All existing functionality works identically
- [ ] No visual regressions
- [ ] Map loads in under 2 seconds
- [ ] Mapbox token properly secured (env var)
- [ ] Ready for future style customization
