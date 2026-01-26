import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Déjà View API is running',
    timestamp: new Date().toISOString()
  });
});

// Test database connection
app.get('/api/test-db', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      message: 'Database connection successful',
      database: 'Supabase PostgreSQL'
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// Get overall stats and date range
app.get('/api/stats', async (req, res) => {
  try {
    const [visitCount, placeCount, dateRange] = await Promise.all([
      prisma.visit.count(),
      prisma.place.count(),
      prisma.visit.aggregate({
        _min: { startTime: true },
        _max: { startTime: true }
      })
    ]);

    res.json({
      totalVisits: visitCount,
      totalPlaces: placeCount,
      firstDate: dateRange._min.startTime,
      lastDate: dateRange._max.startTime
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get days with visit counts (for calendar highlighting)
app.get('/api/days', async (req, res) => {
  try {
    const { month } = req.query; // Format: YYYY-MM

    let whereClause = {};
    if (month) {
      const [year, m] = month.split('-').map(Number);
      const startOfMonth = new Date(Date.UTC(year, m - 1, 1));
      const endOfMonth = new Date(Date.UTC(year, m, 0, 23, 59, 59, 999));
      whereClause = {
        startTime: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      };
    }

    // Group visits by date and count unique places
    const visits = await prisma.visit.findMany({
      where: whereClause,
      select: {
        startTime: true,
        placeID: true
      }
    });

    // Aggregate by date
    const dayMap = new Map();
    for (const visit of visits) {
      const dateKey = visit.startTime.toISOString().split('T')[0];
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, { date: dateKey, visitCount: 0, uniquePlaces: new Set() });
      }
      const day = dayMap.get(dateKey);
      day.visitCount++;
      day.uniquePlaces.add(visit.placeID);
    }

    // Convert to array and serialize
    const days = Array.from(dayMap.values()).map(d => ({
      date: d.date,
      visitCount: d.visitCount,
      uniquePlaces: d.uniquePlaces.size
    })).sort((a, b) => a.date.localeCompare(b.date));

    res.json(days);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single day with full visit details and locations
app.get('/api/days/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const [visits, locations, dayData] = await Promise.all([
      // Get visits with place info
      prisma.visit.findMany({
        where: {
          startTime: { gte: dayStart, lte: dayEnd }
        },
        include: {
          place: true
        },
        orderBy: { startTime: 'asc' }
      }),

      // Get GPS points for path drawing
      prisma.location.findMany({
        where: {
          timestamp: { gte: dayStart, lte: dayEnd }
        },
        orderBy: { timestamp: 'asc' }
      }),

      // Get day-level enrichments if they exist
      prisma.dayData.findUnique({
        where: { date: dayStart }
      })
    ]);

    // Calculate distance by activity type from locations
    const distanceByType = {};
    let prevLoc = null;
    for (const loc of locations) {
      if (prevLoc && loc.activityType) {
        const dist = haversineDistance(prevLoc.lat, prevLoc.lon, loc.lat, loc.lon);
        const type = loc.activityType.toLowerCase();
        distanceByType[type] = (distanceByType[type] || 0) + dist;
      }
      prevLoc = loc;
    }

    res.json({
      date,
      visits: visits.map(v => ({
        id: v.id,
        placeID: v.placeID,
        lat: v.lat,
        lon: v.lon,
        startTime: v.startTime,
        endTime: v.endTime,
        durationMinutes: v.durationMinutes,
        semanticType: v.semanticType,
        place: v.place ? {
          name: v.place.name,
          address: v.place.address,
          imageUrl: v.place.defaultImageUrl,
          types: v.place.types
        } : null
      })),
      path: locations.map(l => ({
        lat: l.lat,
        lon: l.lon,
        timestamp: l.timestamp,
        activityType: l.activityType
      })),
      distanceByType,
      totalDistance: Object.values(distanceByType).reduce((a, b) => a + b, 0),
      weather: dayData?.weather || null,
      spotifyTracks: dayData?.spotifyTracks || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Find an "interesting" day (most unique places visited)
app.get('/api/interesting-day', async (req, res) => {
  try {
    const visits = await prisma.visit.findMany({
      select: {
        startTime: true,
        placeID: true
      }
    });

    // Group by date and count unique places
    const dayMap = new Map();
    for (const visit of visits) {
      const dateKey = visit.startTime.toISOString().split('T')[0];
      if (!dayMap.has(dateKey)) {
        dayMap.set(dateKey, new Set());
      }
      dayMap.get(dateKey).add(visit.placeID);
    }

    // Find day with most unique places
    let bestDay = null;
    let maxPlaces = 0;
    for (const [date, places] of dayMap) {
      if (places.size > maxPlaces) {
        maxPlaces = places.size;
        bestDay = date;
      }
    }

    res.json({
      date: bestDay,
      uniquePlaces: maxPlaces
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Haversine distance calculation (meters)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`✨ Déjà View API server running on http://localhost:${PORT}`);
  console.log(`📊 Database: Connected to Supabase`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
});
