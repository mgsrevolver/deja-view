import VisitCard from './VisitCard'

export default function Sidebar({ dayData, isLoading, selectedVisit, onVisitClick }) {
  if (isLoading) {
    return (
      <div className="sidebar">
        <div className="sidebar-loading">Loading...</div>
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

  const { visits, distanceByType, totalDistance, weather, spotifyTracks } = dayData

  return (
    <div className="sidebar">
      {/* Day Summary */}
      <section className="day-summary">
        <h2>Day Summary</h2>

        {/* Distance Card */}
        <div className="summary-card distance-card">
          <div className="distance-header">
            <h3>Distance Traveled</h3>
            <span className="distance-total">{formatDistance(totalDistance)}</span>
          </div>

          <div className="distance-breakdown">
            {distanceByType.walking > 0 && (
              <div className="distance-row">
                <div className="distance-row-left">
                  <span className="distance-indicator walking"></span>
                  <span className="distance-emoji">🚶</span>
                  <span className="distance-label">Walking</span>
                </div>
                <div className="distance-row-right">
                  <span className="distance-value">{formatDistance(distanceByType.walking)}</span>
                </div>
                <div
                  className="distance-bar walking"
                  style={{ width: `${(distanceByType.walking / totalDistance) * 100}%` }}
                />
              </div>
            )}
            {distanceByType.cycling > 0 && (
              <div className="distance-row">
                <div className="distance-row-left">
                  <span className="distance-indicator cycling"></span>
                  <span className="distance-emoji">🚴</span>
                  <span className="distance-label">Cycling</span>
                </div>
                <div className="distance-row-right">
                  <span className="distance-value">{formatDistance(distanceByType.cycling)}</span>
                </div>
                <div
                  className="distance-bar cycling"
                  style={{ width: `${(distanceByType.cycling / totalDistance) * 100}%` }}
                />
              </div>
            )}
            {(distanceByType.in_vehicle > 0 || distanceByType.driving > 0) && (
              <div className="distance-row">
                <div className="distance-row-left">
                  <span className="distance-indicator driving"></span>
                  <span className="distance-emoji">🚗</span>
                  <span className="distance-label">Driving</span>
                </div>
                <div className="distance-row-right">
                  <span className="distance-value">{formatDistance(distanceByType.in_vehicle || distanceByType.driving)}</span>
                </div>
                <div
                  className="distance-bar driving"
                  style={{ width: `${((distanceByType.in_vehicle || distanceByType.driving) / totalDistance) * 100}%` }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Weather Card (placeholder) */}
        <div className="summary-card weather-card">
          <h3>Weather</h3>
          {weather ? (
            <div className="weather-data">
              <span className="temp">{weather.tempMax}° / {weather.tempMin}°</span>
              <span className="condition">{weather.condition}</span>
            </div>
          ) : (
            <div className="placeholder">Weather data not yet enriched</div>
          )}
        </div>

        {/* Music Card (placeholder) */}
        <div className="summary-card music-card">
          <h3>Music</h3>
          {spotifyTracks && spotifyTracks.length > 0 ? (
            <div className="music-data">
              {spotifyTracks.slice(0, 3).map((track, i) => (
                <div key={i} className="track">
                  <span className="track-name">{track.name}</span>
                  <span className="track-artist">{track.artist}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="placeholder">Spotify data not yet connected</div>
          )}
        </div>

        {/* Photos Card (placeholder) */}
        <div className="summary-card photos-card">
          <h3>Photos</h3>
          <div className="placeholder">Photo integration coming soon</div>
        </div>
      </section>

      {/* Timeline */}
      <section className="timeline">
        <h2>Timeline</h2>
        <div className="visits-list">
          {visits.length === 0 ? (
            <div className="no-visits">No visits recorded for this day</div>
          ) : (
            visits.map((visit, idx) => (
              <VisitCard
                key={visit.id || idx}
                visit={visit}
                isSelected={selectedVisit?.id === visit.id}
                onClick={() => onVisitClick(selectedVisit?.id === visit.id ? null : visit)}
              />
            ))
          )}
        </div>
      </section>
    </div>
  )
}

function formatDistance(meters) {
  if (!meters || meters === 0) return '0 mi'
  const miles = meters / 1609.34
  if (miles < 0.1) {
    const feet = meters * 3.28084
    return `${Math.round(feet)} ft`
  }
  return `${miles.toFixed(1)} mi`
}
