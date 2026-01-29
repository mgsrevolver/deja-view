# PRD: Shareable Day Image

**Date:** 2026-01-29
**Status:** Planning

## Overview

Generate a shareable Instagram-style image (1080x1080) that summarizes a user's day. Polaroid-style stacked photos with date, place names, and durations. Users control what information appears before generating.

---

## User Flow

1. User views a day in the journal
2. Clicks "Share" button (new button in header or sidebar)
3. **Share Modal** opens with:
   - Preview of the image layout (CSS mockup)
   - List of places with checkboxes (only places with photos)
   - Toggle: Show/hide visit times
   - Toggle: Show/hide durations
   - Toggle: Show/hide place names
4. User customizes selections
5. Clicks "Generate Image"
6. Loading state while backend generates
7. Image displays with "Download" button
8. User saves to device, shares on social media

---

## Image Specification

**Dimensions:** 1080 x 1080 pixels (Instagram square)

**Layout: Polaroid Stack**
```
┌─────────────────────────────────┐
│                                 │
│   ┌─────────┐                   │
│   │  photo  │ ←─ rotated -5°    │
│   │   1     │                   │
│   ├─────────┤                   │
│   │ Place 1 │    ┌─────────┐    │
│   │ 2h 30m  │    │  photo  │    │
│   └─────────┘    │   2     │    │
│          ┌──────►├─────────┤    │
│          │       │ Place 2 │    │
│   rotated 3°     │ 45m     │    │
│                  └─────────┘    │
│                                 │
│   Tuesday, January 28, 2026     │
│                                 │
│   ☀️ 72° · 4 places · 3.2 mi    │
│                                 │
│              [Deja View logo]   │
└─────────────────────────────────┘
```

**Visual Elements:**
- Background: Dark gradient (#1a1a2e → #16213e)
- Polaroid frames: White border, slight drop shadow
- Photos: 280x280 px, with 40px white border (total 360x400 per Polaroid)
- Date: Large, white, centered near bottom
- Summary line: Weather + place count + distance
- Branding: Small "Deja View" watermark, bottom right

**Photo Layout Rules:**
- Max 4 photos displayed (most visited places by duration)
- Each Polaroid rotated randomly between -8° and +8°
- Stacked with overlapping (z-index based on visit order)
- If fewer than 4 places with photos, show what's available
- Minimum 1 photo required to generate

---

## Privacy Controls

| Control | Default | Effect |
|---------|---------|--------|
| Place checkboxes | All checked | Include/exclude specific places |
| Show times | Off | Display "9:30 AM" on Polaroid |
| Show durations | On | Display "2h 30m" on Polaroid |
| Show place names | On | Display place name on Polaroid |

**Validation:**
- At least 1 place must be selected
- At least 1 selected place must have a photo

---

## Frontend Responsibilities

**New Files:**
- `src/components/ShareModal.jsx` - Modal with controls and preview

**ShareModal.jsx Spec:**

```jsx
// Props
interface ShareModalProps {
  dayData: DayData
  date: string
  onClose: () => void
}

// State
- selectedPlaces: string[] (place IDs)
- showTimes: boolean
- showDurations: boolean
- showPlaceNames: boolean
- isGenerating: boolean
- generatedImageUrl: string | null
- error: string | null
```

**UI Sections:**

1. **Header**
   - Title: "Share Your Day"
   - Close button

2. **Preview Area**
   - CSS-based mockup of Polaroid stack
   - Updates live as user toggles options
   - Not pixel-perfect (just gives idea of layout)

3. **Place Selection**
   - List only places that have `imageUrl`
   - Each row: checkbox, photo thumbnail, place name, duration
   - "Select All" / "Deselect All" links

4. **Display Options**
   - Toggle switches for times/durations/place names
   - Styled consistently with app

5. **Action Buttons**
   - "Generate Image" - primary button
   - "Cancel" - secondary

6. **Generated State**
   - Full preview of generated image
   - "Download" button (triggers file save)
   - "Generate Another" to go back to options

**API Call:**
```javascript
const response = await fetchWithAuth('/api/share/generate-image', {
  method: 'POST',
  body: JSON.stringify({
    date: '2026-01-28',
    placeIds: ['abc123', 'def456'],
    options: {
      showTimes: false,
      showDurations: true,
      showPlaceNames: true
    }
  })
})
// Returns: { imageUrl: 'data:image/png;base64,...' } or { imageUrl: '/api/share/images/xyz.png' }
```

**Integration Points:**
- Add "Share" button to `JournalView.jsx` header (near date navigation)
- Import and render `ShareModal` when share button clicked

---

## Backend Responsibilities

**New Files:**
- `src/services/image-generator.js` - Sharp-based image composition
- `src/routes/share.js` - API endpoint (or add to server.js)

**Dependencies:**
```bash
npm install sharp
```

**Font Setup:**
1. Download Poppins from Google Fonts (Regular 400, SemiBold 600)
2. Save to `backend/assets/fonts/Poppins-Regular.ttf` and `Poppins-SemiBold.ttf`
3. Register font with Sharp/canvas for SVG text rendering

**Storage Setup:**
1. Create `backend/generated-images/` directory
2. Add to `.gitignore`
3. Add `SharedImage` model to Prisma schema
4. Run migration

**API Endpoints:**

```
POST /api/share/generate-image
Authorization: Bearer <token>

Request Body:
{
  "date": "2026-01-28",
  "placeIds": ["abc123", "def456"],
  "options": {
    "showTimes": false,
    "showDurations": true,
    "showPlaceNames": true
  }
}

Response:
{
  "imageId": "abc123xyz",
  "imageUrl": "/api/share/images/abc123xyz.png"
}
```

```
GET /api/share/images/:imageId.png
Authorization: Bearer <token>

Response: PNG image binary (Content-Type: image/png)
```

```
GET /api/share/history
Authorization: Bearer <token>

Response:
{
  "images": [
    { "imageId": "abc123xyz", "date": "2026-01-28", "createdAt": "2026-01-29T..." },
    ...
  ]
}
```

**Storage Schema (add to Prisma):**
```prisma
model SharedImage {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  date      String   // The day being shared (YYYY-MM-DD)
  filename  String   // Stored filename
  options   Json     // { showTimes, showDurations, showPlaceNames, placeIds }
  createdAt DateTime @default(now())

  @@index([userId])
}
```

**image-generator.js Spec:**

```javascript
// Main function
async function generateDayImage({
  date,           // '2026-01-28'
  visits,         // Array of visit objects with place data
  weather,        // { emoji, condition, high, low }
  totalDistance,  // miles
  options         // { showTimes, showDurations, showPlaceNames }
}) → Buffer (PNG)

// Steps:
// 1. Create 1080x1080 canvas with gradient background
// 2. For each visit (max 4):
//    a. Fetch place photo from imageUrl
//    b. Resize to 280x280
//    c. Add white Polaroid border
//    d. Add text (name, duration, time) if enabled
//    e. Rotate randomly -8° to +8°
//    f. Composite onto canvas at calculated position
// 3. Add date text (large, bottom area)
// 4. Add summary line (weather + places + distance)
// 5. Add "Deja View" watermark
// 6. Return PNG buffer
```

**Sharp Operations Needed:**
- `sharp().resize()` - Resize place photos
- `sharp().extend()` - Add white border (Polaroid frame)
- `sharp().composite()` - Layer photos onto background
- `sharp().rotate()` - Rotate Polaroids
- `sharp().png()` - Output format

**Text Rendering:**
Sharp doesn't render text natively. Options:
1. Use `@napi-rs/canvas` alongside Sharp for text
2. Pre-render text as SVG, composite with Sharp
3. Use Sharp's SVG support: create SVG with text, convert to PNG

**Recommended: SVG text overlay**
```javascript
const textSvg = `
<svg width="1080" height="1080">
  <text x="540" y="950" text-anchor="middle"
        font-family="Arial" font-size="48" fill="white">
    Tuesday, January 28, 2026
  </text>
</svg>
`
// Composite SVG onto image
```

**Error Handling:**
- If place photo fetch fails, skip that place
- If all photo fetches fail, return error
- Timeout on external image fetches (5 seconds)

---

## Data Flow

```
┌─────────────┐     POST /api/share/generate-image      ┌─────────────┐
│   Frontend  │ ──────────────────────────────────────► │   Backend   │
│  ShareModal │     { date, placeIds, options }         │   server.js │
└─────────────┘                                         └──────┬──────┘
                                                               │
                                                               ▼
                                                    ┌──────────────────┐
                                                    │ image-generator  │
                                                    │    service       │
                                                    └────────┬─────────┘
                                                             │
                    ┌────────────────────────────────────────┼────────┐
                    │                                        │        │
                    ▼                                        ▼        ▼
           ┌───────────────┐                        ┌─────────┐  ┌─────────┐
           │ Fetch photos  │                        │ Generate│  │  Add    │
           │ from Google   │                        │ Polaroid│  │  text   │
           │ Places URLs   │                        │ stack   │  │  SVG    │
           └───────────────┘                        └─────────┘  └─────────┘
                                                             │
                                                             ▼
                                                    ┌──────────────────┐
                                                    │  Return base64   │
                                                    │   PNG image      │
                                                    └──────────────────┘
```

---

## Implementation Order

### Phase 1: Backend Image Generation
1. Install Sharp dependency
2. Create `image-generator.js` with basic Polaroid layout
3. Create API endpoint `/api/share/generate-image`
4. Test with hardcoded data via curl/Postman

### Phase 2: Frontend Modal
1. Create `ShareModal.jsx` with place selection UI
2. Add privacy toggle controls
3. Implement CSS preview (approximate layout)
4. Wire up API call and loading states

### Phase 3: Integration & Polish
1. Add Share button to JournalView
2. Handle edge cases (no photos, fetch failures)
3. Optimize image quality and file size
4. Add download functionality

---

## Decisions

| Question | Decision |
|----------|----------|
| **Font** | Embed custom font (instagrammy vibe) - **Poppins** (clean, modern, friendly) |
| **Branding** | Text only for now ("Deja View" in elegant type) |
| **Output format** | PNG (crisp quality) |
| **Caching** | Store generated images for later retrieval |

### Font: Poppins
- Google Font, freely embeddable
- Download TTF/OTF for server-side rendering
- Weights needed: Regular (400), SemiBold (600)
- Fallback: system sans-serif

### Image Storage
- Save to `backend/generated-images/` or cloud storage
- Filename: `{userId}_{date}_{hash}.png`
- Add database tracking for retrieval
- API endpoint: `GET /api/share/images/:imageId`

---

## Success Criteria

- [ ] User can generate image from any day with photos
- [ ] Privacy controls work (exclude places, hide times)
- [ ] Image looks good on Instagram (clear, readable)
- [ ] Generation completes in under 5 seconds
- [ ] Download works on mobile and desktop
