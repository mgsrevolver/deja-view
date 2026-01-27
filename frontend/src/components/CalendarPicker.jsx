import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  format,
  parseISO,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  getDay
} from 'date-fns'
import { fetchWithAuth } from '../lib/api'

export default function CalendarPicker({ selectedDate, onSelect, onClose }) {
  const [viewMonth, setViewMonth] = useState(
    selectedDate ? parseISO(selectedDate) : new Date()
  )

  const monthKey = format(viewMonth, 'yyyy-MM')
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone

  // Fetch days with data for this month
  const { data: daysWithData } = useQuery({
    queryKey: ['days', monthKey, tz],
    queryFn: () => fetchWithAuth(`/api/days?month=${monthKey}&tz=${encodeURIComponent(tz)}`)
  })

  // Create a map of dates with visit counts
  const dataMap = new Map()
  if (daysWithData) {
    for (const day of daysWithData) {
      dataMap.set(day.date, day)
    }
  }

  const monthStart = startOfMonth(viewMonth)
  const monthEnd = endOfMonth(viewMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Padding for start of month
  const startPadding = getDay(monthStart)

  const handlePrevMonth = () => setViewMonth(subMonths(viewMonth, 1))
  const handleNextMonth = () => setViewMonth(addMonths(viewMonth, 1))

  return (
    <div className="calendar-overlay" onClick={onClose}>
      <div className="calendar-modal" onClick={e => e.stopPropagation()}>
        <div className="calendar-header">
          <button onClick={handlePrevMonth}>&larr;</button>
          <h3>{format(viewMonth, 'MMMM yyyy')}</h3>
          <button onClick={handleNextMonth}>&rarr;</button>
        </div>

        <div className="calendar-grid">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="calendar-day-header">{day}</div>
          ))}

          {/* Empty cells for padding */}
          {Array.from({ length: startPadding }).map((_, i) => (
            <div key={`pad-${i}`} className="calendar-day empty" />
          ))}

          {/* Days */}
          {days.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd')
            const dayData = dataMap.get(dateStr)
            const hasData = !!dayData
            const isSelected = selectedDate === dateStr
            const isToday = isSameDay(day, new Date())

            return (
              <button
                key={dateStr}
                className={`calendar-day ${hasData ? 'has-data' : ''} ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                onClick={() => onSelect(dateStr)}
                title={hasData ? `${dayData.visitCount} visits, ${dayData.uniquePlaces} places` : undefined}
              >
                <span className="day-number">{format(day, 'd')}</span>
                {hasData && (
                  <span className="day-indicator" style={{
                    opacity: Math.min(0.3 + (dayData.uniquePlaces / 10), 1)
                  }} />
                )}
              </button>
            )
          })}
        </div>

        <div className="calendar-footer">
          <button className="calendar-close" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}
