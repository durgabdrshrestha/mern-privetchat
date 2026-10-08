import { io } from 'socket.io-client'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5015/api'
const SOCKET_URL = API_BASE_URL.replace(/\/api$/, '')

let socketInstance = null

export const getSocket = () => {
  const token = sessionStorage.getItem('privet_token')

  if (!token) {
    return null
  }

  if (socketInstance && socketInstance.auth?.token !== token) {
    socketInstance.disconnect()
    socketInstance = null
  }

  if (!socketInstance) {
    socketInstance = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      auth: { token },
    })

    socketInstance.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message)
    })
  }

  return socketInstance
}

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
  }
}
