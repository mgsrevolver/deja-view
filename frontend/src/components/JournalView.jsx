import { useQuery } from '@tanstack/react-query'
import { format, parseISO, addDays, subDays } from 'date-fns'
import { fetchWithAuth } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import MapPane from './MapPane'
import Sidebar from './Sidebar'
import CalendarPicker from './CalendarPicker'
import { useState } from 'react'

export default function JournalView({ selectedDate, onDateChange, stats }) {
  const { user, signOut } = useAuth()
  const [showCalendar, setShowCalendar] = useState(false)
  const [selectedVisit, setSelectedVisit] = useState(null)

  const handleSignOut = async () => {
    await signOut()
  }

  // Fetch day data when date is selected
  const { data: dayData, isLoading } = useQuery({
    queryKey: ['day', selectedDate],
    queryFn: () => fetchWithAuth(`/api/days/${selectedDate}`),
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

  return (
    <div className="journal-view">
      {/* Header */}
      <header className="journal-header">
        <div className="header-left">
          <h1 className="app-title">Deja View</h1>
        </div>

        <div className="header-center">
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

        <div className="header-right">
          <span className="stats-badge">
            {stats.totalVisits.toLocaleString()} visits
          </span>
          <div className="user-menu">
            <span className="user-email">{user?.email}</span>
            <button className="sign-out-btn" onClick={handleSignOut} title="Sign out">
              Sign Out
            </button>
          </div>
        </div>
      </header>

      {/* Main content - split view */}
      <main className="journal-main">
        <div className="map-pane">
          <MapPane
            visits={dayData?.visits || []}
            path={dayData?.path || []}
            isLoading={isLoading}
            selectedVisit={selectedVisit}
            onCloseOverlay={() => setSelectedVisit(null)}
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
    </div>
  )
}
