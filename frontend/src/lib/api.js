import { supabase } from './supabase'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001'

export async function fetchWithAuth(endpoint, options = {}) {
  const { data: { session } } = await supabase.auth.getSession()

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  }

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`

  const response = await fetch(url, {
    ...options,
    headers
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

// Upload file with FormData (don't set Content-Type, browser does it for multipart)
export async function uploadFile(endpoint, formData) {
  const { data: { session } } = await supabase.auth.getSession()

  const headers = {}

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: formData
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }

  return response.json()
}

// Fetch binary data (images, etc.) with auth
export async function fetchBlobWithAuth(endpoint) {
  const { data: { session } } = await supabase.auth.getSession()

  const headers = {}

  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`
  }

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE}${endpoint}`

  const response = await fetch(url, { headers })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }

  return response.blob()
}

export { API_BASE }
