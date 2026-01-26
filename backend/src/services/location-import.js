/**
 * Location Import Service
 * Ports Python parser logic from generate_heatmap.py to Node.js
 * Supports all 4 Google Takeout formats:
 * 1. locations (old format with E7 coordinates)
 * 2. semanticSegments (Android format - richest metadata)
 * 3. timelineObjects (iOS format)
 * 4. root array (direct array format)
 */

import fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const E7 = 1e-7; // Multiplier for E7 coordinates

/**
 * Parse various timestamp formats from Google Takeout
 * @param {string|number} timestamp - Can be ISO string, Unix ms, or null
 * @returns {Date|null}
 */
function parseTimestamp(timestamp) {
  if (!timestamp) return null;

  try {
    // If it's already a number (Unix milliseconds)
    if (typeof timestamp === 'number') {
      return new Date(timestamp);
    }

    // If it's a string that looks like a number
    if (typeof timestamp === 'string' && /^\d+$/.test(timestamp)) {
      return new Date(parseInt(timestamp));
    }

    // ISO 8601 format (2020-03-10T15:30:00Z)
    return new Date(timestamp);
  } catch (error) {
    console.warn(`[WARNING] Failed to parse timestamp: ${timestamp}`);
    return null;
  }
}

/**
 * Parse lat/lng string (Android format uses geo strings like "geo:35.123,-47.456")
 * @param {string} latLngStr - Coordinate string
 * @returns {[number, number]|null} - [lat, lon] or null
 */
function parseLatLngString(latLngStr) {
  if (!latLngStr || typeof latLngStr !== 'string') return null;

  try {
    // Find floating-point numbers in the string
    const coordRegex = /([-]?\d+\.\d+)/g;
    const coords = latLngStr.match(coordRegex)?.map(parseFloat);

    return coords && coords.length === 2 ? coords : null;
  } catch (error) {
    return null;
  }
}

/**
 * Process old 'locations' format (minimal metadata, E7 coordinates)
 */
function processLocationsFormat(data) {
  console.log('[INFO] Processing "locations" format...');
  const points = [];

  if (!data.locations || !Array.isArray(data.locations)) {
    console.warn('[WARNING] No locations array found in data');
    return points;
  }

  for (const [i, loc] of data.locations.entries()) {
    if (loc.latitudeE7 && loc.longitudeE7) {
      points.push({
        lat: loc.latitudeE7 * E7,
        lon: loc.longitudeE7 * E7,
        timestamp: parseTimestamp(loc.timestampMs || loc.timestamp),
        placeID: null,
        semanticType: 'Location', // Generic label for old format
        probability: 0.0,
        source: 'path'
      });
    }

    if ((i + 1) % 50000 === 0) {
      console.log(`  [PROGRESS] ${(i + 1).toLocaleString()} locations processed...`);
    }
  }

  return points;
}

/**
 * Process 'semanticSegments' format (Android - richest metadata)
 */
function processSemanticSegmentsFormat(data, config = {}) {
  console.log('[INFO] Processing "semanticSegments" format...');
  const points = [];
  const visits = [];

  if (!data.semanticSegments || !Array.isArray(data.semanticSegments)) {
    console.warn('[WARNING] No semanticSegments array found');
    return { points, visits };
  }

  for (const [i, segment] of data.semanticSegments.entries()) {
    try {
      // Process timeline path (raw GPS breadcrumbs)
      if (segment.timelinePath && Array.isArray(segment.timelinePath)) {
        const startTime = parseTimestamp(segment.startTime);
        const endTime = parseTimestamp(segment.endTime);

        for (const [idx, pathPoint] of segment.timelinePath.entries()) {
          const coords = parseLatLngString(pathPoint.point);
          if (coords) {
            let pointTime = parseTimestamp(pathPoint.time || pathPoint.timestamp);

            // Interpolate timestamp if missing
            if (!pointTime && startTime && endTime) {
              const progress = idx / Math.max(segment.timelinePath.length - 1, 1);
              pointTime = new Date(startTime.getTime() + (endTime.getTime() - startTime.getTime()) * progress);
            }

            points.push({
              lat: coords[0],
              lon: coords[1],
              timestamp: pointTime,
              placeID: null,
              semanticType: null,
              probability: 0.0,
              source: 'path',
              activityType: null
            });
          }
        }
      }

      // Process visits
      if (segment.visit) {
        const latLng = segment.visit.topCandidate?.placeLocation?.latLng;
        const coords = parseLatLngString(latLng);

        if (coords) {
          const topCandidate = segment.visit.topCandidate || {};
          const startTime = parseTimestamp(segment.visit.startTime || segment.startTime);
          const endTime = parseTimestamp(segment.visit.endTime || segment.endTime);

          visits.push({
            lat: coords[0],
            lon: coords[1],
            startTime,
            endTime,
            placeID: topCandidate.placeID,
            semanticType: topCandidate.semanticType || 'Unknown Location',
            probability: parseFloat(topCandidate.probability || 0),
            source: 'visit'
          });
        }
      }

      // Process activities
      if (segment.activity) {
        const activity = segment.activity;
        const activityType = activity.topCandidate?.type || 'Unknown';

        // Activity start point
        const startCoords = parseLatLngString(activity.start?.latLng);
        if (startCoords) {
          const startTime = parseTimestamp(activity.start?.time || segment.startTime);
          points.push({
            lat: startCoords[0],
            lon: startCoords[1],
            timestamp: startTime,
            placeID: null,
            semanticType: `Activity (${activityType})`,
            probability: 0.0,
            source: 'activity',
            activityType
          });
        }

        // Activity end point
        const endCoords = parseLatLngString(activity.end?.latLng);
        if (endCoords) {
          const endTime = parseTimestamp(activity.end?.time || segment.endTime);
          points.push({
            lat: endCoords[0],
            lon: endCoords[1],
            timestamp: endTime,
            placeID: null,
            semanticType: `Activity (${activityType})`,
            probability: 0.0,
            source: 'activity',
            activityType
          });
        }
      }
    } catch (error) {
      console.warn(`[WARNING] Error processing segment #${i + 1}. Skipping.`);
      continue;
    }

    if ((i + 1) % 20000 === 0) {
      console.log(`  [PROGRESS] ${(i + 1).toLocaleString()} segments processed...`);
    }
  }

  return { points, visits };
}

/**
 * Process 'timelineObjects' format (iOS)
 */
function processTimelineObjectsFormat(data) {
  console.log('[INFO] Processing "timelineObjects" (iOS) format...');
  const points = [];
  const visits = [];

  if (!data.timelineObjects || !Array.isArray(data.timelineObjects)) {
    console.warn('[WARNING] No timelineObjects array found');
    return { points, visits };
  }

  for (const [i, tObject] of data.timelineObjects.entries()) {
    try {
      // Process place visits
      if (tObject.placeVisit) {
        const placeVisit = tObject.placeVisit;
        const location = placeVisit.location;

        if (location?.latitudeE7 && location?.longitudeE7) {
          const startTime = parseTimestamp(
            placeVisit.duration?.startTimestamp || placeVisit.duration?.startTimestampMs
          );
          const endTime = parseTimestamp(
            placeVisit.duration?.endTimestamp || placeVisit.duration?.endTimestampMs
          );

          const semanticType = location.semanticType || placeVisit.semanticType || 'Unknown Location';
          const placeId = location.placeId || placeVisit.placeId;

          visits.push({
            lat: location.latitudeE7 * E7,
            lon: location.longitudeE7 * E7,
            startTime,
            endTime,
            placeID: placeId,
            semanticType,
            probability: 0.0, // iOS doesn't provide probability
            source: 'visit'
          });
        }
      }

      // Process activity segments
      if (tObject.activitySegment) {
        const segment = tObject.activitySegment;
        const startTime = parseTimestamp(
          segment.duration?.startTimestamp || segment.duration?.startTimestampMs
        );
        const endTime = parseTimestamp(
          segment.duration?.endTimestamp || segment.duration?.endTimestampMs
        );
        const activityType = segment.activityType || 'Unknown';

        // Start location
        if (segment.startLocation?.latitudeE7 && segment.startLocation?.longitudeE7) {
          points.push({
            lat: segment.startLocation.latitudeE7 * E7,
            lon: segment.startLocation.longitudeE7 * E7,
            timestamp: startTime,
            placeID: null,
            semanticType: `Activity (${activityType})`,
            probability: 0.0,
            source: 'activity',
            activityType
          });
        }

        // End location
        if (segment.endLocation?.latitudeE7 && segment.endLocation?.longitudeE7) {
          points.push({
            lat: segment.endLocation.latitudeE7 * E7,
            lon: segment.endLocation.longitudeE7 * E7,
            timestamp: endTime,
            placeID: null,
            semanticType: `Activity (${activityType})`,
            probability: 0.0,
            source: 'activity',
            activityType
          });
        }

        // Raw path points
        if (segment.simplifiedRawPath?.points) {
          const rawPoints = segment.simplifiedRawPath.points;
          for (const [idx, point] of rawPoints.entries()) {
            if (point.latE7 && point.lngE7) {
              let pointTime = null;
              if (startTime && endTime) {
                const progress = idx / Math.max(rawPoints.length - 1, 1);
                pointTime = new Date(startTime.getTime() + (endTime.getTime() - startTime.getTime()) * progress);
              }

              points.push({
                lat: point.latE7 * E7,
                lon: point.lngE7 * E7,
                timestamp: pointTime,
                placeID: null,
                semanticType: null,
                probability: 0.0,
                source: 'path',
                activityType: null
              });
            }
          }
        }
      }
    } catch (error) {
      console.warn(`[WARNING] Error processing timeline object #${i + 1}. Skipping.`);
      continue;
    }

    if ((i + 1) % 20000 === 0) {
      console.log(`  [PROGRESS] ${(i + 1).toLocaleString()} timeline objects processed...`);
    }
  }

  return { points, visits };
}

/**
 * Process root array format
 */
function processRootArrayFormat(data) {
  console.log('[INFO] Processing root array format...');
  const points = [];
  const visits = [];

  if (!Array.isArray(data)) {
    console.warn('[WARNING] Data is not an array');
    return { points, visits };
  }

  for (const [i, record] of data.entries()) {
    try {
      // Process visits
      if (record.visit) {
        const latLng = record.visit.topCandidate?.placeLocation;
        const coords = parseLatLngString(latLng);

        if (coords) {
          const topCandidate = record.visit.topCandidate || {};
          const startTime = parseTimestamp(record.visit.startTime || record.startTime);
          const endTime = parseTimestamp(record.visit.endTime || record.endTime);

          visits.push({
            lat: coords[0],
            lon: coords[1],
            startTime,
            endTime,
            placeID: topCandidate.placeID,
            semanticType: topCandidate.semanticType || 'Unknown Location',
            probability: parseFloat(topCandidate.probability || 0),
            source: 'visit'
          });
        }
      }

      // Process activities
      if (record.activity) {
        const activity = record.activity;
        const activityType = activity.topCandidate?.type || 'Unknown';

        const startCoords = parseLatLngString(activity.start);
        if (startCoords) {
          const startTime = parseTimestamp(activity.startTime || record.startTime);
          points.push({
            lat: startCoords[0],
            lon: startCoords[1],
            timestamp: startTime,
            placeID: null,
            semanticType: `Activity (${activityType})`,
            probability: 0.0,
            source: 'activity',
            activityType
          });
        }

        const endCoords = parseLatLngString(activity.end);
        if (endCoords) {
          const endTime = parseTimestamp(activity.endTime || record.endTime);
          points.push({
            lat: endCoords[0],
            lon: endCoords[1],
            timestamp: endTime,
            placeID: null,
            semanticType: `Activity (${activityType})`,
            probability: 0.0,
            source: 'activity',
            activityType
          });
        }
      }
    } catch (error) {
      console.warn(`[WARNING] Error processing record #${i + 1}. Skipping.`);
      continue;
    }

    if ((i + 1) % 20000 === 0) {
      console.log(`  [PROGRESS] ${(i + 1).toLocaleString()} records processed...`);
    }
  }

  return { points, visits };
}

/**
 * Detect format and call appropriate parser
 * @param {string} filePath - Path to Google Takeout JSON file
 * @returns {Promise<{points: Array, visits: Array}>}
 */
export async function parseGoogleTakeoutFile(filePath) {
  console.log('\n--- Starting JSON File Processing ---');
  console.log(`[INFO] Reading file: ${filePath}`);

  try {
    // Read file as text
    const fileContent = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(fileContent);

    // Detect format
    let detectedFormat = null;
    let result = { points: [], visits: [] };

    if (Array.isArray(data)) {
      detectedFormat = 'root_array';
      result = processRootArrayFormat(data);
    } else if (data.locations) {
      detectedFormat = 'locations';
      result = { points: processLocationsFormat(data), visits: [] };
    } else if (data.semanticSegments) {
      detectedFormat = 'semanticSegments';
      result = processSemanticSegmentsFormat(data);
    } else if (data.timelineObjects) {
      detectedFormat = 'timelineObjects';
      result = processTimelineObjectsFormat(data);
    } else {
      throw new Error('Could not determine JSON format. No known structure identified.');
    }

    console.log(`\n[INFO] Format detected: ${detectedFormat}`);
    console.log(`[INFO] Total GPS points: ${result.points.length.toLocaleString()}`);
    console.log(`[INFO] Total visits: ${result.visits.length.toLocaleString()}`);

    return result;

  } catch (error) {
    if (error.code === 'ENOENT') {
      throw new Error(`File not found: ${filePath}`);
    } else if (error instanceof SyntaxError) {
      throw new Error(`Invalid JSON format: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Import parsed data into database
 * @param {{points: Array, visits: Array}} parsedData
 * @returns {Promise<{locationsCreated: number, visitsCreated: number, placesCreated: number}>}
 */
export async function importToDatabase(parsedData) {
  console.log('\n--- Importing to Database ---');

  const { points, visits } = parsedData;
  let locationsCreated = 0;
  let visitsCreated = 0;
  let placesCreated = 0;
  const chunkSize = 1000;

  try {
    // Import GPS points (Location table)
    if (points.length > 0) {
      console.log(`[INFO] Importing ${points.length.toLocaleString()} GPS points...`);

      const locationRecords = points
        .filter(p => p.timestamp) // Only import points with valid timestamps
        .map(p => ({
          lat: p.lat,
          lon: p.lon,
          timestamp: p.timestamp,
          source: p.source,
          activityType: p.activityType
        }));

      // Batch insert locations
      for (let i = 0; i < locationRecords.length; i += chunkSize) {
        const chunk = locationRecords.slice(i, i + chunkSize);
        await prisma.location.createMany({
          data: chunk,
          skipDuplicates: true
        });
        locationsCreated += chunk.length;

        if ((i + chunkSize) % 10000 === 0) {
          console.log(`  [PROGRESS] ${Math.min(i + chunkSize, locationRecords.length).toLocaleString()} locations imported...`);
        }
      }
    }

    // Import visits (Visit table) and create unique places
    if (visits.length > 0) {
      console.log(`[INFO] Importing ${visits.length.toLocaleString()} visits...`);

      const uniquePlaceIDs = new Set();
      const visitRecords = [];

      // Transform visits for batch insert
      for (const visit of visits) {
        if (!visit.startTime) continue;

        let durationMinutes = null;
        if (visit.startTime && visit.endTime) {
          durationMinutes = Math.round((visit.endTime - visit.startTime) / 60000);
        }

        const placeID = visit.placeID || `coord_${visit.lat.toFixed(6)}_${visit.lon.toFixed(6)}`;
        uniquePlaceIDs.add(placeID);

        visitRecords.push({
          placeID,
          lat: visit.lat,
          lon: visit.lon,
          startTime: visit.startTime,
          endTime: visit.endTime,
          durationMinutes,
          semanticType: visit.semanticType,
          probability: visit.probability
        });
      }

      // Create Places FIRST (visits have FK to places)
      console.log(`[INFO] Creating ${uniquePlaceIDs.size} unique places...`);
      const placeRecords = Array.from(uniquePlaceIDs).map(id => ({ id }));

      for (let i = 0; i < placeRecords.length; i += chunkSize) {
        const chunk = placeRecords.slice(i, i + chunkSize);
        const result = await prisma.place.createMany({
          data: chunk,
          skipDuplicates: true
        });
        placesCreated += result.count;
      }

      // Batch insert visits (chunks of 1000)
      console.log(`[INFO] Inserting ${visitRecords.length.toLocaleString()} visits...`);
      for (let i = 0; i < visitRecords.length; i += chunkSize) {
        const chunk = visitRecords.slice(i, i + chunkSize);
        const result = await prisma.visit.createMany({
          data: chunk,
          skipDuplicates: true
        });
        visitsCreated += result.count;

        if ((i + chunkSize) % 5000 === 0) {
          console.log(`  [PROGRESS] ${Math.min(i + chunkSize, visitRecords.length).toLocaleString()} visits imported...`);
        }
      }
    }

    console.log('\n[SUCCESS] Import completed');
    console.log(`  - Locations: ${locationsCreated.toLocaleString()}`);
    console.log(`  - Visits: ${visitsCreated.toLocaleString()}`);
    console.log(`  - Unique Places: ${placesCreated.toLocaleString()}`);

    return { locationsCreated, visitsCreated, placesCreated };

  } catch (error) {
    console.error('[ERROR] Database import failed:', error);
    throw error;
  }
}

export default {
  parseGoogleTakeoutFile,
  importToDatabase
};
