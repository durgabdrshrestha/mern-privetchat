const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

const storage = () => window.sessionStorage

export const getAuthToken = () => storage().getItem('privet_token')

export const setAuthToken = (token) => {
  if (token) {
    storage().setItem('privet_token', token)
    return
  }

  storage().removeItem('privet_token')
}

export const getCurrentUser = () => {
  try {
    return JSON.parse(storage().getItem('privet_user') || 'null')
  } catch {
    return null
  }
}

export const getCurrentUserId = () => storage().getItem('privet_user_id') || getCurrentUser()?.id || null

export const isAuthenticated = () => Boolean(getAuthToken())

export const setCurrentUser = (user) => {
  if (user) {
    storage().setItem('privet_user', JSON.stringify(user))
    if (user.id) storage().setItem('privet_user_id', String(user.id))
  } else {
    storage().removeItem('privet_user')
    storage().removeItem('privet_user_id')
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('privet:user-updated', { detail: user || null }))
  }
}

export const logout = () => {
  setAuthToken(null)
  setCurrentUser(null)
}

export const apiFetch = async (endpoint, { method = 'GET', body, headers = {}, isFormData = false } = {}) => {
  const token = getAuthToken()

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  })

  const text = await response.text()
  const data = text ? JSON.parse(text) : {}

  if (!response.ok) {
    throw new Error(data.message || 'Request failed')
  }

  return data
}
