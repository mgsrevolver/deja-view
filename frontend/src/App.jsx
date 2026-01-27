import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from './contexts/AuthContext'
import { fetchWithAuth } from './lib/api'
import JournalView from './components/JournalView'
import LoginPage from './components/LoginPage'
import './App.css'

function App() {
  const { user, loading: authLoading } = useAuth()
  const [selectedDate, setSelectedDate] = useState(null)

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Fetch stats to get date range (only when authenticated)
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats', tz],
    queryFn: () => fetchWithAuth(`/api/stats?tz=${encodeURIComponent(tz)}`),
    enabled: !!user
  })

  // Fetch interesting day to start with (only when authenticated)
  const { data: interestingDay } = useQuery({
    queryKey: ['interesting-day', tz],
    queryFn: () => fetchWithAuth(`/api/interesting-day?tz=${encodeURIComponent(tz)}`),
    enabled: !!user && !selectedDate
  })

  // Set initial date to interesting day once loaded
  useEffect(() => {
    if (interestingDay?.date && !selectedDate) {
      setSelectedDate(interestingDay.date)
    }
  }, [interestingDay, selectedDate])

  // Auth loading
  if (authLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-content">
          <h1>Deja View</h1>
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  // Not authenticated
  if (!user) {
    return <LoginPage />
  }

  // Data loading
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

  // No data
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
