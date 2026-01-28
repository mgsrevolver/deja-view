# Déjà View - Frontend

React frontend for Déjà View location journaling app.

## Stack

- **React** 18+ with Vite
- **React Query** - API state management
- **Leaflet** - Map visualization (CartoDB Dark Matter tiles)
- **date-fns** - Date manipulation
- **Supabase** - Authentication

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure environment:
   - `.env` file should contain:
     - `VITE_API_URL=http://localhost:3001`
     - `VITE_SUPABASE_URL=your-supabase-url`
     - `VITE_SUPABASE_ANON_KEY=your-anon-key`

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
│   ├── JournalView.jsx       # Main split-screen layout + day summary
│   ├── MapPane.jsx           # Left pane: Leaflet map with weather mood
│   ├── Sidebar.jsx           # Right pane: place details + timeline
│   ├── CalendarPicker.jsx    # Modal calendar with data indicators
│   ├── ImportModal.jsx       # Google Takeout upload UI
│   └── LoginPage.jsx         # Authentication UI
├── contexts/
│   └── AuthContext.jsx       # Supabase auth state
├── lib/
│   ├── api.js                # API client with auth
│   └── supabase.js           # Supabase client
└── App.jsx
```

## Features

### Current
- **Google Takeout Import** - Drag-and-drop JSON upload
- **Day Summary Header** - Weather, place count, distance at a glance
- **Interactive Map** - Dark tiles, activity-colored paths, visit markers
- **Weather Mood** - Subtle ambient tinting based on weather conditions
- **Skeleton Loaders** - Polished loading states
- **Calendar Navigation** - Browse days with data indicators

### Coming Soon
- Google Photos integration
- Spotify listening history
- Share mode with privacy controls

## Development

Backend API must be running on port 3001 for the frontend to work properly.

## Design Philosophy

> "A richer experience of reflecting on the past than what's available from all of these distinct unconnected tools."

The UI is designed to feel like opening a memory, not browsing data. Weather affects the mood, the map tells the story, and every piece of context makes the day more alive.
