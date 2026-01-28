# PRD: Sidebar Default State
**Date:** 2026-01-28
**Status:** Ready for development

## Problem

When loading a day, before selecting any place, the sidebar shows "Select a place" as an empty state. This wastes valuable screen real estate and doesn't help the user understand their day.

## Solution

Hybrid approach: compact day summary at top + expanded timeline below. When a place is selected, timeline shrinks and place detail appears.

---

## Design

### Default State (no place selected)

```
┌─────────────────────────────────┐
│  DAY SUMMARY                    │
│  ☀️ Clear · 72°/58°             │
│  7 places · 4.2 mi · 4h 45m     │
├─────────────────────────────────┤
│  TIMELINE (expanded)            │
│                                 │
│  08:32  ☕ Blue Bottle Coffee   │
│  09:15  🏢 Office               │
│  12:30  🍜 Lunch spot           │
│  ...                            │
│  (scrollable, fills space)      │
│                                 │
│                                 │
└─────────────────────────────────┘
```

### Place Selected State

```
┌─────────────────────────────────┐
│  PLACE DETAIL                   │
│  [Hero image]                   │
│  Blue Bottle Coffee             │
│  123 Main St                    │
│  Today: 08:32 - 09:10 (38 min)  │
│  Your History: 47 visits        │
│  [Close X]                      │
├─────────────────────────────────┤
│  TIMELINE (compact, 200px)      │
│  08:32  ☕ Blue Bottle ←selected │
│  09:15  🏢 Office               │
│  12:30  🍜 Lunch spot           │
└─────────────────────────────────┘
```

---

## Requirements

### Day Summary Card
- **Weather row**: Emoji + condition + high/low temps
- **Stats row**: Place count · total distance · total active time
- Compact—shouldn't dominate, just provide context
- Only shows when no place is selected
- Graceful degradation: hide weather row if not enriched

### Timeline Behavior
- **Default**: Expands to fill available sidebar space
- **Place selected**: Shrinks to fixed height (~200px)
- Smooth transition between states (CSS transition on height)
- Selected item should remain visible (scroll into view)

### Transitions
- Summary card fades out when place selected
- Place panel fades/slides in
- Timeline height animates smoothly
- Keep transitions snappy (200-300ms)

---

## Data Available

From `/api/days/:date` response, already have:
- `summary.weather` - condition, emoji, high, low
- `summary.placeCount` - number of visits
- `summary.totalDistanceMiles` - distance traveled
- `summary.totalActiveMinutes` - time at places
- `visits[]` - full timeline data

No new API work needed.

---

## Files to Change

- `Sidebar.jsx` - Add summary card, conditional timeline height
- `App.css` - Styles for summary card, height transitions

---

## Out of Scope

- Richer summary content (save for later)
- Animation libraries (CSS only)
- Changes to place detail panel

---

## Success Criteria

1. Loading a day immediately shows useful information
2. No "empty state" feeling—sidebar always has content
3. Selecting a place feels like drilling in, not filling a void
4. Transitions feel smooth and intentional
