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
    // Simple query to verify database connection
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

// Placeholder routes (to be implemented in Phase 2)
app.get('/api/days', (req, res) => {
  res.json({ message: 'Days endpoint - coming soon' });
});

app.get('/api/days/:date', (req, res) => {
  res.json({ message: `Day detail for ${req.params.date} - coming soon` });
});

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
