import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import JournalView from './components/JournalView'
import './App.css'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

function App() {
  const [selectedDate, setSelectedDate] = useState(null)

  // Fetch stats to get date range
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => fetch(`${API_BASE}/api/stats`).then(r => r.json())
  })

  // Fetch interesting day to start with
  const { data: interestingDay } = useQuery({
    queryKey: ['interesting-day'],
    queryFn: () => fetch(`${API_BASE}/api/interesting-day`).then(r => r.json()),
    enabled: !selectedDate
  })

  // Set initial date to interesting day once loaded
  useEffect(() => {
    if (interestingDay?.date && !selectedDate) {
      setSelectedDate(interestingDay.date)
    }
  }, [interestingDay, selectedDate])

  if (statsLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <h1>Deja View</h1>
          <p>Loading your location history...</p>
        </div>
      </div>
    )
  }

  if (!stats?.totalVisits) {
    return (
      <div className="empty-screen">
        <div className="empty-content">
          <h1>Deja View</h1>
          <p>No location data found.</p>
          <p className="hint">Run the import script to load your Google Takeout data.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <JournalView
        selectedDate={selectedDate}
        onDateChange={setSelectedDate}
        stats={stats}
      />
    </div>
  )
}

export default App
