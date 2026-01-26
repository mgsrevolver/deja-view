# Déjà View - Frontend

React frontend for Déjà View location journaling app.

## Stack

- **React** 18+ with Vite
- **React Router** - Navigation
- **React Query** - API state management
- **Leaflet** - Map visualization
- **date-fns** - Date manipulation

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
   - `.env` file should contain `VITE_API_URL=http://localhost:3001`

3. Start development server:
```bash
npm run dev
```

Frontend will run on `http://localhost:5173`

## Available Scripts

- `npm run dev` - Start development server with HMR
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## Project Structure

```
src/
├── components/
│   ├── JournalView.jsx       # Main split-screen layout
│   ├── MapPane.jsx            # Left pane: Leaflet map
│   ├── Sidebar.jsx            # Right pane: enriched data
│   ├── CalendarPicker.jsx     # Modal calendar
│   ├── DateLink.jsx           # Clickable date component
│   └── VisitCard.jsx          # Individual visit in timeline
├── services/
│   └── api.js                 # API client
└── App.jsx
```

## Development

Backend API must be running on port 3001 for the frontend to work properly.

## Coming Soon

- Phase 2: Split-screen UI with calendar navigation
- Phase 3: Distance analytics display
- Phase 4+: Weather, Spotify, Google Places enrichment
