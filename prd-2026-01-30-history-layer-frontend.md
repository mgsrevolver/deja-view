# PRD: History Layer - Frontend

**Project**: Deja View
**Date**: 2026-01-30
**Role**: Frontend Specialist
**Phase**: 7 (Polish & Integrations)

---

## Overview

Add a "History Layer" to the map showing all historical visits beyond the current day. This reveals the user's spatial patterns - places they frequent, areas they've explored, memories embedded in locations.

**Tagline**: "You've been here before."

---

## User Experience

### Two Modes

| Mode | Visual | Interaction |
|------|--------|-------------|
| **Passive** (default) | Faint ghost markers behind today's visits | View only, provides ambient awareness |
| **Active** (toggled) | Prominent clusters with counts | Click to explore, open place history |

### Passive Mode
- Semi-transparent markers/clusters always visible
- Muted color (gray or desaturated amber)
- Smaller than today's markers
- Does not interfere with current day interaction
- "I come to this area a lot" awareness

### Active Mode
- Toggle via button in map controls
- History markers become more prominent
- Show visit count badges on clusters
- Today's markers dim slightly
- Clicking a cluster opens **Place History Modal**

---

## Visual Design

### Passive Mode Markers

```css
/* Ghost marker style */
.history-marker {
  background: rgba(156, 163, 175, 0.4);  /* muted gray */
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 1px solid rgba(156, 163, 175, 0.6);
}

/* When clustered, show as slightly larger */
.history-cluster {
  background: rgba(156, 163, 175, 0.5);
  min-width: 20px;
  min-height: 20px;
  font-size: 10px;
}
```

### Active Mode Markers

```css
.history-mode-active .history-marker {
  background: rgba(245, 158, 11, 0.6);  /* amber */
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.history-mode-active .history-cluster {
  background: rgba(245, 158, 11, 0.7);
  min-width: 28px;
  padding: 4px 8px;
  font-weight: 600;
}

/* Dim today's markers slightly */
.history-mode-active .map-marker {
  opacity: 0.7;
}
```

### Cluster Badge

```
    ┌─────┐
    │ 12  │   ← visit count
    └─────┘
```

At high zoom, individual places show as single markers (no count, or "1" hidden).

---

## Place History Modal

When user clicks a history marker/cluster in active mode:

```
┌────────────────────────────────────────────┐
│  ┌──────┐                              ✕   │
│  │ foto │  Empire State Building           │
│  └──────┘  350 5th Ave, New York           │
│                                            │
│  ─────────────────────────────────────     │
│  12 visits · 8h 23m total                  │
│  First: May 22, 2013 · Last: Dec 14, 2025  │
│  ─────────────────────────────────────     │
│                                            │
│  Dec 14, 2025    2:30 PM    45 min    →    │
│  Aug 3, 2025     10:15 AM   1h 0m     →    │
│  Mar 18, 2025    6:45 PM    30 min    →    │
│  Nov 22, 2024    12:00 PM   1h 15m    →    │
│  ...                                       │
│                                            │
│  [Show all 12 visits]                      │
└────────────────────────────────────────────┘
```

**Interactions**:
- Click `→` or row → navigates to that date (closes modal, changes day)
- Click `✕` → closes modal, returns to current view
- Scrollable list if many visits
- "Show all" expands truncated list

---

## Technical Implementation

### New Components

#### `HistoryLayer.jsx`

Renders the ghost markers using Mapbox clustering.

```jsx
import { Source, Layer } from 'react-map-gl'

export default function HistoryLayer({ places, isActive, onClusterClick }) {
  // Convert places to GeoJSON
  const geojson = {
    type: 'FeatureCollection',
    features: places.map(place => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [place.lon, place.lat]
      },
      properties: {
        placeId: place.placeId,
        name: place.name,
        visitCount: place.visitCount,
        ...place
      }
    }))
  }

  return (
    <Source
      id="history"
      type="geojson"
      data={geojson}
      cluster={true}
      clusterMaxZoom={16}
      clusterRadius={50}
    >
      {/* Clustered points */}
      <Layer
        id="history-clusters"
        type="circle"
        filter={['has', 'point_count']}
        paint={{
          'circle-color': isActive
            ? 'rgba(245, 158, 11, 0.7)'
            : 'rgba(156, 163, 175, 0.4)',
          'circle-radius': [
            'step', ['get', 'point_count'],
            15, 10,
            20, 50,
            25
          ]
        }}
      />

      {/* Cluster count labels */}
      <Layer
        id="history-cluster-count"
        type="symbol"
        filter={['has', 'point_count']}
        layout={{
          'text-field': '{point_count_abbreviated}',
          'text-size': 11
        }}
        paint={{
          'text-color': '#ffffff'
        }}
      />

      {/* Individual points */}
      <Layer
        id="history-points"
        type="circle"
        filter={['!', ['has', 'point_count']]}
        paint={{
          'circle-color': isActive
            ? 'rgba(245, 158, 11, 0.6)'
            : 'rgba(156, 163, 175, 0.35)',
          'circle-radius': isActive ? 8 : 5,
          'circle-stroke-width': 1,
          'circle-stroke-color': isActive
            ? 'rgba(245, 158, 11, 0.8)'
            : 'rgba(156, 163, 175, 0.5)'
        }}
      />
    </Source>
  )
}
```

#### `PlaceHistoryModal.jsx`

```jsx
export default function PlaceHistoryModal({ place, onClose, onNavigateToDate }) {
  if (!place) return null

  const [showAll, setShowAll] = useState(false)
  const visitsToShow = showAll ? place.visits : place.visits.slice(0, 5)

  return (
    <div className="place-history-modal-overlay" onClick={onClose}>
      <div className="place-history-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        <div className="modal-header">
          {place.photoUrl && (
            <img src={place.photoUrl} alt="" className="modal-photo" />
          )}
          <div>
            <h3>{place.name}</h3>
          </div>
        </div>

        <div className="modal-stats">
          <span>{place.visitCount} visits</span>
          <span>·</span>
          <span>{formatDuration(place.totalMinutes)} total</span>
        </div>
        <div className="modal-date-range">
          First: {place.firstVisit} · Last: {place.lastVisit}
        </div>

        <ul className="visit-list">
          {visitsToShow.map((visit, idx) => (
            <li key={idx} onClick={() => onNavigateToDate(visit.date)}>
              <span className="visit-date">{formatDate(visit.date)}</span>
              <span className="visit-time">{visit.startTime}</span>
              <span className="visit-duration">{visit.duration} min</span>
              <span className="visit-arrow">→</span>
            </li>
          ))}
        </ul>

        {place.visits.length > 5 && !showAll && (
          <button
            className="show-all-btn"
            onClick={() => setShowAll(true)}
          >
            Show all {place.visitCount} visits
          </button>
        )}
      </div>
    </div>
  )
}
```

### State Management

In `JournalView.jsx`:

```jsx
const [historyMode, setHistoryMode] = useState('passive')  // 'passive' | 'active'
const [selectedHistoryPlace, setSelectedHistoryPlace] = useState(null)

// Toggle function
const toggleHistoryMode = () => {
  setHistoryMode(prev => prev === 'passive' ? 'active' : 'passive')
  setSelectedHistoryPlace(null)
}

// Navigate to date from modal
const handleNavigateToDate = (date) => {
  setSelectedHistoryPlace(null)
  setHistoryMode('passive')
  setSelectedDate(date)  // existing date state
}
```

### Data Fetching

```jsx
// In JournalView.jsx or custom hook

const [viewport, setViewport] = useState(null)

// Debounced viewport update
const handleMapMove = useMemo(
  () => debounce((evt) => {
    const bounds = evt.target.getBounds()
    setViewport({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest()
    })
  }, 300),
  []
)

// Fetch history for viewport
const { data: historyData } = useQuery({
  queryKey: ['viewport-history', viewport, selectedDate],
  queryFn: () => fetchWithAuth(
    `/api/visits/viewport?` + new URLSearchParams({
      north: viewport.north,
      south: viewport.south,
      east: viewport.east,
      west: viewport.west,
      excludeDate: selectedDate,
      tz: timezone
    })
  ),
  enabled: !!viewport,
  staleTime: 60000  // 1 minute
})
```

### Click Handling

```jsx
// In MapPane.jsx

<Map
  onMoveEnd={onMapMove}
  interactiveLayerIds={historyMode === 'active' ? ['history-clusters', 'history-points'] : []}
  onClick={(e) => {
    if (historyMode !== 'active') return

    const feature = e.features?.[0]
    if (!feature) return

    if (feature.layer.id === 'history-clusters') {
      // Zoom into cluster
      const clusterId = feature.properties.cluster_id
      const source = e.target.getSource('history')
      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        e.target.easeTo({
          center: feature.geometry.coordinates,
          zoom: zoom
        })
      })
    } else if (feature.layer.id === 'history-points') {
      // Open modal for this place
      onHistoryPlaceClick(feature.properties)
    }
  }}
>
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `frontend/src/components/HistoryLayer.jsx` | **Create** - Ghost markers layer |
| `frontend/src/components/PlaceHistoryModal.jsx` | **Create** - Exploration modal |
| `frontend/src/components/MapPane.jsx` | Add HistoryLayer, click handlers, onMapMove |
| `frontend/src/components/JournalView.jsx` | Add history state, toggle, viewport tracking |
| `frontend/src/components/Sidebar.jsx` | Add history mode toggle button |
| `frontend/src/index.css` | Add modal and history marker styles |

---

## Toggle Button

Add to Sidebar header or map controls:

```jsx
<button
  className={`history-toggle ${historyMode === 'active' ? 'active' : ''}`}
  onClick={toggleHistoryMode}
  title="Toggle history exploration"
>
  <ClockIcon />  {/* or "H" text, or ghost icon */}
</button>
```

---

## API Dependency

**Requires backend endpoint**: `GET /api/visits/viewport`

See `prd-2026-01-30-history-layer-backend.md` for endpoint spec.

**Response shape expected**:
```json
{
  "places": [
    {
      "placeId": "...",
      "lat": 40.7484,
      "lon": -73.9857,
      "name": "Empire State Building",
      "photoUrl": "https://...",
      "visitCount": 12,
      "totalMinutes": 503,
      "firstVisit": "2013-05-22",
      "lastVisit": "2025-12-14",
      "visits": [
        { "date": "2025-12-14", "startTime": "14:30", "duration": 45 }
      ]
    }
  ]
}
```

---

## Acceptance Criteria

- [ ] Ghost markers visible in passive mode (faint, non-interactive)
- [ ] Toggle button switches between passive and active mode
- [ ] Active mode: markers more prominent, today's markers dimmed
- [ ] Clicking cluster in active mode zooms in
- [ ] Clicking individual place opens PlaceHistoryModal
- [ ] Modal shows place name, photo, visit count, total time
- [ ] Modal lists visits with date, time, duration
- [ ] Clicking a visit date navigates to that day
- [ ] Viewport-based fetching (debounced on map move)
- [ ] Current day's visits excluded from history layer
- [ ] Smooth visual transitions between modes

---

## Out of Scope (Future)

- Heatmap visualization toggle
- Time-period filtering ("show only 2024")
- Keyboard shortcut (H key)
- "On this day" feature
- Place favoriting/starring
