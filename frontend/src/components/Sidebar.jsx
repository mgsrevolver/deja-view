import { format, parseISO } from 'date-fns'
import { useEffect, useRef } from 'react'

export default function Sidebar({ dayData, isLoading, selectedVisit, onVisitClick }) {
  if (isLoading) {
    return (
      <div className="sidebar">
        <div className="skeleton-container">
          {/* Skeleton place panel */}
          <div className="skeleton-place">
            <div className="skeleton skeleton-icon"></div>
            <div className="skeleton skeleton-title"></div>
            <div className="skeleton skeleton-subtitle"></div>
          </div>
          {/* Skeleton timeline */}
          <div className="skeleton-timeline">
            <div className="skeleton skeleton-header"></div>
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="skeleton-item">
                <div className="skeleton skeleton-thumb"></div>
                <div className="skeleton-item-text">
                  <div className="skeleton skeleton-time"></div>
                  <div className="skeleton skeleton-name"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!dayData) {
    return (
      <div className="sidebar">
        <div className="sidebar-empty">Select a date to view your journal</div>
      </div>
    )
  }

  const { visits, weather, distanceByType } = dayData

  // Format distance for display
  const formatDistance = (meters) => {
    const miles = meters / 1609.34
    if (miles < 0.1) {
      const feet = Math.round(meters * 3.28084)
      return `${feet} ft`
    }
    return `${miles.toFixed(1)} mi`
  }

  // Get activity distances
  const distances = []
  if (distanceByType) {
    const entries = Object.entries(distanceByType)
    for (const [type, meters] of entries) {
      if (meters > 50) { // Only show if > 50 meters
        distances.push({ type, meters, display: formatDistance(meters) })
      }
    }
    // Sort by distance descending
    distances.sort((a, b) => b.meters - a.meters)
  }

  return (
    <div className="sidebar">
      {/* Day context - weather */}
      {weather && (
        <div className="day-bar">
          <span className="day-weather">
            {weather.condition && `${getWeatherIcon(weather.condition)} `}
            {weather.tempMax != null && `${Math.round(weather.tempMax)}°`}
            {weather.tempMin != null && ` / ${Math.round(weather.tempMin)}°`}
          </span>
        </div>
      )}

      {/* Distance breakdown */}
      {distances.length > 0 && (
        <div className="distance-bar">
          {distances.map(({ type, display }) => (
            <span key={type} className={`distance-item distance-${getActivityClass(type)}`}>
              <span className="distance-dot"></span>
              {display} {getActivityLabel(type)}
            </span>
          ))}
        </div>
      )}

      {/* Selected Place - fills available space */}
      <div className="place-panel">
        {selectedVisit ? (
          <PlaceDetail visit={selectedVisit} onClose={() => onVisitClick(null)} />
        ) : (
          <div className="place-empty">
            <span className="place-empty-icon">📍</span>
            <p>Select a place</p>
            <span className="place-empty-hint">Tap a marker or timeline item</span>
          </div>
        )}
      </div>

      {/* Timeline - fixed at bottom */}
      <div className="timeline-panel">
        <div className="timeline-header">Timeline · {visits.length} places</div>
        <Timeline
          visits={visits}
          selectedVisit={selectedVisit}
          onVisitClick={onVisitClick}
        />
      </div>
    </div>
  )
}

function PlaceDetail({ visit, onClose }) {
  const placeName = visit.place?.name || visit.semanticType || 'Unknown Place'
  const imageUrl = visit.place?.imageUrl
  const hasHistory = visit.place?.totalVisits > 1 || visit.place?.totalMinutes

  return (
    <div className="place-detail">
      {/* Hero image */}
      {imageUrl && (
        <div className="place-hero">
          <img src={imageUrl} alt={placeName} />
        </div>
      )}

      {/* Close button */}
      <button className="place-close" onClick={onClose}>×</button>

      {/* Content */}
      <div className="place-body">
        {/* Name & Address */}
        <div className="place-header">
          <span className="place-icon">{getIcon(visit.semanticType)}</span>
          <div>
            <h2 className="place-name">{placeName}</h2>
            {visit.place?.address && (
              <p className="place-address">{visit.place.address}</p>
            )}
          </div>
        </div>

        {/* Today's Visit */}
        <div className="place-card">
          <div className="card-label">Today</div>
          <div className="card-row">
            <span className="card-time">
              {format(parseISO(visit.startTime), 'h:mm a')}
              {visit.endTime && ` – ${format(parseISO(visit.endTime), 'h:mm a')}`}
            </span>
            {visit.durationMinutes && (
              <span className="card-duration">{formatDuration(visit.durationMinutes)}</span>
            )}
          </div>
        </div>

        {/* History */}
        {hasHistory && (
          <div className="place-card">
            <div className="card-label">Your History</div>
            <div className="history-stats">
              {visit.place?.totalVisits > 1 && (
                <div className="history-stat">
                  <span className="stat-value">{visit.place.totalVisits}</span>
                  <span className="stat-label">visits</span>
                </div>
              )}
              {visit.place?.totalMinutes && (
                <div className="history-stat">
                  <span className="stat-value">{formatTotalTime(visit.place.totalMinutes)}</span>
                  <span className="stat-label">time spent</span>
                </div>
              )}
            </div>
            {visit.place?.firstVisitDate && (
              <div className="history-dates">
                <span>First {formatDate(visit.place.firstVisitDate)}</span>
                {visit.place?.lastVisitDate && visit.place?.totalVisits > 1 && (
                  <span>Last {formatDate(visit.place.lastVisitDate)}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Place types */}
        {visit.place?.types?.length > 0 && (
          <div className="place-tags">
            {visit.place.types.slice(0, 3).map((type, i) => (
              <span key={i} className="place-tag">{formatType(type)}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Timeline({ visits, selectedVisit, onVisitClick }) {
  const listRef = useRef(null)
  const selectedRef = useRef(null)

  useEffect(() => {
    if (selectedRef.current) {
      selectedRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  }, [selectedVisit?.id])

  if (visits.length === 0) {
    return <div className="timeline-empty">No visits recorded</div>
  }

  return (
    <div className="timeline-list" ref={listRef}>
      {visits.map((visit, idx) => {
        const isSelected = selectedVisit?.id === visit.id
        const placeName = visit.place?.name || visit.semanticType || 'Unknown'

        return (
          <button
            key={visit.id || idx}
            ref={isSelected ? selectedRef : null}
            className={`timeline-item ${isSelected ? 'selected' : ''}`}
            onClick={() => onVisitClick(isSelected ? null : visit)}
          >
            <div className="item-thumb">
              {visit.place?.imageUrl ? (
                <img src={visit.place.imageUrl} alt="" />
              ) : (
                <span>{getIcon(visit.semanticType)}</span>
              )}
            </div>
            <div className="item-content">
              <span className="item-time">{format(parseISO(visit.startTime), 'h:mm a')}</span>
              <span className="item-name">{placeName}</span>
            </div>
            {isSelected && <span className="item-selected">◀</span>}
          </button>
        )
      })}
    </div>
  )
}

// Helpers
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

function getActivityClass(type) {
  const t = (type || '').toLowerCase()
  if (t.includes('walk')) return 'walk'
  if (t.includes('bik') || t.includes('cycl')) return 'bike'
  if (t.includes('vehicle') || t.includes('driv') || t.includes('car')) return 'drive'
  if (t.includes('run')) return 'walk'
  if (t.includes('transit') || t.includes('bus') || t.includes('train')) return 'transit'
  return 'other'
}

function getActivityLabel(type) {
  const t = (type || '').toLowerCase()
  if (t.includes('walk')) return 'walked'
  if (t.includes('bik') || t.includes('cycl')) return 'biked'
  if (t.includes('vehicle') || t.includes('driv') || t.includes('car')) return 'driven'
  if (t.includes('run')) return 'ran'
  if (t.includes('transit') || t.includes('bus') || t.includes('train')) return 'transit'
  return ''
}

function getIcon(semanticType) {
  const type = (semanticType || '').toLowerCase()
  if (type.includes('home')) return '🏠'
  if (type.includes('work')) return '💼'
  if (type.includes('restaurant') || type.includes('food')) return '🍽️'
  if (type.includes('gym') || type.includes('fitness')) return '🏋️'
  if (type.includes('store') || type.includes('shop')) return '🛒'
  if (type.includes('park')) return '🌳'
  if (type.includes('airport')) return '✈️'
  if (type.includes('hotel')) return '🏨'
  return '📍'
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function formatTotalTime(minutes) {
  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  if (days < 7) {
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days} days`
  }
  // 7+ days: just show days
  return `${days} days`
}

function formatType(type) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}
