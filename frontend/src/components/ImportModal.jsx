import { useState, useRef } from 'react'
import { uploadFile } from '../lib/api'

export default function ImportModal({ onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [dragActive, setDragActive] = useState(false)
  const [status, setStatus] = useState('idle') // idle, uploading, success, error
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const droppedFile = e.dataTransfer?.files?.[0]
    if (droppedFile && droppedFile.name.endsWith('.json')) {
      setFile(droppedFile)
      setError(null)
    } else {
      setError('Please select a JSON file')
    }
  }

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setStatus('uploading')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await uploadFile('/api/import', formData)

      setResult(response)
      setStatus('success')
    } catch (err) {
      setError(err.message || 'Import failed')
      setStatus('error')
    }
  }

  const handleRetry = () => {
    setStatus('idle')
    setError(null)
    setResult(null)
  }

  const handleDone = () => {
    if (onSuccess) {
      onSuccess(result)
    }
    onClose()
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="import-overlay" onClick={onClose}>
      <div className="import-modal" onClick={e => e.stopPropagation()}>
        <div className="import-header">
          <h2>Import Your Location History</h2>
          <button className="import-close-btn" onClick={onClose}>&times;</button>
        </div>

        {status === 'idle' && (
          <>
            <div className="import-instructions">
              <p>Upload your Google Takeout location history file:</p>
              <ol>
                <li>Go to <a href="https://takeout.google.com" target="_blank" rel="noopener noreferrer">Google Takeout</a></li>
                <li>Select only &quot;Location History&quot;</li>
                <li>Export and download the ZIP file</li>
                <li>Extract and find <code>Records.json</code></li>
              </ol>
            </div>

            <div
              className={`import-dropzone ${dragActive ? 'drag-active' : ''} ${file ? 'has-file' : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />

              {file ? (
                <div className="file-selected">
                  <span className="file-icon">&#128196;</span>
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">{formatFileSize(file.size)}</span>
                </div>
              ) : (
                <div className="dropzone-content">
                  <span className="upload-icon">&#128229;</span>
                  <p>Drag and drop your Records.json file here</p>
                  <p className="or-text">or click to browse</p>
                </div>
              )}
            </div>

            {error && <p className="import-error">{error}</p>}

            <div className="import-actions">
              <button className="import-cancel-btn" onClick={onClose}>
                Cancel
              </button>
              <button
                className="import-upload-btn"
                onClick={handleUpload}
                disabled={!file}
              >
                Import Data
              </button>
            </div>
          </>
        )}

        {status === 'uploading' && (
          <div className="import-progress">
            <div className="spinner"></div>
            <p>Importing your location history...</p>
            <p className="progress-hint">This may take a moment for large files.</p>
          </div>
        )}

        {status === 'success' && result && (
          <div className="import-success">
            <span className="success-icon">&#10003;</span>
            <h3>Import Complete!</h3>
            <div className="import-summary">
              {result.locationsImported !== undefined && (
                <p><strong>{result.locationsImported.toLocaleString()}</strong> locations imported</p>
              )}
              {result.visitsImported !== undefined && (
                <p><strong>{result.visitsImported.toLocaleString()}</strong> visits created</p>
              )}
              {result.placesCreated !== undefined && (
                <p><strong>{result.placesCreated.toLocaleString()}</strong> unique places found</p>
              )}
            </div>
            <button className="import-done-btn" onClick={handleDone}>
              View Your Journal
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="import-error-state">
            <span className="error-icon">&#10007;</span>
            <h3>Import Failed</h3>
            <p className="error-message">{error}</p>
            <div className="import-actions">
              <button className="import-cancel-btn" onClick={onClose}>
                Cancel
              </button>
              <button className="import-retry-btn" onClick={handleRetry}>
                Try Again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
