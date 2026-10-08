const express = require('express')
const path = require('path')
const cors = require('cors')
const cookieParser = require('cookie-parser')
const dotenv = require('dotenv')
const connectDB = require('./config/db')
const authRoutes = require('./routes/authRoutes')
const conversationRoutes = require('./routes/conversationRoutes')
const callRoutes = require('./routes/callRoutes')
const { isAllowedOrigin } = require('./utils/corsConfig')

dotenv.config()

const app = express()

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
app.use(express.json({ limit: '25mb' }))
app.use(express.urlencoded({ extended: true, limit: '25mb' }))
app.use(cookieParser())
connectDB()

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Privet Connect API',
    message: 'Backend ready for development',
  })
})

app.use('/uploads', express.static(path.join(__dirname, 'uploads')))
app.use('/api/auth', authRoutes)
app.use('/api/conversations', conversationRoutes)
app.use('/api/calls', callRoutes)

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : err.name === 'MulterError' ? 400 : 500
  res.status(status).json({ message: status === 413 ? 'File exceeds the 25 MB upload limit' : status === 400 ? err.message : 'Internal server error' })
})

module.exports = app
