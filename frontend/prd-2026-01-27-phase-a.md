# PRD: Phase A - Frontend
**Date:** 2026-01-27
**Status:** ✅ COMPLETE

## Context

**Vision:** Déjà View is a memory synthesis app. When you open a day, it should feel like stepping back into that day—not reading a spreadsheet about it. The UI should be beautiful enough that users want to screenshot and share it.

---

## Completed Work

### 1. Import UI ✅
- `ImportModal.jsx` - Full drag-and-drop file upload
- Instructions for Google Takeout export
- Upload progress states (idle, uploading, success, error)
- Success summary shows locations/visits/places imported
- Import button added to header user menu
- Query invalidation on success to refresh data

### 2. Day Summary Header ✅
- Shows at-a-glance summary below date navigation
- Format: `☀️ 72° · 7 places · 4.2 mi walked`
- Weather icon from condition
- Place count from visits
- Distance with activity type (walked/traveled)
- Graceful degradation when data missing

### 3. Map Visual Upgrade ✅
- Switched to CartoDB Dark Matter tiles (muted dark basemap)
- Path and markers now pop against dark background
- Added map legend for activity types (walking/biking/driving)
- Legend styled with backdrop blur, positioned bottom-left

### 4. Weather Mood Overlay ✅
- Subtle color tint based on weather condition
- 5% opacity max (subliminal, not obvious)
- Clear/sunny → warm golden
- Rain → cool blue
- Snow → cool bright
- Fog/cloudy → muted gray
- Smooth 0.5s transition between moods

### 5. Loading States ✅
- Skeleton loaders in Sidebar (replaces "Loading..." text)
- Skeleton for place panel (icon, title, subtitle)
- Skeleton for timeline (header + 4 items)
- Pulse animation on skeleton elements

### 6. Distance Breakdown ✅
- Distance bar in Sidebar showing activity breakdown
- Color-coded dots matching map legend
- Only shows activities with >50m distance
- Sorted by distance descending

---

## Files Changed
- `src/components/ImportModal.jsx` - New component
- `src/components/JournalView.jsx` - Summary header, import integration
- `src/components/MapPane.jsx` - Dark tiles, mood overlay, legend
- `src/components/Sidebar.jsx` - Skeleton loaders, distance bar
- `src/components/CalendarPicker.jsx` - Minor styling
- `src/lib/api.js` - `uploadFile()` helper for FormData
- `src/App.css` - All new styles for above features

---

## Design Decisions
- Weather mood is "felt not seen" - very subtle tinting
- Map legend only shows when there are path segments
- Summary header uses middle dot separator (·) for readability
- Skeleton loaders maintain layout to prevent content shift

---

## Next Up (Phase B+)
- Photo integration (Google Photos API)
- Spotify integration
- Share mode with privacy controls
