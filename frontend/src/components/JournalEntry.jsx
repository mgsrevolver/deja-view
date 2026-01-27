import { format, parseISO } from 'date-fns'

export default function JournalEntry({ visit, isFirst, isLast }) {
  const startTime = format(parseISO(visit.startTime), 'h:mm a')
  const endTime = visit.endTime ? format(parseISO(visit.endTime), 'h:mm a') : null

  const placeName = visit.place?.name || visit.semanticType || 'Unknown Place'
  const address = visit.place?.address
  const imageUrl = visit.place?.imageUrl
  const placeTypes = visit.place?.types || []

  const icon = getSemanticIcon(visit.semanticType)

  // Place stats
  const firstVisitDate = visit.place?.firstVisitDate
  const lastVisitDate = visit.place?.lastVisitDate
  const totalVisits = visit.place?.totalVisits
  const totalMinutes = visit.place?.totalMinutes

  const hasStats = firstVisitDate || totalVisits || totalMinutes

  return (
    <article className="journal-entry">
      {/* Timeline connector */}
      <div className="entry-timeline">
        <div className={`timeline-line ${isFirst ? 'first' : ''} ${isLast ? 'last' : ''}`} />
        <div className="timeline-dot" />
        <div className="timeline-time">
          <span className="time-start">{startTime}</span>
          {endTime && <span className="time-end">{endTime}</span>}
        </div>
      </div>

      {/* Entry content */}
      <div className="entry-card">
        {/* Hero image */}
        {imageUrl && (
          <div className="entry-image">
            <img src={imageUrl} alt={placeName} />
          </div>
        )}

        <div className="entry-body">
          {/* Header */}
          <div className="entry-header">
            <span className="entry-icon">{icon}</span>
            <div className="entry-title">
              <h3 className="entry-name">{placeName}</h3>
              {address && <p className="entry-address">{address}</p>}
            </div>
          </div>

          {/* Duration */}
          {visit.durationMinutes && (
            <div className="entry-duration">
              {formatDuration(visit.durationMinutes)}
            </div>
          )}

          {/* Types */}
          {placeTypes.length > 0 && (
            <div className="entry-types">
              {placeTypes.slice(0, 3).map((type, i) => (
                <span key={i} className="entry-type">
                  {formatType(type)}
                </span>
              ))}
            </div>
          )}

          {/* Stats */}
          {hasStats && (
            <div className="entry-stats">
              {totalVisits && totalVisits > 1 && (
                <div className="entry-stat">
                  <span className="stat-value">{totalVisits}</span>
                  <span className="stat-label">total visits</span>
                </div>
              )}
              {totalMinutes && (
                <div className="entry-stat">
                  <span className="stat-value">{formatDuration(totalMinutes)}</span>
                  <span className="stat-label">total time here</span>
                </div>
              )}
              {firstVisitDate && (
                <div className="entry-stat">
                  <span className="stat-value">{formatDate(firstVisitDate)}</span>
                  <span className="stat-label">first visit</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </article>
  )
}

function getSemanticIcon(semanticType) {
  const type = (semanticType || '').toLowerCase()
  if (type.includes('home')) return '🏠'
  if (type.includes('work')) return '💼'
  if (type.includes('restaurant') || type.includes('food')) return '🍽️'
  if (type.includes('gym') || type.includes('fitness')) return '🏋️'
  if (type.includes('store') || type.includes('shop')) return '🛒'
  if (type.includes('park')) return '🌳'
  if (type.includes('airport')) return '✈️'
  if (type.includes('hotel')) return '🏨'
  if (type.includes('bar')) return '🍺'
  if (type.includes('cafe') || type.includes('coffee')) return '☕'
  return '📍'
}

function formatType(type) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    if (remainingHours > 0) return `${days}d ${remainingHours}h`
    return `${days}d`
  }
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}
