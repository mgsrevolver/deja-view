# PRD: Top Places - Frontend

**Project**: Deja View
**Date**: 2026-01-31
**Role**: Frontend Specialist
**Phase**: 7 (Polish & Integrations)

---

## Overview

Add a "Places" tab to the sidebar that displays the user's most-visited locations. Users can browse their top places, search for specific locations, and drill into any place to see their complete visit history.

**Tagline**: "Your favorite spots, ranked."

---

## User Experience

### Navigation

The sidebar gains a tab bar at the top:

```
┌─────────────────────────────────┐
│  [Day]  [Places]                │  ← tab bar
├─────────────────────────────────┤
│  (content changes based on tab) │
└─────────────────────────────────┘
```

- **Day tab** (default): Existing daily timeline view
- **Places tab**: Top places list with search

Tabs should be visually subtle - this is secondary navigation, not a major mode switch.

---

## Places Tab - List View

```
┌─────────────────────────────────┐
│  [Day]  [Places]                │
├─────────────────────────────────┤
│  🔍 Search places...            │
│                                 │
│  Sort: [Visits ▼] [Time]        │
│  ───────────────────────        │
│                                 │
│  1. Home                        │
│     47 visits · 304h total      │
│     ░░░░░░░░░░░░░░░░░░░░░░      │
│                                 │
│  2. Whole Foods Market          │
│     23 visits · 8h total        │
│     ░░░░░░░░░░░░                │
│                                 │
│  3. Central Park                │
│     18 visits · 12h total       │
│     ░░░░░░░░░░                  │
│                                 │
│  4. Blue Bottle Coffee          │
│     15 visits · 6h total        │
│     ░░░░░░░░                    │
│                                 │
│  ...                            │
│                                 │
│  [Load more]                    │
└─────────────────────────────────┘
```

### Elements

- **Search input**: Filters list as user types (debounced)
- **Sort toggle**: Switch between "Visits" and "Time" ranking
- **Place cards**: Rank number, name, stats, visual bar
- **Progress bar**: Relative to #1 place (longest bar = top place)
- **Pagination**: "Load more" button, default shows 10

### Interactions

- **Click place card** → Navigate to place detail view
- **Hover place card** → Highlight location on map
- **Search** → Filters list, updates as you type
- **Sort toggle** → Re-ranks list immediately

---

## Places Tab - Detail View

When a place is selected:

```
┌─────────────────────────────────┐
│  [Day]  [Places]                │
├─────────────────────────────────┤
│  ← Back to list                 │
│                                 │
│  ┌──────────────────────────┐   │
│  │                          │   │
│  │        [photo]           │   │
│  │                          │   │
│  └──────────────────────────┘   │
│                                 │
│  Central Park                   │
│  New York, NY                   │
│                                 │
│  ───────────────────────        │
│  18 visits · 12h 34m total      │
│  First: Mar 15, 2019            │  ← clickable
│  Last: Jan 15, 2026             │  ← clickable
│  ───────────────────────        │
│                                 │
│  All Visits                     │
│                                 │
│  Jan 15, 2026                   │
│    2:30 PM · 1h 15m         →   │
│                                 │
│  Dec 28, 2025                   │
│    11:00 AM · 1h 30m        →   │
│                                 │
│  Dec 14, 2025                   │
│    4:15 PM · 45 min         →   │
│                                 │
│  ...                            │
│                                 │
│  [Load more visits]             │
└─────────────────────────────────┘
```

### Elements

- **Back link**: Returns to place list (preserves search/sort state)
- **Photo**: Place photo if available, placeholder if not
- **Place name & location**: From enriched place data
- **Stats block**: Visit count, total time, first/last dates
- **First/Last dates**: Clickable - navigates to that day
- **Visit list**: All visits, most recent first
- **Visit row**: Date, time, duration, arrow indicator

### Interactions

- **Click "← Back"** → Return to list view
- **Click first/last date** → Switch to Day tab, navigate to that date
- **Click visit row or →** → Switch to Day tab, navigate to that date
- **Load more** → Fetch next page of visits

### Map Behavior

When viewing a place detail:
- Map centers on the place location
- Place marker highlighted/pulsing
- Zoom level appropriate to show the place in context

---

## Visual Design

### Tab Bar

```css
.sidebar-tabs {
  display: flex;
  border-bottom: 1px solid var(--border-color);
  padding: 0 16px;
}

.sidebar-tab {
  padding: 12px 16px;
  font-size: 14px;
  color: var(--text-muted);
  border-bottom: 2px solid transparent;
  cursor: pointer;
}

.sidebar-tab.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent-color);
}
```

### Place Card

```css
.place-card {
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background 0.15s;
}

.place-card:hover {
  background: var(--hover-bg);
}

.place-rank {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 4px;
}

.place-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.place-stats {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.place-bar {
  height: 4px;
  background: var(--accent-color);
  border-radius: 2px;
  opacity: 0.6;
}
```

### Sort Toggle

```css
.sort-toggle {
  display: flex;
  gap: 8px;
  padding: 8px 16px;
}

.sort-option {
  padding: 4px 12px;
  font-size: 13px;
  border-radius: 4px;
  cursor: pointer;
}

.sort-option.active {
  background: var(--accent-bg);
  color: var(--accent-color);
}
```

---

## Technical Implementation

### New Components

#### `SidebarTabs.jsx`

```jsx
export default function SidebarTabs({ activeTab, onTabChange }) {
  return (
    <div className="sidebar-tabs">
      <button
        className={`sidebar-tab ${activeTab === 'day' ? 'active' : ''}`}
        onClick={() => onTabChange('day')}
      >
        Day
      </button>
      <button
        className={`sidebar-tab ${activeTab === 'places' ? 'active' : ''}`}
        onClick={() => onTabChange('places')}
      >
        Places
      </button>
    </div>
  )
}
```

#### `TopPlacesList.jsx`

```jsx
export default function TopPlacesList({
  onPlaceSelect,
  onPlaceHover,
  onPlaceHoverEnd
}) {
  const [sortBy, setSortBy] = useState('visits')
  const [search, setSearch] = useState('')
  const [debouncedSearch] = useDebounce(search, 300)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['top-places', sortBy, debouncedSearch],
    queryFn: ({ pageParam = 0 }) => fetchWithAuth(
      `/api/places/top?` + new URLSearchParams({
        sortBy,
        search: debouncedSearch,
        limit: 10,
        offset: pageParam
      })
    ),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined
  })

  const places = data?.pages.flatMap(p => p.places) || []
  const maxVisits = places[0]?.visitCount || 1
  const maxTime = places[0]?.totalMinutes || 1

  return (
    <div className="top-places-list">
      <div className="places-search">
        <input
          type="text"
          placeholder="Search places..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="sort-toggle">
        <button
          className={`sort-option ${sortBy === 'visits' ? 'active' : ''}`}
          onClick={() => setSortBy('visits')}
        >
          Visits
        </button>
        <button
          className={`sort-option ${sortBy === 'time' ? 'active' : ''}`}
          onClick={() => setSortBy('time')}
        >
          Time
        </button>
      </div>

      <div className="places-list">
        {places.map((place, idx) => (
          <div
            key={place.placeId}
            className="place-card"
            onClick={() => onPlaceSelect(place)}
            onMouseEnter={() => onPlaceHover(place)}
            onMouseLeave={onPlaceHoverEnd}
          >
            <div className="place-rank">#{idx + 1}</div>
            <div className="place-name">{place.name}</div>
            <div className="place-stats">
              {place.visitCount} visits · {formatDuration(place.totalMinutes)}
            </div>
            <div
              className="place-bar"
              style={{
                width: `${(sortBy === 'visits'
                  ? place.visitCount / maxVisits
                  : place.totalMinutes / maxTime) * 100}%`
              }}
            />
          </div>
        ))}
      </div>

      {hasNextPage && (
        <button
          className="load-more-btn"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading...' : 'Load more'}
        </button>
      )}
    </div>
  )
}
```

#### `PlaceDetailView.jsx`

```jsx
export default function PlaceDetailView({
  placeId,
  onBack,
  onNavigateToDate
}) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage
  } = useInfiniteQuery({
    queryKey: ['place-visits', placeId],
    queryFn: ({ pageParam = 0 }) => fetchWithAuth(
      `/api/places/${placeId}/visits?` + new URLSearchParams({
        limit: 20,
        offset: pageParam,
        tz: timezone
      })
    ),
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore
        ? lastPage.pagination.offset + lastPage.pagination.limit
        : undefined
  })

  const place = data?.pages[0]?.place
  const visits = data?.pages.flatMap(p => p.visits) || []

  if (!place) return <div className="loading">Loading...</div>

  return (
    <div className="place-detail-view">
      <button className="back-link" onClick={onBack}>
        ← Back to list
      </button>

      {place.photoUrl && (
        <div className="place-photo">
          <img src={place.photoUrl} alt={place.name} />
        </div>
      )}

      <h2 className="place-title">{place.name}</h2>

      <div className="place-stats-block">
        <div className="stat-row">
          <span>{place.visitCount} visits</span>
          <span>·</span>
          <span>{formatDuration(place.totalMinutes)} total</span>
        </div>
        <div className="stat-row">
          <span>First: </span>
          <button
            className="date-link"
            onClick={() => onNavigateToDate(place.firstVisit)}
          >
            {formatDateDisplay(place.firstVisit)}
          </button>
        </div>
        <div className="stat-row">
          <span>Last: </span>
          <button
            className="date-link"
            onClick={() => onNavigateToDate(place.lastVisit)}
          >
            {formatDateDisplay(place.lastVisit)}
          </button>
        </div>
      </div>

      <h3 className="visits-header">All Visits</h3>

      <ul className="visits-list">
        {visits.map((visit, idx) => (
          <li
            key={idx}
            className="visit-row"
            onClick={() => onNavigateToDate(visit.date)}
          >
            <div className="visit-date">{formatDateDisplay(visit.date)}</div>
            <div className="visit-time">
              {visit.startTime} · {formatDuration(visit.duration)}
            </div>
            <span className="visit-arrow">→</span>
          </li>
        ))}
      </ul>

      {hasNextPage && (
        <button
          className="load-more-btn"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading...' : 'Load more visits'}
        </button>
      )}
    </div>
  )
}
```

### State Management

In `JournalView.jsx`:

```jsx
const [sidebarTab, setSidebarTab] = useState('day')  // 'day' | 'places'
const [selectedPlace, setSelectedPlace] = useState(null)  // for detail view
const [hoveredPlace, setHoveredPlace] = useState(null)  // for map highlight

// Handle place selection from list
const handlePlaceSelect = (place) => {
  setSelectedPlace(place)
  // Center map on place
  mapRef.current?.flyTo({
    center: [place.lon, place.lat],
    zoom: 15
  })
}

// Handle navigation to date from place detail
const handleNavigateToDate = (date) => {
  setSidebarTab('day')
  setSelectedPlace(null)
  setSelectedDate(date)
}

// Handle back from place detail
const handleBackToList = () => {
  setSelectedPlace(null)
}
```

### Map Integration

When a place is hovered or selected, highlight it on the map:

```jsx
// In MapPane.jsx

{hoveredPlace && (
  <Marker
    latitude={hoveredPlace.lat}
    longitude={hoveredPlace.lon}
  >
    <div className="highlighted-place-marker" />
  </Marker>
)}

{selectedPlace && (
  <Marker
    latitude={selectedPlace.lat}
    longitude={selectedPlace.lon}
  >
    <div className="selected-place-marker pulsing" />
  </Marker>
)}
```

```css
.highlighted-place-marker {
  width: 20px;
  height: 20px;
  background: rgba(245, 158, 11, 0.5);
  border: 2px solid rgb(245, 158, 11);
  border-radius: 50%;
}

.selected-place-marker {
  width: 24px;
  height: 24px;
  background: rgb(245, 158, 11);
  border: 3px solid white;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
}

.pulsing {
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.2); opacity: 0.8; }
}
```

---

## Files to Create/Modify

| File | Action |
|------|--------|
| `frontend/src/components/SidebarTabs.jsx` | **Create** - Tab navigation |
| `frontend/src/components/TopPlacesList.jsx` | **Create** - Places list with search/sort |
| `frontend/src/components/PlaceDetailView.jsx` | **Create** - Place detail with visit list |
| `frontend/src/components/Sidebar.jsx` | Add tabs, conditionally render day view or places view |
| `frontend/src/components/JournalView.jsx` | Add sidebarTab state, place selection handlers |
| `frontend/src/components/MapPane.jsx` | Add highlighted/selected place markers |
| `frontend/src/index.css` | Add styles for tabs, place cards, detail view |

---

## API Dependency

**Requires backend endpoints**:
- `GET /api/places/top` - Ranked place list
- `GET /api/places/:placeId/visits` - Place visit history

See `prd-2026-01-31-top-places-backend.md` for endpoint specs.

---

## Acceptance Criteria

- [ ] Sidebar has Day/Places tabs, switching views
- [ ] Places tab shows top 10 places by default
- [ ] Search input filters places by name
- [ ] Sort toggle switches between visits and time ranking
- [ ] Place cards show rank, name, stats, relative bar
- [ ] Hovering place card highlights location on map
- [ ] Clicking place card shows detail view
- [ ] Detail view shows place photo, stats, all visits
- [ ] First/last visit dates are clickable, navigate to that day
- [ ] Visit rows are clickable, navigate to that day
- [ ] Back button returns to list (preserves search/sort)
- [ ] Map centers and highlights place when viewing detail
- [ ] Pagination works for both list and detail views
- [ ] Smooth transitions between views

---

## Out of Scope (Future)

- Favorite/star places
- Place categories or tags
- "On this day" integration
- Export places list
- Place comparison view
- Heat map of place visits over time
