const mongoose = require('mongoose')

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI

  if (!mongoUri) {
    console.warn('⚠️  MONGODB_URI is not set. Database connection skipped for now.')
    return
  }

  try {
    const conn = await mongoose.connect(mongoUri)
    console.log(`✅ MongoDB connected: ${conn.connection.host}`)
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message)
    process.exit(1)
  }
}

module.exports = connectDB
