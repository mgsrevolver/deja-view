import { format, parseISO } from 'date-fns'
import { useEffect, useRef } from 'react'

export default function Sidebar({ dayData, isLoading, selectedVisit, onVisitClick, onDateChange }) {
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

  const { visits, summary, path = [] } = dayData

  // Calculate distances from path data (same source as the map)
  const calculatedDistances = calculateDistancesByMode(path)

  // Format active time
  const formatActiveTime = (minutes) => {
    if (!minutes) return null
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    if (hours === 0) return `${mins}m`
    if (mins === 0) return `${hours}h`
    return `${hours}h ${mins}m`
  }

  const hasPlaceSelected = !!selectedVisit

  // Check if there's any travel data to show
  const hasDistanceData =
    calculatedDistances.walking > 0 ||
    calculatedDistances.cycling > 0 ||
    calculatedDistances.driving > 0 ||
    calculatedDistances.transit > 0 ||
    calculatedDistances.other > 0

  return (
    <div className={`sidebar ${hasPlaceSelected ? 'place-selected' : ''}`}>
      {/* Persistent Travel Stats - always visible */}
      {hasDistanceData && (
        <div className="travel-stats-bar">
          {calculatedDistances.walking > 0 && (
            <div className="travel-mode walk">
              <span className="mode-dot"></span>
              <span className="mode-value">{calculatedDistances.walking.toFixed(1)} mi</span>
              <span className="mode-label">walked</span>
            </div>
          )}
          {calculatedDistances.cycling > 0 && (
            <div className="travel-mode bike">
              <span className="mode-dot"></span>
              <span className="mode-value">{calculatedDistances.cycling.toFixed(1)} mi</span>
              <span className="mode-label">biked</span>
            </div>
          )}
          {calculatedDistances.driving > 0 && (
            <div className="travel-mode drive">
              <span className="mode-dot"></span>
              <span className="mode-value">{calculatedDistances.driving.toFixed(1)} mi</span>
              <span className="mode-label">driven</span>
            </div>
          )}
          {calculatedDistances.transit > 0 && (
            <div className="travel-mode transit">
              <span className="mode-dot"></span>
              <span className="mode-value">{calculatedDistances.transit.toFixed(1)} mi</span>
              <span className="mode-label">transit</span>
            </div>
          )}
          {calculatedDistances.other > 0 && (
            <div className="travel-mode other">
              <span className="mode-dot"></span>
              <span className="mode-value">{calculatedDistances.other.toFixed(1)} mi</span>
              <span className="mode-label">other</span>
            </div>
          )}
        </div>
      )}

      {/* Day Summary - shows when no place selected */}
      {!hasPlaceSelected && summary && (
        <div className="day-summary-card">
          {/* Weather row */}
          {summary.weather && (
            <div className="summary-weather">
              <span className="weather-icon">{summary.weather.emoji || getWeatherIcon(summary.weather.condition)}</span>
              <span className="weather-condition">{summary.weather.condition}</span>
              {summary.weather.high != null && (
                <span className="weather-temps">
                  {Math.round(summary.weather.high)}° / {Math.round(summary.weather.low)}°
                </span>
              )}
            </div>
          )}
          {/* Stats row */}
          <div className="summary-stats">
            {summary.placeCount > 0 && (
              <span className="summary-stat">{summary.placeCount} places</span>
            )}
            {summary.totalDistanceMiles > 0.1 && (
              <span className="summary-stat">{summary.totalDistanceMiles.toFixed(1)} mi</span>
            )}
            {summary.totalActiveMinutes > 0 && (
              <span className="summary-stat">{formatActiveTime(summary.totalActiveMinutes)}</span>
            )}
          </div>
        </div>
      )}

      {/* Place Detail - shows when place selected */}
      {hasPlaceSelected && (
        <div className="place-panel">
          <PlaceDetail visit={selectedVisit} onClose={() => onVisitClick(null)} onDateChange={onDateChange} />
        </div>
      )}

      {/* Timeline - expands when no place selected, shrinks when place selected */}
      <div className={`timeline-panel ${hasPlaceSelected ? 'compact' : 'expanded'}`}>
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

function PlaceDetail({ visit, onClose, onDateChange }) {
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
                <button
                  className="date-link"
                  onClick={() => onDateChange(visit.place.firstVisitDate.split('T')[0])}
                >
                  First {formatDate(visit.place.firstVisitDate)}
                </button>
                {visit.place?.lastVisitDate && visit.place?.totalVisits > 1 && (
                  <button
                    className="date-link"
                    onClick={() => onDateChange(visit.place.lastVisitDate.split('T')[0])}
                  >
                    Last {formatDate(visit.place.lastVisitDate)}
                  </button>
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
            <span className="item-number">{idx + 1}</span>
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

// Calculate distance between two lat/lon points in miles (Haversine formula)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959 // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

// Categorize activity type (same logic as map path coloring)
function categorizeActivity(activityType) {
  const type = (activityType || '').toLowerCase()
  if (type.includes('walk')) return 'walking'
  if (type.includes('bik') || type.includes('cycl')) return 'cycling'
  if (type.includes('vehicle') || type.includes('driv') || type.includes('car') || type.includes('automotive')) return 'driving'
  if (type.includes('transit') || type.includes('train') || type.includes('bus') || type.includes('subway') || type.includes('rail')) return 'transit'
  return 'other'
}

// Calculate distances by mode from path data
function calculateDistancesByMode(path) {
  const distances = { walking: 0, cycling: 0, driving: 0, transit: 0, other: 0 }

  if (!path || path.length < 2) return distances

  for (let i = 1; i < path.length; i++) {
    const prev = path[i - 1]
    const curr = path[i]
    const dist = haversineDistance(prev.lat, prev.lon, curr.lat, curr.lon)
    const category = categorizeActivity(curr.activityType || prev.activityType)
    distances[category] += dist
  }

  return distances
}

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
