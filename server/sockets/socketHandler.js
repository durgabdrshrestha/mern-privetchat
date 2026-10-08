const jwt = require('jsonwebtoken')
const { Server } = require('socket.io')
const Conversation = require('../models/Conversation')
const Message = require('../models/Message')
const User = require('../models/User')
const { isAllowedOrigin } = require('../utils/corsConfig')

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: (origin, callback) => {
        if (!origin || isAllowedOrigin(origin)) {
          callback(null, true)
          return
        }

        callback(new Error('Socket CORS blocked'))
      },
      credentials: true,
    },
  })

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '')

    if (!token) {
      return next(new Error('Authentication required'))
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key')
      socket.user = decoded
      next()
    } catch (error) {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    socket.join(String(socket.user.id))

    const isConversationParticipant = async (conversationId, userId) => {
      const conversation = await Conversation.findById(conversationId).select('participants')
      return conversation?.participants.some((participant) => participant.toString() === String(userId))
    }

    const isCallParticipant = async (conversationId, userId, otherUserId) => {
      const conversation = await Conversation.findById(conversationId).select('participants')
      const participantIds = conversation?.participants.map((participant) => participant.toString()) || []
      return participantIds.includes(String(userId)) && participantIds.includes(String(otherUserId))
    }

    socket.on('conversation:join', async (conversationId) => {
      if (!conversationId) return

      try {
        if (!(await isConversationParticipant(conversationId, socket.user.id))) return
        socket.join(String(conversationId))

        const pendingMessages = await Message.find({
          conversationId,
          senderId: { $ne: socket.user.id },
          deliveredAt: null,
        }).select('_id')

        const deliveredAt = new Date()
        await Message.updateMany(
          {
            conversationId,
            senderId: { $ne: socket.user.id },
            deliveredAt: null,
          },
          { $set: { deliveredAt, status: 'delivered' } },
        )

        if (pendingMessages.length) {
          io.to([
            String(conversationId),
            ...((await Conversation.findById(conversationId).select('participants')).participants.map((id) => id.toString())),
          ]).emit('message:delivered', {
            conversationId,
            deliveredTo: socket.user.id,
            messageIds: pendingMessages.map((message) => message._id),
            deliveredAt,
          })
        }
      } catch (error) {
        console.error('Conversation join error:', error)
      }
    })

    socket.on('typing:start', async ({ conversationId }) => {
      if (!conversationId) return
      if (!(await isConversationParticipant(conversationId, socket.user.id))) return
      socket.to(conversationId).emit('typing:start', {
        conversationId,
        userId: socket.user.id,
      })
    })

    socket.on('typing:stop', async ({ conversationId }) => {
      if (!conversationId) return
      if (!(await isConversationParticipant(conversationId, socket.user.id))) return
      socket.to(conversationId).emit('typing:stop', {
        conversationId,
        userId: socket.user.id,
      })
    })

    socket.on('call:offer', async ({ toUserId, conversationId, offer, type }) => {
      if (!toUserId || !conversationId || !offer || !['audio', 'video'].includes(type)) return

      try {
        if (!(await isCallParticipant(conversationId, socket.user.id, toUserId))) return
        const recipientSockets = await io.in(String(toUserId)).fetchSockets()
        if (!recipientSockets.length) {
          socket.emit('call:status', { conversationId, status: 'unavailable' })
          return
        }

        const caller = await User.findById(socket.user.id).select('name')
        io.to(String(toUserId)).emit('call:offer', {
          fromUserId: socket.user.id,
          fromUserName: caller?.name || 'A contact',
          conversationId,
          offer,
          type,
        })
        socket.emit('call:status', { conversationId, status: 'ringing' })
      } catch (error) {
        console.error('Call offer error:', error)
        socket.emit('call:status', { conversationId, status: 'unavailable' })
      }
    })

    socket.on('call:answer', async ({ toUserId, conversationId, answer }) => {
      if (!toUserId || !conversationId || !answer) return

      try {
        if (!(await isCallParticipant(conversationId, socket.user.id, toUserId))) return
        io.to(String(toUserId)).emit('call:answer', {
          fromUserId: socket.user.id,
          conversationId,
          answer,
        })
      } catch (error) {
        console.error('Call answer error:', error)
      }
    })

    socket.on('call:ice-candidate', async ({ toUserId, conversationId, candidate }) => {
      if (!toUserId || !conversationId || !candidate) return

      try {
        if (!(await isCallParticipant(conversationId, socket.user.id, toUserId))) return
        io.to(String(toUserId)).emit('call:ice-candidate', {
          fromUserId: socket.user.id,
          conversationId,
          candidate,
        })
      } catch (error) {
        console.error('Call candidate error:', error)
      }
    })

    socket.on('call:end', async ({ toUserId, conversationId }) => {
      if (!toUserId || !conversationId) return

      try {
        if (!(await isCallParticipant(conversationId, socket.user.id, toUserId))) return
        io.to(String(toUserId)).emit('call:end', {
          fromUserId: socket.user.id,
          conversationId,
        })
      } catch (error) {
        console.error('Call end error:', error)
      }
    })

    socket.on('message:read', async ({ conversationId }) => {
      if (!conversationId) return

      try {
        if (!(await isConversationParticipant(conversationId, socket.user.id))) return
        const viewer = await User.findById(socket.user.id).select('preferences.privacy.readReceipts')
        if (viewer?.preferences?.privacy?.readReceipts === false) return

        const updatedMessages = await Message.find({
          conversationId,
          senderId: { $ne: socket.user.id },
          readAt: null,
        }).select('_id')

        await Message.updateMany(
          {
            conversationId,
            senderId: { $ne: socket.user.id },
            readAt: null,
          },
          { $set: { readAt: new Date(), status: 'read' } },
        )

        io.to(conversationId).emit('message:read', {
          conversationId,
          readBy: socket.user.id,
          messageIds: updatedMessages.map((message) => message._id),
        })
      } catch (error) {
        console.error('Socket read receipt error:', error)
      }
    })
  })

  return io
}

module.exports = { initializeSocket }
