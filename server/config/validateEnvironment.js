const isSecureOrigin = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && url.origin === value.replace(/\/$/, '')
  } catch {
    return false
  }
}

const validateEnvironment = (environment = process.env) => {
  if (environment.NODE_ENV !== 'production') return

  const errors = []
  const jwtSecret = environment.JWT_SECRET || ''
  const clientOrigins = (environment.CLIENT_URL || '').split(',').map((origin) => origin.trim()).filter(Boolean)
  const backendOrigin = environment.BACKEND_URL || environment.SERVER_URL || ''
  const cloudinaryValues = [
    environment.CLOUDINARY_CLOUD_NAME,
    environment.CLOUDINARY_API_KEY,
    environment.CLOUDINARY_API_SECRET,
  ]

  if (!environment.MONGODB_URI || /<|>|replace-with|your[-_]/i.test(environment.MONGODB_URI)) {
    errors.push('MONGODB_URI must contain production database credentials')
  }
  if (jwtSecret.length < 32 || /dev-secret-key|replace-with|example/i.test(jwtSecret)) {
    errors.push('JWT_SECRET must be a unique secret with at least 32 characters')
  }
  if (!clientOrigins.length || clientOrigins.some((origin) => !isSecureOrigin(origin))) {
    errors.push('CLIENT_URL must contain only exact HTTPS client origins')
  }
  if (!isSecureOrigin(backendOrigin)) {
    errors.push('BACKEND_URL or SERVER_URL must be an exact HTTPS origin')
  }
  if (cloudinaryValues.some((value) => !value)) {
    errors.push('Cloudinary credentials are required in production; local disk uploads are not durable')
  }
  if (!environment.PORT || !Number.isInteger(Number(environment.PORT)) || Number(environment.PORT) < 1 || Number(environment.PORT) > 65535) {
    errors.push('PORT must be provided as a valid TCP port')
  }

  if (errors.length) {
    throw new Error(`Invalid production configuration:\n- ${errors.join('\n- ')}`)
  }

  if (!environment.TURN_URLS || !environment.TURN_SHARED_SECRET) {
    console.warn('TURN is not configured; calls may fail on restrictive networks.')
  }
}

module.exports = { validateEnvironment }