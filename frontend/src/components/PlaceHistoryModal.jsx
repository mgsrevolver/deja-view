import { useState } from 'react'
import { format, parseISO } from 'date-fns'

export default function PlaceHistoryModal({ place, onClose, onNavigateToDate }) {
  const [showAll, setShowAll] = useState(false)

  if (!place) return null

  const visitsToShow = showAll ? place.visits : place.visits.slice(0, 5)

  const formatDuration = (minutes) => {
    if (!minutes) return ''
    if (minutes < 60) return `${minutes} min`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  const formatTotalTime = (minutes) => {
    if (!minutes) return ''
    const hours = Math.floor(minutes / 60)
    if (hours < 24) {
      const mins = minutes % 60
      return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
    }
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days} days`
  }

  const formatDate = (dateStr) => {
    try {
      return format(parseISO(dateStr), 'MMM d, yyyy')
    } catch {
      return dateStr
    }
  }

  const handleVisitClick = (visitDate) => {
    onNavigateToDate(visitDate)
  }

  return (
    <div className="place-history-overlay" onClick={onClose}>
      <div className="place-history-modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>

        {/* Header */}
        <div className="modal-header">
          {place.photoUrl && (
            <img src={place.photoUrl} alt="" className="modal-photo" />
          )}
          <div className="modal-title">
            <h3>{place.name || 'Unknown Place'}</h3>
          </div>
        </div>

        {/* Stats */}
        <div className="modal-stats">
          <span className="stat-primary">{place.visitCount} visits</span>
          {place.totalMinutes > 0 && (
            <>
              <span className="stat-sep">·</span>
              <span>{formatTotalTime(place.totalMinutes)} total</span>
            </>
          )}
        </div>

        {place.firstVisit && place.lastVisit && (
          <div className="modal-date-range">
            First: {formatDate(place.firstVisit)} · Last: {formatDate(place.lastVisit)}
          </div>
        )}

        {/* Visit list */}
        <ul className="visit-list">
          {visitsToShow.map((visit, idx) => (
            <li
              key={idx}
              className="visit-row"
              onClick={() => handleVisitClick(visit.date)}
            >
              <span className="visit-date">{formatDate(visit.date)}</span>
              <span className="visit-time">{visit.startTime}</span>
              <span className="visit-duration">{formatDuration(visit.duration)}</span>
              <span className="visit-arrow">→</span>
            </li>
          ))}
        </ul>

        {place.visits.length > 5 && !showAll && (
          <button
            className="show-all-btn"
            onClick={() => setShowAll(true)}
          >
            Show all {place.visitCount} visits
          </button>
        )}
      </div>
    </div>
  )
}
