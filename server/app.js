const dotenv = require('dotenv')
dotenv.config()

const express = require('express')
const path = require('path')
const cors = require('cors')
const helmet = require('helmet')
const cookieParser = require('cookie-parser')
const mongoose = require('mongoose')
const authRoutes = require('./routes/authRoutes')
const conversationRoutes = require('./routes/conversationRoutes')
const callRoutes = require('./routes/callRoutes')
const { isAllowedOrigin } = require('./utils/corsConfig')

const app = express()
const isProduction = process.env.NODE_ENV === 'production'

app.disable('x-powered-by')
if (isProduction) app.set('trust proxy', 1)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}))

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true)
        return
      }

      callback(new Error('CORS blocked for this origin'))
    },
    credentials: true,
  }),
)
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))
app.use(cookieParser())

app.get('/api/health', (req, res) => {
  const databaseReady = mongoose.connection.readyState === 1
  res.status(databaseReady || !isProduction ? 200 : 503).json({
    status: databaseReady ? 'ok' : isProduction ? 'unavailable' : 'degraded',
    app: 'Privet Connect API',
    database: databaseReady ? 'connected' : 'disconnected',
  })
})
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "PrivetChat API is running",
  });
});
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: isProduction ? '1d' : 0 }))
app.use('/api/auth', authRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/calls', callRoutes)

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err)
  console.error('Unhandled error:', err)
  const status = err.message === 'CORS blocked for this origin' ? 403 : err.code === 'LIMIT_FILE_SIZE' ? 413 : err.name === 'MulterError' ? 400 : 500
  const message = status === 413 ? 'File exceeds the 25 MB upload limit' : status === 400 ? err.message : status === 403 ? 'Origin is not allowed' : 'Internal server error'
  res.status(status).json({ message })
})

module.exports = app
