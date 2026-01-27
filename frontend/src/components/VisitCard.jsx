import { format, parseISO } from 'date-fns'

export default function VisitCard({ visit, isSelected, onClick }) {
  const startTime = format(parseISO(visit.startTime), 'h:mm a')
  const endTime = visit.endTime ? format(parseISO(visit.endTime), 'h:mm a') : null

  const placeName = visit.place?.name || visit.semanticType || 'Unknown Place'
  const placeTypes = visit.place?.types || []
  const imageUrl = visit.place?.imageUrl

  const icon = getSemanticIcon(visit.semanticType)

  return (
    <div
      className={`visit-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      {/* Hero image at top */}
      {imageUrl && (
        <div className="visit-image">
          <img src={imageUrl} alt={placeName} />
        </div>
      )}

      <div className="visit-card-body">
        {/* Time */}
        <div className="visit-time">
          <span className="time-start">{startTime}</span>
          {endTime && <span className="time-end">{endTime}</span>}
        </div>

        {/* Content */}
        <div className="visit-content">
          <div className="visit-icon">{icon}</div>

          <div className="visit-details">
            <h4 className="visit-name">{placeName}</h4>

            {visit.place?.address && (
              <p className="visit-address">{visit.place.address}</p>
            )}

            {placeTypes.length > 0 && (
              <div className="visit-types">
                {placeTypes.slice(0, 2).map((type, i) => (
                  <span key={i} className="type-badge">
                    {formatType(type)}
                  </span>
                ))}
              </div>
            )}

            {visit.durationMinutes && (
              <span className="visit-duration">
                {formatDuration(visit.durationMinutes)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
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
  return '📍'
}

function formatType(type) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatDuration(minutes) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}
