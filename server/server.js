const http = require('http')
const app = require('./app')
const mongoose = require('mongoose')
const connectDB = require('./config/db')
const { validateEnvironment } = require('./config/validateEnvironment')
const { initializeSocket } = require('./sockets/socketHandler')

const listen = (server, initialPort) => new Promise((resolve, reject) => {
  const tryPort = (port) => {
    const onError = (error) => {
      server.removeListener('listening', onListening)
      if (error.code === 'EADDRINUSE' && process.env.NODE_ENV !== 'production') {
        console.warn(`Port ${port} is busy. Retrying on ${port + 1}...`)
        tryPort(port + 1)
        return
      }
      reject(error)
    }

    const onListening = () => {
      server.removeListener('error', onError)
      console.log(`Server listening on port ${port}`)
      resolve()
    }

    server.once('error', onError)
    server.once('listening', onListening)
    server.listen(port)
  }

  tryPort(initialPort)
})

const startServer = async () => {
  validateEnvironment()
  await connectDB()

  const server = http.createServer(app)
  const io = initializeSocket(server)
  app.set('io', io)
  await listen(server, Number(process.env.PORT) || 5015)

  const shutdown = () => {
    console.log('Closing server gracefully...')
    io.close(() => {
      mongoose.disconnect().then(() => process.exit(0)).catch(() => process.exit(1))
    })
    setTimeout(() => process.exit(1), 10000).unref()
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

startServer().catch((error) => {
  console.error('Server startup failed:', error.message)
  process.exit(1)
})
