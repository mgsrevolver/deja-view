import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

// Initialize Supabase client for auth verification
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SECRET_KEY
);

// ============================================
// MIDDLEWARE
// ============================================

// CORS - restrict to known origins in production
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? [process.env.FRONTEND_URL].filter(Boolean)
  : ['http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, etc) in dev
    if (!origin && process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json());

// Auth middleware - validates Supabase JWT
async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.replace('Bearer ', '');

  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// Optional auth - allows unauthenticated requests but attaches user if token present
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    try {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) req.user = user;
    } catch (e) {
      // Ignore auth errors for optional auth
    }
  }
  next();
}

// ============================================
// PUBLIC ROUTES (no auth required)
// ============================================

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

// ============================================
// PROTECTED ROUTES (auth required)
// ============================================

// Get overall stats and date range for current user
app.get('/api/stats', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [visitCount, placeCount, dateRange] = await Promise.all([
      prisma.visit.count({ where: { userId } }),
      prisma.visit.groupBy({
        by: ['placeID'],
        where: { userId },
        _count: true
      }).then(groups => groups.length),
      prisma.visit.aggregate({
        where: { userId },
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
app.get('/api/days', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { month } = req.query; // Format: YYYY-MM

    let whereClause = { userId };
    if (month) {
      const [year, m] = month.split('-').map(Number);
      const startOfMonth = new Date(Date.UTC(year, m - 1, 1));
      const endOfMonth = new Date(Date.UTC(year, m, 0, 23, 59, 59, 999));
      whereClause.startTime = {
        gte: startOfMonth,
        lte: endOfMonth
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
app.get('/api/days/:date', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { date } = req.params;
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);

    const [visits, locations, dayData, placeStats] = await Promise.all([
      // Get visits with place info
      prisma.visit.findMany({
        where: {
          userId,
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
          userId,
          timestamp: { gte: dayStart, lte: dayEnd }
        },
        orderBy: { timestamp: 'asc' }
      }),

      // Get day-level enrichments if they exist
      prisma.dayData.findFirst({
        where: { userId, date: dayStart }
      }),

      // Get place stats for all places the user visited that day
      // This is computed dynamically per-user
      prisma.visit.groupBy({
        by: ['placeID'],
        where: {
          userId,
          startTime: { gte: dayStart, lte: dayEnd }
        }
      }).then(async (todaysPlaces) => {
        const placeIds = todaysPlaces.map(p => p.placeID);

        // Get aggregated stats for each place the user has ever visited
        const stats = await prisma.visit.groupBy({
          by: ['placeID'],
          where: {
            userId,
            placeID: { in: placeIds }
          },
          _min: { startTime: true },
          _max: { startTime: true },
          _count: true,
          _sum: { durationMinutes: true }
        });

        return stats.reduce((acc, s) => {
          acc[s.placeID] = {
            firstVisitDate: s._min.startTime,
            lastVisitDate: s._max.startTime,
            totalVisits: s._count,
            totalMinutes: s._sum.durationMinutes || 0
          };
          return acc;
        }, {});
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
          types: v.place.types,
          // User-specific place stats
          firstVisitDate: placeStats[v.placeID]?.firstVisitDate,
          lastVisitDate: placeStats[v.placeID]?.lastVisitDate,
          totalVisits: placeStats[v.placeID]?.totalVisits,
          totalMinutes: placeStats[v.placeID]?.totalMinutes
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
app.get('/api/interesting-day', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const visits = await prisma.visit.findMany({
      where: { userId },
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

// ============================================
// HELPERS
// ============================================

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

// ============================================
// ERROR HANDLING
// ============================================

// Centralized error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS not allowed' });
  }

  res.status(500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message
  });
});

// ============================================
// LIFECYCLE
// ============================================

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
  console.log(`🔒 Auth: Supabase JWT validation enabled`);
});
