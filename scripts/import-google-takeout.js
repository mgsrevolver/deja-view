#!/usr/bin/env node

/**
 * CLI Script: Import Google Takeout Location History
 * Usage: node scripts/import-google-takeout.js <file-path> [--start=YYYY-MM-DD] [--end=YYYY-MM-DD]
 *
 * Example:
 *   node scripts/import-google-takeout.js ~/Downloads/Records.json
 *   node scripts/import-google-takeout.js ~/Downloads/Records.json --start=2020-01-01 --end=2020-12-31
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { parseGoogleTakeoutFile, importToDatabase } from '../backend/src/services/location-import.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    Déjà View - Data Import                     ║
╚════════════════════════════════════════════════════════════════╝

Import your Google Takeout location history into Déjà View.

USAGE:
  node scripts/import-google-takeout.js <file-path> [options]

OPTIONS:
  --start=YYYY-MM-DD    Filter data starting from this date
  --end=YYYY-MM-DD      Filter data up to this date
  --help, -h            Show this help message

EXAMPLES:
  # Import entire file
  node scripts/import-google-takeout.js ~/Downloads/Records.json

  # Import specific date range
  node scripts/import-google-takeout.js ~/Downloads/Records.json --start=2020-01-01 --end=2020-12-31

  # Import just March 2020
  node scripts/import-google-takeout.js ~/Downloads/Records.json --start=2020-03-01 --end=2020-03-31

SUPPORTED FORMATS:
  ✓ semanticSegments (Android) - Richest metadata
  ✓ timelineObjects (iOS)
  ✓ locations (Old format)
  ✓ Root array format

WHERE TO FIND YOUR DATA:
  1. Go to https://takeout.google.com
  2. Select "Location History" (JSON format)
  3. Download and extract the archive
  4. Look for "Records.json" or "Semantic Location History" folder
    `);
    process.exit(0);
  }

  const filePath = args[0];
  const options = {
    startDate: null,
    endDate: null
  };

  // Parse optional date filters
  for (const arg of args.slice(1)) {
    if (arg.startsWith('--start=')) {
      options.startDate = new Date(arg.split('=')[1]);
    } else if (arg.startsWith('--end=')) {
      options.endDate = new Date(arg.split('=')[1]);
    }
  }

  return { filePath, options };
}

// Filter data by date range
function filterByDateRange(parsedData, options) {
  if (!options.startDate && !options.endDate) {
    return parsedData;
  }

  console.log('\n[INFO] Applying date filters...');
  if (options.startDate) {
    console.log(`  Start date: ${options.startDate.toISOString().split('T')[0]}`);
  }
  if (options.endDate) {
    console.log(`  End date: ${options.endDate.toISOString().split('T')[0]}`);
  }

  const filterPoint = (point) => {
    if (!point.timestamp) return false;
    const timestamp = new Date(point.timestamp);
    if (options.startDate && timestamp < options.startDate) return false;
    if (options.endDate && timestamp > options.endDate) return false;
    return true;
  };

  const filterVisit = (visit) => {
    if (!visit.startTime) return false;
    const timestamp = new Date(visit.startTime);
    if (options.startDate && timestamp < options.startDate) return false;
    if (options.endDate && timestamp > options.endDate) return false;
    return true;
  };

  const filteredPoints = parsedData.points.filter(filterPoint);
  const filteredVisits = parsedData.visits.filter(filterVisit);

  console.log(`[INFO] Filtered: ${filteredPoints.length.toLocaleString()} GPS points, ${filteredVisits.length.toLocaleString()} visits`);

  return {
    points: filteredPoints,
    visits: filteredVisits
  };
}

// Main execution
async function main() {
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║                    Déjà View - Data Import                     ║
║              Transform your location history into              ║
║                   an interactive journal                       ║
╚════════════════════════════════════════════════════════════════╝
  `);

  try {
    const { filePath, options } = parseArgs();

    // Resolve file path
    const resolvedPath = path.resolve(filePath);
    console.log(`[INFO] File: ${resolvedPath}\n`);

    // Step 1: Parse the Google Takeout file
    console.log('═══ STEP 1: PARSING FILE ═══');
    const startTime = Date.now();
    const parsedData = await parseGoogleTakeoutFile(resolvedPath);

    // Step 2: Apply date filters if specified
    const filteredData = filterByDateRange(parsedData, options);

    const parseTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n[SUCCESS] Parsing completed in ${parseTime}s`);

    // Step 3: Import to database
    console.log('\n═══ STEP 2: IMPORTING TO DATABASE ═══');
    const importStartTime = Date.now();
    const result = await importToDatabase(filteredData);

    const importTime = ((Date.now() - importStartTime) / 1000).toFixed(2);
    console.log(`[SUCCESS] Import completed in ${importTime}s`);

    // Summary
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`
╔════════════════════════════════════════════════════════════════╗
║                      IMPORT COMPLETE ✓                         ║
╠════════════════════════════════════════════════════════════════╣
║  GPS Points:     ${result.locationsCreated.toLocaleString().padStart(10)}                                      ║
║  Visits:         ${result.visitsCreated.toLocaleString().padStart(10)}                                      ║
║  Unique Places:  ${result.placesCreated.toLocaleString().padStart(10)}                                      ║
║                                                                ║
║  Total Time:     ${totalTime.padStart(10)}s                                    ║
╚════════════════════════════════════════════════════════════════╝

NEXT STEPS:
  1. Start the backend:   cd backend && npm run dev
  2. Start the frontend:  cd frontend && npm run dev
  3. Open http://localhost:5173 to view your journal

Need help? Check PROJECT-STATUS.md for next steps.
    `);

  } catch (error) {
    console.error(`
╔════════════════════════════════════════════════════════════════╗
║                         ERROR ✗                                ║
╚════════════════════════════════════════════════════════════════╝

${error.message}

Common issues:
  • File not found: Check the file path
  • Invalid JSON: Verify the file is a valid Google Takeout export
  • Database error: Ensure backend/.env has correct DATABASE_URL

For help: node scripts/import-google-takeout.js --help
    `);
    process.exit(1);
  }
}

main();
