const DEFAULT_ALLOWED_ORIGINS = Array.from({ length: 20 }, (_, index) => {
  const port = 5173 + index
  return `http://localhost:${port}`
})

const getAllowedOrigins = () => {
  const configuredOrigins = (process.env.CLIENT_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  if (process.env.NODE_ENV === 'production') {
    return [...new Set(configuredOrigins)]
  }

  return [...new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins])]
}

const isAllowedOrigin = (origin) => {
  if (!origin) return true
  return getAllowedOrigins().includes(origin)
}

module.exports = {
  DEFAULT_ALLOWED_ORIGINS,
  getAllowedOrigins,
  isAllowedOrigin,
}
