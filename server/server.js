const http = require('http')
const app = require('./app')
const { initializeSocket } = require('./sockets/socketHandler')

const startServer = (port) => {
  const server = http.createServer(app)

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      const nextPort = port + 1
      console.warn(`Port ${port} is busy. Retrying on ${nextPort}...`)
      startServer(nextPort)
      return
    }

    throw error
  })

  const io = initializeSocket(server)
  app.set('io', io)

  server.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`)
  })
}

const PORT = Number(process.env.PORT) || 5015
startServer(PORT)
