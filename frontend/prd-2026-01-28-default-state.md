# PRD: Sidebar Default State
**Date:** 2026-01-28
**Status:** ✅ COMPLETE

## Problem

When loading a day, before selecting any place, the sidebar showed "Select a place" as an empty state. This wasted valuable screen real estate and didn't help the user understand their day.

## Solution

Hybrid approach: compact day summary at top + expanded timeline below. When a place is selected, timeline shrinks and place detail appears.

---

## Completed Work

### Day Summary Card ✅
- Weather row: emoji + condition + high/low temps
- Stats row: place count, total distance, active time
- Only shows when no place is selected
- Graceful degradation when data missing

### Timeline Behavior ✅
- Expands to fill sidebar when no place selected
- Shrinks to compact height when place selected
- CSS class toggles: `.expanded` / `.compact`

### Travel Stats Bar ✅ (bonus)
- Persistent bar showing distance by mode
- Walking, cycling, driving, transit, other
- Color-coded dots matching map path colors
- Calculated directly from path data (Haversine formula)
- Always visible regardless of selection state

### Visit Numbers ✅ (bonus)
- Numbers on map markers (1, 2, 3...)
- Matching numbers in timeline items
- Makes it easy to correlate map ↔ timeline

### Date Navigation ✅ (bonus)
- First/last visit dates in place detail are now clickable
- Clicking navigates to that historical day
- Enables exploring your history at a place

### Transit Support ✅ (bonus)
- Added transit as activity type
- Blue color for transit paths on map
- Shows in travel stats bar

---

## Files Changed
- `Sidebar.jsx` - Summary card, expanded timeline, travel stats, date links
- `MapPane.jsx` - Numbered markers, transit color, removed legend
- `JournalView.jsx` - Pass onDateChange to Sidebar
- `App.css` - All new styles

---

## Design Decisions
- Travel stats bar is always visible (provides context even when viewing place detail)
- Visit numbers help users mentally map timeline to markers
- Date links enable serendipitous exploration of history
- Removed map legend since travel stats bar serves same purpose better
