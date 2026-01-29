/**
 * Image Generator Service
 *
 * Generates shareable Instagram-style day summary images (1080x1080)
 * with Polaroid-style photo stacks and text overlays.
 *
 * Uses Sharp for image manipulation and SVG for text rendering.
 */

import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.join(__dirname, '../../assets/fonts');

// Image dimensions
const CANVAS_SIZE = 1080;
const POLAROID_PHOTO_SIZE = 280;
const POLAROID_BORDER = 40;
const POLAROID_BOTTOM_BORDER = 80; // Extra space for text
const POLAROID_WIDTH = POLAROID_PHOTO_SIZE + POLAROID_BORDER * 2;
const POLAROID_HEIGHT = POLAROID_PHOTO_SIZE + POLAROID_BORDER + POLAROID_BOTTOM_BORDER;

// Colors
const GRADIENT_TOP = '#1a1a2e';
const GRADIENT_BOTTOM = '#16213e';
const WHITE = '#ffffff';
const TEXT_SECONDARY = '#a0a0b0';

/**
 * Format duration in minutes to human-readable string
 */
function formatDuration(minutes) {
  if (!minutes) return '';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

/**
 * Format time from Date object
 */
function formatTime(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

/**
 * Format date for display
 */
function formatDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

/**
 * Create gradient background SVG
 */
function createGradientBackground() {
  return Buffer.from(`
    <svg width="${CANVAS_SIZE}" height="${CANVAS_SIZE}">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:${GRADIENT_TOP};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${GRADIENT_BOTTOM};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" fill="url(#bg)"/>
    </svg>
  `);
}

/**
 * Create a Polaroid frame for a photo
 */
async function createPolaroid(photoBuffer, placeName, duration, time, options = {}) {
  const { showPlaceNames = true, showDurations = true, showTimes = false } = options;

  // Resize photo to fit Polaroid
  const resizedPhoto = await sharp(photoBuffer)
    .resize(POLAROID_PHOTO_SIZE, POLAROID_PHOTO_SIZE, { fit: 'cover' })
    .toBuffer();

  // Build text lines for the Polaroid
  const textLines = [];
  if (showPlaceNames && placeName) {
    // Truncate long names
    const displayName = placeName.length > 20 ? placeName.substring(0, 18) + '...' : placeName;
    textLines.push({ text: displayName, size: 18, weight: 600 });
  }
  if (showDurations && duration) {
    textLines.push({ text: formatDuration(duration), size: 14, weight: 400 });
  }
  if (showTimes && time) {
    textLines.push({ text: formatTime(time), size: 14, weight: 400 });
  }

  // Create text SVG with system-safe fonts
  let textY = POLAROID_PHOTO_SIZE + POLAROID_BORDER + 24;
  const textSvgLines = textLines.map((line, i) => {
    const y = textY + i * (line.size + 6);
    return `<text x="${POLAROID_WIDTH / 2}" y="${y}"
            text-anchor="middle"
            font-family="sans-serif"
            font-size="${line.size}"
            font-weight="${line.weight}"
            fill="#333333">${escapeXml(line.text)}</text>`;
  }).join('\n');

  const textOverlay = Buffer.from(`
    <svg width="${POLAROID_WIDTH}" height="${POLAROID_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      ${textSvgLines}
    </svg>
  `);

  // Create white Polaroid frame with photo and text
  const polaroid = await sharp({
    create: {
      width: POLAROID_WIDTH,
      height: POLAROID_HEIGHT,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([
      {
        input: resizedPhoto,
        top: POLAROID_BORDER,
        left: POLAROID_BORDER
      },
      {
        input: textOverlay,
        top: 0,
        left: 0
      }
    ])
    .png()
    .toBuffer();

  return polaroid;
}

/**
 * Escape XML special characters
 */
function escapeXml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Fetch image from URL with timeout
 */
async function fetchImage(url, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = await response.arrayBuffer();
    return Buffer.from(buffer);
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Calculate Polaroid positions for stacked layout
 * Returns array of { x, y, rotation } for each Polaroid
 */
function calculatePolaroidPositions(count) {
  const positions = [];
  const centerX = CANVAS_SIZE / 2;
  const centerY = 380; // Center of Polaroid area

  if (count === 1) {
    positions.push({ x: centerX - POLAROID_WIDTH / 2, y: centerY - POLAROID_HEIGHT / 2, rotation: -3 });
  } else if (count === 2) {
    positions.push({ x: centerX - POLAROID_WIDTH - 20, y: centerY - POLAROID_HEIGHT / 2 - 30, rotation: -6 });
    positions.push({ x: centerX + 20, y: centerY - POLAROID_HEIGHT / 2 + 30, rotation: 5 });
  } else if (count === 3) {
    positions.push({ x: centerX - POLAROID_WIDTH - 40, y: centerY - POLAROID_HEIGHT / 2 - 40, rotation: -7 });
    positions.push({ x: centerX - POLAROID_WIDTH / 2, y: centerY - POLAROID_HEIGHT / 2 + 20, rotation: 2 });
    positions.push({ x: centerX + 40, y: centerY - POLAROID_HEIGHT / 2 - 20, rotation: 6 });
  } else {
    // 4 photos - scattered layout
    positions.push({ x: centerX - POLAROID_WIDTH - 60, y: centerY - POLAROID_HEIGHT / 2 - 60, rotation: -8 });
    positions.push({ x: centerX - 40, y: centerY - POLAROID_HEIGHT / 2 + 40, rotation: 3 });
    positions.push({ x: centerX + 60, y: centerY - POLAROID_HEIGHT / 2 - 30, rotation: 7 });
    positions.push({ x: centerX - POLAROID_WIDTH / 2, y: centerY - POLAROID_HEIGHT / 2 + 80, rotation: -2 });
  }

  return positions;
}

/**
 * Create text overlay SVG for date, summary, and branding
 * Uses system-safe fonts to avoid Pango font loading issues
 */
function createTextOverlay(date, weather, placeCount, totalDistance) {
  const dateText = formatDate(date);

  // Build summary line (skip emoji for SVG compatibility)
  const summaryParts = [];
  if (weather?.high) {
    summaryParts.push(`${weather.high}°F`);
  }
  summaryParts.push(`${placeCount} place${placeCount !== 1 ? 's' : ''}`);
  if (totalDistance > 0) {
    summaryParts.push(`${totalDistance.toFixed(1)} mi`);
  }
  const summaryText = summaryParts.join('  ·  ');

  // Use system-safe font stack
  const fontFamily = 'sans-serif';

  return Buffer.from(`
    <svg width="${CANVAS_SIZE}" height="${CANVAS_SIZE}" xmlns="http://www.w3.org/2000/svg">
      <!-- Date -->
      <text x="${CANVAS_SIZE / 2}" y="880"
            text-anchor="middle"
            font-family="${fontFamily}"
            font-size="42"
            font-weight="600"
            fill="${WHITE}">${escapeXml(dateText)}</text>

      <!-- Summary line -->
      <text x="${CANVAS_SIZE / 2}" y="930"
            text-anchor="middle"
            font-family="${fontFamily}"
            font-size="24"
            font-weight="400"
            fill="${TEXT_SECONDARY}">${escapeXml(summaryText)}</text>

      <!-- Branding -->
      <text x="${CANVAS_SIZE - 40}" y="${CANVAS_SIZE - 30}"
            text-anchor="end"
            font-family="${fontFamily}"
            font-size="18"
            font-weight="400"
            fill="${TEXT_SECONDARY}"
            opacity="0.7">Deja View</text>
    </svg>
  `);
}

/**
 * Main function: Generate a shareable day image
 *
 * @param {Object} params
 * @param {string} params.date - Date string (YYYY-MM-DD)
 * @param {Array} params.visits - Array of visit objects with place data
 * @param {Object} params.weather - Weather data { emoji, condition, high, low }
 * @param {number} params.totalDistance - Total distance in miles
 * @param {Object} params.options - Display options { showTimes, showDurations, showPlaceNames }
 * @returns {Promise<Buffer>} PNG image buffer
 */
export async function generateDayImage({ date, visits, weather, totalDistance, options = {} }) {
  const { showTimes = false, showDurations = true, showPlaceNames = true } = options;

  // Filter to visits with photos, sort by duration, take top 4
  const visitsWithPhotos = visits
    .filter(v => v.place?.imageUrl)
    .sort((a, b) => (b.durationMinutes || 0) - (a.durationMinutes || 0))
    .slice(0, 4);

  if (visitsWithPhotos.length === 0) {
    throw new Error('No visits with photos available');
  }

  // Create base image with gradient
  let image = sharp(createGradientBackground());

  // Fetch and create Polaroids
  const polaroids = [];
  for (const visit of visitsWithPhotos) {
    try {
      const photoBuffer = await fetchImage(visit.place.imageUrl);
      const polaroid = await createPolaroid(
        photoBuffer,
        visit.place.name,
        visit.durationMinutes,
        visit.startTime,
        { showPlaceNames, showDurations, showTimes }
      );
      polaroids.push(polaroid);
    } catch (err) {
      console.warn(`Failed to fetch photo for ${visit.place?.name}: ${err.message}`);
    }
  }

  if (polaroids.length === 0) {
    throw new Error('Failed to fetch any photos');
  }

  // Calculate positions and create composite operations
  const positions = calculatePolaroidPositions(polaroids.length);
  const compositeOps = [];

  for (let i = 0; i < polaroids.length; i++) {
    const pos = positions[i];

    // Rotate the Polaroid
    const rotatedPolaroid = await sharp(polaroids[i])
      .rotate(pos.rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    // Get dimensions after rotation (will be larger due to rotation)
    const metadata = await sharp(rotatedPolaroid).metadata();

    // Adjust position to account for rotation expansion
    const offsetX = Math.round((metadata.width - POLAROID_WIDTH) / 2);
    const offsetY = Math.round((metadata.height - POLAROID_HEIGHT) / 2);

    compositeOps.push({
      input: rotatedPolaroid,
      top: Math.round(pos.y - offsetY),
      left: Math.round(pos.x - offsetX)
    });
  }

  // Add text overlay
  const textOverlay = createTextOverlay(date, weather, visits.length, totalDistance);
  compositeOps.push({
    input: textOverlay,
    top: 0,
    left: 0
  });

  // Composite everything
  const finalImage = await image
    .composite(compositeOps)
    .png({ quality: 90 })
    .toBuffer();

  return finalImage;
}

/**
 * Generate a simple test image (for debugging)
 */
export async function generateTestImage() {
  const testDate = '2026-01-28';
  const testWeather = { emoji: '☀️', high: 72, low: 58, condition: 'clear' };

  // Create a simple image without photos
  const background = sharp(createGradientBackground());
  const textOverlay = createTextOverlay(testDate, testWeather, 4, 3.2);

  const finalImage = await background
    .composite([{ input: textOverlay, top: 0, left: 0 }])
    .png()
    .toBuffer();

  return finalImage;
}

export default {
  generateDayImage,
  generateTestImage
};
