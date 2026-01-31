# PRD: History Layer - Backend

**Project**: Deja View
**Date**: 2026-01-30
**Role**: Backend Specialist
**Phase**: 7 (Polish & Integrations)

---

## Overview

Create a new API endpoint that returns historical visits within a map viewport. This powers the "History Layer" feature - a ghost layer showing all visits beyond the current day, revealing the user's spatial patterns over time.

**Why**: The frontend needs to display faint markers for historical visits. Loading all 18k visits at once is not feasible, so we need viewport-based queries with intelligent grouping.

---

## New Endpoint

### `GET /api/visits/viewport`

Returns visits within a geographic bounding box, grouped by place.

**Authentication**: Required (Bearer token)

**Query Parameters**:

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `north` | float | Yes | North latitude bound |
| `south` | float | Yes | South latitude bound |
| `east` | float | Yes | East longitude bound |
| `west` | float | Yes | West longitude bound |
| `excludeDate` | string | No | Date to exclude (YYYY-MM-DD), typically current day |
| `tz` | string | No | Timezone for date handling (default: UTC) |

**Example Request**:
```
GET /api/visits/viewport?north=40.77&south=40.73&east=-73.95&west=-74.01&excludeDate=2026-01-30&tz=America/New_York
```

**Response**:
```json
{
  "places": [
    {
      "placeId": "place_abc123",
      "lat": 40.7484,
      "lon": -73.9857,
      "name": "Empire State Building",
      "photoUrl": "https://...",
      "visitCount": 12,
      "totalMinutes": 503,
      "firstVisit": "2013-05-22",
      "lastVisit": "2025-12-14",
      "visits": [
        {
          "date": "2025-12-14",
          "startTime": "14:30",
          "duration": 45
        },
        {
          "date": "2025-08-03",
          "startTime": "10:15",
          "duration": 60
        }
      ]
    },
    {
      "placeId": "place_def456",
      "lat": 40.7527,
      "lon": -73.9772,
      "name": "Grand Central Terminal",
      "photoUrl": null,
      "visitCount": 47,
      "totalMinutes": 892,
      "firstVisit": "2013-03-15",
      "lastVisit": "2026-01-28",
      "visits": [...]
    }
  ],
  "summary": {
    "totalPlaces": 23,
    "totalVisits": 156
  }
}
```

---

## Implementation Details

### Query Logic

```javascript
// Pseudocode for the endpoint

async function getViewportVisits(req, res) {
  const { north, south, east, west, excludeDate, tz } = req.query
  const userId = req.user.id

  // 1. Query visits within bounding box
  const visits = await prisma.visit.findMany({
    where: {
      userId,
      lat: { gte: parseFloat(south), lte: parseFloat(north) },
      lon: { gte: parseFloat(west), lte: parseFloat(east) },
      // Exclude current day if specified
      ...(excludeDate && {
        NOT: {
          startTime: {
            gte: startOfDay(excludeDate, tz),
            lt: endOfDay(excludeDate, tz)
          }
        }
      })
    },
    include: {
      place: {
        select: {
          id: true,
          googlePlaceId: true,
          name: true,
          photoUrl: true
        }
      }
    },
    orderBy: { startTime: 'desc' }
  })

  // 2. Group by place
  const placeMap = new Map()

  for (const visit of visits) {
    const placeId = visit.placeId
    if (!placeMap.has(placeId)) {
      placeMap.set(placeId, {
        placeId,
        lat: visit.lat,
        lon: visit.lon,
        name: visit.place?.name || 'Unknown',
        photoUrl: visit.place?.photoUrl || null,
        visits: [],
        totalMinutes: 0
      })
    }

    const place = placeMap.get(placeId)
    place.visits.push({
      date: formatDate(visit.startTime, tz),
      startTime: formatTime(visit.startTime, tz),
      duration: visit.durationMinutes
    })
    place.totalMinutes += visit.durationMinutes || 0
  }

  // 3. Compute aggregates
  const places = Array.from(placeMap.values()).map(place => ({
    ...place,
    visitCount: place.visits.length,
    firstVisit: place.visits[place.visits.length - 1]?.date,
    lastVisit: place.visits[0]?.date
  }))

  // 4. Sort by visit count (most visited first)
  places.sort((a, b) => b.visitCount - a.visitCount)

  return res.json({
    places,
    summary: {
      totalPlaces: places.length,
      totalVisits: visits.length
    }
  })
}
```

### Performance Considerations

1. **Index on lat/lon**: Ensure Visit table has index on (userId, lat, lon)
   ```sql
   CREATE INDEX idx_visit_user_location ON "Visit" ("userId", lat, lon);
   ```

2. **Limit visits array**: For places with many visits, consider limiting to most recent N:
   ```javascript
   visits: place.visits.slice(0, 50)  // Cap at 50 most recent
   ```

3. **Response size**: Typical viewport might return 20-100 places. If larger, frontend will cluster.

---

## Database Considerations

### Existing Schema (no changes needed)

The Visit table already has `lat`, `lon`, `placeId`, `startTime`, `durationMinutes`.

### Recommended Index

Add to `prisma/schema.prisma` or run manually:

```prisma
// In schema.prisma, add index to Visit model
@@index([userId, lat, lon])
```

Then run:
```bash
npx prisma db push
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `backend/src/server.js` | Add `/api/visits/viewport` route |

---

## Testing

```bash
# Test with curl (replace token)
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/visits/viewport?north=40.77&south=40.73&east=-73.95&west=-74.01&excludeDate=2026-01-30&tz=America/New_York"
```

**Expected behavior**:
- Returns places grouped with visit arrays
- Excludes visits from excludeDate
- Sorted by visitCount descending
- Includes enriched place data (name, photo) when available

---

## Acceptance Criteria

- [ ] Endpoint returns visits within bounding box
- [ ] Visits grouped by placeId
- [ ] excludeDate parameter filters out specified day
- [ ] Response includes place name and photo from enrichment
- [ ] Response includes visitCount, totalMinutes, firstVisit, lastVisit
- [ ] Visits array sorted by date descending (most recent first)
- [ ] Proper auth check (user can only see own visits)
- [ ] Reasonable performance (<500ms for typical viewport)

---

## Out of Scope

- Server-side clustering (frontend handles this)
- Spatial database extensions (PostGIS)
- Caching layer
