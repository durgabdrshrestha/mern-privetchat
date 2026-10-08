const mongoose = require('mongoose')

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI

  if (!mongoUri) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('MONGODB_URI is required in production')
    }
    console.warn('⚠️  MONGODB_URI is not set. Database connection skipped for now.')
    return false
  }

  try {
    const conn = await mongoose.connect(mongoUri)
    console.log(`✅ MongoDB connected: ${conn.connection.host}`)
    return true
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message)
    throw error
  }
}

module.exports = connectDB
