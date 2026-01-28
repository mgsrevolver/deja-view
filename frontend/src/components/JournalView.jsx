import { useQuery, useQueryClient } from '@tanstack/react-query'
import { format, parseISO, addDays, subDays } from 'date-fns'
import { fetchWithAuth } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import MapPane from './MapPane'
import Sidebar from './Sidebar'
import CalendarPicker from './CalendarPicker'
import ImportModal from './ImportModal'
import { useState } from 'react'

function getWeatherIcon(condition) {
  const c = (condition || '').toLowerCase()
  if (c.includes('clear') || c.includes('sunny')) return '☀️'
  if (c.includes('partly')) return '⛅'
  if (c.includes('cloud') || c.includes('overcast')) return '☁️'
  if (c.includes('rain') || c.includes('drizzle')) return '🌧️'
  if (c.includes('snow')) return '❄️'
  if (c.includes('thunder') || c.includes('storm')) return '⛈️'
  if (c.includes('fog') || c.includes('mist')) return '🌫️'
  return ''
}

export default function JournalView({ selectedDate, onDateChange, stats }) {
  const { user, signOut } = useAuth()
  const [showCalendar, setShowCalendar] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [selectedVisit, setSelectedVisit] = useState(null)
  const queryClient = useQueryClient()

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  const handleSignOut = async () => {
    await signOut()
  }

  const handleImportSuccess = () => {
    queryClient.invalidateQueries(['stats'])
    queryClient.invalidateQueries(['interesting-day'])
    queryClient.invalidateQueries(['day'])
    setShowImport(false)
  }

  // Fetch day data when date is selected
  const { data: dayData, isLoading } = useQuery({
    queryKey: ['day', selectedDate, tz],
    queryFn: () => fetchWithAuth(`/api/days/${selectedDate}?tz=${encodeURIComponent(tz)}`),
    enabled: !!selectedDate
  })


  const handleDateChange = (newDate) => {
    setSelectedVisit(null)
    onDateChange(newDate)
  }

  const handlePrevDay = () => {
    if (selectedDate) {
      const prev = subDays(parseISO(selectedDate), 1)
      handleDateChange(format(prev, 'yyyy-MM-dd'))
    }
  }

  const handleNextDay = () => {
    if (selectedDate) {
      const next = addDays(parseISO(selectedDate), 1)
      handleDateChange(format(next, 'yyyy-MM-dd'))
    }
  }

  const handleToday = () => {
    handleDateChange(format(new Date(), 'yyyy-MM-dd'))
  }

  const formattedDate = selectedDate
    ? format(parseISO(selectedDate), 'EEEE, MMMM d, yyyy')
    : 'Select a date'

  // Build day summary parts
  const summaryParts = []
  if (dayData?.weather?.condition) {
    const icon = getWeatherIcon(dayData.weather.condition)
    const temp = dayData.weather.tempMax != null ? `${Math.round(dayData.weather.tempMax)}°` : ''
    if (icon || temp) summaryParts.push(`${icon} ${temp}`.trim())
  }
  if (dayData?.visits?.length) {
    summaryParts.push(`${dayData.visits.length} places`)
  }
  if (dayData?.totalDistanceMiles > 0) {
    // Show primary activity distance or total
    const walkDist = dayData.distanceByMode?.walking
    if (walkDist && walkDist > 0.1) {
      summaryParts.push(`${walkDist} mi walked`)
    } else if (dayData.totalDistanceMiles > 0.1) {
      summaryParts.push(`${dayData.totalDistanceMiles} mi traveled`)
    }
  }

  return (
    <div className="journal-view">
      {/* Header */}
      <header className="journal-header">
        <div className="header-left">
          <h1 className="app-title">Deja View</h1>
        </div>

        <div className="header-center">
          <div className="date-nav">
            <button className="nav-btn" onClick={handlePrevDay} title="Previous day">
              &larr;
            </button>
            <button className="date-btn" onClick={() => setShowCalendar(true)}>
              {formattedDate}
            </button>
            <button className="nav-btn" onClick={handleNextDay} title="Next day">
              &rarr;
            </button>
            <button className="nav-btn today-btn" onClick={handleToday} title="Go to today">
              Today
            </button>
          </div>
          {summaryParts.length > 0 && (
            <div className="day-summary">
              {summaryParts.join('  ·  ')}
            </div>
          )}
        </div>

        <div className="header-right">
          <span className="stats-badge">
            {stats.totalVisits.toLocaleString()} visits
          </span>
          <div className="user-menu">
            <span className="user-email">{user?.email}</span>
            <button className="import-btn" onClick={() => setShowImport(true)} title="Import data">
              Import
            </button>
            <button className="sign-out-btn" onClick={handleSignOut} title="Sign out">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main content - split view (map small, sidebar large) */}
      <main className="journal-main">
        <div className="map-pane">
          <MapPane
            visits={dayData?.visits || []}
            path={dayData?.path || []}
            isLoading={isLoading}
            selectedVisit={selectedVisit}
            onVisitClick={setSelectedVisit}
            weatherCondition={dayData?.weather?.condition}
          />
        </div>

        <div className="sidebar-pane">
          <Sidebar
            dayData={dayData}
            isLoading={isLoading}
            selectedVisit={selectedVisit}
            onVisitClick={setSelectedVisit}
          />
        </div>
      </main>

      {/* Calendar modal */}
      {showCalendar && (
        <CalendarPicker
          selectedDate={selectedDate}
          onSelect={(date) => {
            handleDateChange(date)
            setShowCalendar(false)
          }}
          onClose={() => setShowCalendar(false)}
        />
      )}

      {/* Import modal */}
      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onSuccess={handleImportSuccess}
        />
      )}
    </div>
  )
}
