import { useState, useMemo } from 'react'
import { format, parseISO } from 'date-fns'
import { fetchWithAuth } from '../lib/api'

export default function ShareModal({ dayData, date, onClose }) {
  // Filter to only places with photos
  const placesWithPhotos = useMemo(() => {
    if (!dayData?.visits) return []
    return dayData.visits.filter(v => v.place?.imageUrl)
  }, [dayData])

  // State - use visit.placeID (foreign key) not visit.place.id
  const [selectedPlaceIds, setSelectedPlaceIds] = useState(() =>
    placesWithPhotos.map(v => v.placeID)
  )
  const [showTimes, setShowTimes] = useState(false)
  const [showDurations, setShowDurations] = useState(true)
  const [showPlaceNames, setShowPlaceNames] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedImageUrl, setGeneratedImageUrl] = useState(null)
  const [error, setError] = useState(null)

  // Derived state
  const selectedPlaces = placesWithPhotos.filter(v => selectedPlaceIds.includes(v.placeID))
  const canGenerate = selectedPlaces.length > 0

  // Handlers
  const togglePlace = (placeId) => {
    setSelectedPlaceIds(prev =>
      prev.includes(placeId)
        ? prev.filter(id => id !== placeId)
        : [...prev, placeId]
    )
  }

  const selectAll = () => setSelectedPlaceIds(placesWithPhotos.map(v => v.placeID))
  const deselectAll = () => setSelectedPlaceIds([])

  const handleGenerate = async () => {
    if (!canGenerate) return

    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetchWithAuth('/api/share/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          placeIds: selectedPlaceIds,
          options: {
            showTimes,
            showDurations,
            showPlaceNames
          }
        })
      })

      setGeneratedImageUrl(response.imageUrl)
    } catch (err) {
      setError(err.message || 'Failed to generate image')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleDownload = () => {
    if (!generatedImageUrl) return

    const link = document.createElement('a')
    link.href = generatedImageUrl
    link.download = `deja-view-${date}.png`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleBack = () => {
    setGeneratedImageUrl(null)
    setError(null)
  }

  // Format date for display
  const formattedDate = format(parseISO(date), 'EEEE, MMMM d, yyyy')

  // Format duration helper
  const formatDuration = (minutes) => {
    if (!minutes) return ''
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
  }

  // If no places with photos, show message
  if (placesWithPhotos.length === 0) {
    return (
      <div className="share-overlay" onClick={onClose}>
        <div className="share-modal" onClick={e => e.stopPropagation()}>
          <div className="share-header">
            <h2>Share Your Day</h2>
            <button className="share-close-btn" onClick={onClose}>×</button>
          </div>
          <div className="share-empty">
            <span className="share-empty-icon">📷</span>
            <p>No places with photos to share</p>
            <p className="share-empty-hint">Visit places with Google photos to create shareable images</p>
          </div>
        </div>
      </div>
    )
  }

  // Generated image view
  if (generatedImageUrl) {
    return (
      <div className="share-overlay" onClick={onClose}>
        <div className="share-modal share-modal-generated" onClick={e => e.stopPropagation()}>
          <div className="share-header">
            <h2>Your Day Image</h2>
            <button className="share-close-btn" onClick={onClose}>×</button>
          </div>

          <div className="share-generated-preview">
            <img src={generatedImageUrl} alt={`${formattedDate} summary`} />
          </div>

          <div className="share-generated-actions">
            <button className="share-back-btn" onClick={handleBack}>
              ← Generate Another
            </button>
            <button className="share-download-btn" onClick={handleDownload}>
              Download Image
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="share-overlay" onClick={onClose}>
      <div className="share-modal" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="share-header">
          <h2>Share Your Day</h2>
          <button className="share-close-btn" onClick={onClose}>×</button>
        </div>

        {/* Preview Area */}
        <div className="share-preview">
          <div className="polaroid-stack">
            {selectedPlaces.slice(0, 4).map((visit, idx) => (
              <div
                key={visit.placeID}
                className="polaroid-preview"
                style={{
                  '--rotation': `${(idx % 2 === 0 ? -1 : 1) * (3 + idx * 2)}deg`,
                  '--offset-x': `${idx * 15}px`,
                  '--z-index': idx
                }}
              >
                <div className="polaroid-photo">
                  <img src={visit.place.imageUrl} alt="" />
                </div>
                <div className="polaroid-label">
                  {showPlaceNames && (
                    <span className="polaroid-name">{visit.place.name || 'Unknown'}</span>
                  )}
                  {showDurations && visit.durationMinutes && (
                    <span className="polaroid-duration">{formatDuration(visit.durationMinutes)}</span>
                  )}
                  {showTimes && (
                    <span className="polaroid-time">{format(parseISO(visit.startTime), 'h:mm a')}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="preview-date">{formattedDate}</div>
          <div className="preview-brand">Deja View</div>
        </div>

        {/* Place Selection */}
        <div className="share-section">
          <div className="share-section-header">
            <span>Select Places</span>
            <div className="share-select-actions">
              <button onClick={selectAll}>All</button>
              <span>/</span>
              <button onClick={deselectAll}>None</button>
            </div>
          </div>

          <div className="share-place-list">
            {placesWithPhotos.map(visit => (
              <label key={visit.placeID} className="share-place-item">
                <input
                  type="checkbox"
                  checked={selectedPlaceIds.includes(visit.placeID)}
                  onChange={() => togglePlace(visit.placeID)}
                />
                <div className="share-place-thumb">
                  <img src={visit.place.imageUrl} alt="" />
                </div>
                <div className="share-place-info">
                  <span className="share-place-name">{visit.place.name || 'Unknown Place'}</span>
                  <span className="share-place-duration">
                    {formatDuration(visit.durationMinutes)}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Display Options */}
        <div className="share-section">
          <div className="share-section-header">
            <span>Display Options</span>
          </div>

          <div className="share-toggles">
            <label className="share-toggle">
              <span>Show visit times</span>
              <input
                type="checkbox"
                checked={showTimes}
                onChange={e => setShowTimes(e.target.checked)}
              />
              <span className="toggle-switch"></span>
            </label>

            <label className="share-toggle">
              <span>Show durations</span>
              <input
                type="checkbox"
                checked={showDurations}
                onChange={e => setShowDurations(e.target.checked)}
              />
              <span className="toggle-switch"></span>
            </label>

            <label className="share-toggle">
              <span>Show place names</span>
              <input
                type="checkbox"
                checked={showPlaceNames}
                onChange={e => setShowPlaceNames(e.target.checked)}
              />
              <span className="toggle-switch"></span>
            </label>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="share-error">{error}</div>
        )}

        {/* Actions */}
        <div className="share-actions">
          <button className="share-cancel-btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="share-generate-btn"
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate Image'}
          </button>
        </div>
      </div>
    </div>
  )
}
