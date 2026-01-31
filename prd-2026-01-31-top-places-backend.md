# PRD: Top Places - Backend

**Project**: Deja View
**Date**: 2026-01-31
**Role**: Backend Specialist
**Phase**: 7 (Polish & Integrations)

---

## Overview

Create API endpoints to support the "Top Places" feature - a ranked list of the user's most-visited locations with search, filtering, and pagination.

**Why**: The frontend needs to display a browsable, searchable list of places ranked by visit frequency or time spent. This requires endpoints that aggregate visit data across all places, not just a viewport.

---

## New Endpoints

### `GET /api/places/top`

Returns the user's places ranked by visit count or total time.

**Authentication**: Required (Bearer token)

**Query Parameters**:

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `sortBy` | string | No | `visits` | Sort order: `visits` or `time` |
| `limit` | int | No | 10 | Number of places to return (max 100) |
| `offset` | int | No | 0 | Pagination offset |
| `search` | string | No | - | Filter by place name (case-insensitive partial match) |
| `tz` | string | No | UTC | Timezone for date formatting |

**Example Request**:
```
GET /api/places/top?sortBy=visits&limit=10&offset=0&tz=America/New_York
```

**Response**:
```json
{
  "places": [
    {
      "placeId": "place_abc123",
      "lat": 40.7484,
      "lon": -73.9857,
      "name": "Home",
      "photoUrl": "https://...",
      "visitCount": 47,
      "totalMinutes": 18240,
      "firstVisit": "2019-03-15",
      "lastVisit": "2026-01-28"
    },
    {
      "placeId": "place_def456",
      "lat": 40.7527,
      "lon": -73.9772,
      "name": "Whole Foods",
      "photoUrl": null,
      "visitCount": 23,
      "totalMinutes": 480,
      "firstVisit": "2020-06-22",
      "lastVisit": "2026-01-25"
    }
  ],
  "pagination": {
    "total": 156,
    "limit": 10,
    "offset": 0,
    "hasMore": true
  }
}
```

---

### `GET /api/places/:placeId/visits`

Returns all visits for a specific place.

**Authentication**: Required (Bearer token)

**Path Parameters**:

| Param | Type | Description |
|-------|------|-------------|
| `placeId` | string | The place ID |

**Query Parameters**:

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `limit` | int | No | 50 | Number of visits to return |
| `offset` | int | No | 0 | Pagination offset |
| `tz` | string | No | UTC | Timezone for date/time formatting |

**Example Request**:
```
GET /api/places/place_abc123/visits?limit=20&tz=America/New_York
```

**Response**:
```json
{
  "place": {
    "placeId": "place_abc123",
    "lat": 40.7484,
    "lon": -73.9857,
    "name": "Central Park",
    "photoUrl": "https://...",
    "visitCount": 18,
    "totalMinutes": 754,
    "firstVisit": "2019-03-15",
    "lastVisit": "2026-01-15"
  },
  "visits": [
    {
      "date": "2026-01-15",
      "startTime": "14:30",
      "endTime": "15:45",
      "duration": 75
    },
    {
      "date": "2025-12-28",
      "startTime": "11:00",
      "endTime": "12:30",
      "duration": 90
    }
  ],
  "pagination": {
    "total": 18,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  }
}
```

---

## Implementation Details

### Top Places Query

```javascript
async function getTopPlaces(req, res) {
  const { sortBy = 'visits', limit = 10, offset = 0, search, tz = 'UTC' } = req.query
  const userId = req.user.id
  const limitNum = Math.min(parseInt(limit), 100)
  const offsetNum = parseInt(offset) || 0

  // Aggregate visits by place
  const placesAgg = await prisma.visit.groupBy({
    by: ['placeId'],
    where: {
      userId,
      place: search ? {
        name: { contains: search, mode: 'insensitive' }
      } : undefined
    },
    _count: { id: true },
    _sum: { durationMinutes: true },
    _min: { startTime: true },
    _max: { startTime: true }
  })

  // Sort by chosen metric
  const sorted = placesAgg.sort((a, b) => {
    if (sortBy === 'time') {
      return (b._sum.durationMinutes || 0) - (a._sum.durationMinutes || 0)
    }
    return b._count.id - a._count.id
  })

  const total = sorted.length
  const paginated = sorted.slice(offsetNum, offsetNum + limitNum)

  // Fetch place details
  const placeIds = paginated.map(p => p.placeId)
  const places = await prisma.place.findMany({
    where: { id: { in: placeIds } },
    select: { id: true, name: true, photoUrl: true, lat: true, lon: true }
  })
  const placeMap = new Map(places.map(p => [p.id, p]))

  // Build response
  const result = paginated.map(agg => {
    const place = placeMap.get(agg.placeId) || {}
    return {
      placeId: agg.placeId,
      lat: place.lat,
      lon: place.lon,
      name: place.name || 'Unknown',
      photoUrl: place.photoUrl || null,
      visitCount: agg._count.id,
      totalMinutes: agg._sum.durationMinutes || 0,
      firstVisit: formatDate(agg._min.startTime, tz),
      lastVisit: formatDate(agg._max.startTime, tz)
    }
  })

  return res.json({
    places: result,
    pagination: {
      total,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + limitNum < total
    }
  })
}
```

### Place Visits Query

```javascript
async function getPlaceVisits(req, res) {
  const { placeId } = req.params
  const { limit = 50, offset = 0, tz = 'UTC' } = req.query
  const userId = req.user.id
  const limitNum = Math.min(parseInt(limit), 100)
  const offsetNum = parseInt(offset) || 0

  // Get place details with aggregates
  const [place, visits, countResult] = await Promise.all([
    prisma.place.findUnique({
      where: { id: placeId },
      select: { id: true, name: true, photoUrl: true, lat: true, lon: true }
    }),
    prisma.visit.findMany({
      where: { userId, placeId },
      orderBy: { startTime: 'desc' },
      skip: offsetNum,
      take: limitNum
    }),
    prisma.visit.aggregate({
      where: { userId, placeId },
      _count: { id: true },
      _sum: { durationMinutes: true },
      _min: { startTime: true },
      _max: { startTime: true }
    })
  ])

  if (!place) {
    return res.status(404).json({ error: 'Place not found' })
  }

  return res.json({
    place: {
      placeId: place.id,
      lat: place.lat,
      lon: place.lon,
      name: place.name || 'Unknown',
      photoUrl: place.photoUrl || null,
      visitCount: countResult._count.id,
      totalMinutes: countResult._sum.durationMinutes || 0,
      firstVisit: formatDate(countResult._min.startTime, tz),
      lastVisit: formatDate(countResult._max.startTime, tz)
    },
    visits: visits.map(v => ({
      date: formatDate(v.startTime, tz),
      startTime: formatTime(v.startTime, tz),
      endTime: v.endTime ? formatTime(v.endTime, tz) : null,
      duration: v.durationMinutes
    })),
    pagination: {
      total: countResult._count.id,
      limit: limitNum,
      offset: offsetNum,
      hasMore: offsetNum + limitNum < countResult._count.id
    }
  })
}
```

---

## Performance Considerations

1. **Index on placeId**: Ensure Visit table has index for groupBy
   ```sql
   CREATE INDEX idx_visit_user_place ON "Visit" ("userId", "placeId");
   ```

2. **Search performance**: The `contains` filter on place name may need optimization for large datasets. Consider:
   - Adding a text search index on Place.name
   - Caching top places (infrequently changes)

3. **Pagination**: Always use pagination - users with 10+ years of history may have thousands of places.

---

## Files to Modify

| File | Changes |
|------|---------|
| `backend/src/server.js` | Add `/api/places/top` and `/api/places/:placeId/visits` routes |

---

## Testing

```bash
# Get top 10 places by visits
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/places/top?sortBy=visits&limit=10"

# Get top places by time spent
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/places/top?sortBy=time&limit=10"

# Search places
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/places/top?search=coffee&limit=20"

# Get visits for a place
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3001/api/places/place_abc123/visits"
```

---

## Acceptance Criteria

- [ ] `/api/places/top` returns places sorted by visit count (default)
- [ ] `/api/places/top?sortBy=time` returns places sorted by total time
- [ ] Pagination works correctly (limit, offset, hasMore)
- [ ] Search filters by place name (case-insensitive)
- [ ] `/api/places/:placeId/visits` returns all visits for a place
- [ ] Visits sorted by date descending (most recent first)
- [ ] Proper auth check (user can only see own data)
- [ ] Reasonable performance (<500ms for typical requests)

---

## Out of Scope

- Caching layer for top places
- Full-text search (simple contains is sufficient for now)
- Place categories/tags
- User-defined favorites (future feature)
