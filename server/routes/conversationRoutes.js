const express = require('express')
const multer = require('multer')
const authMiddleware = require('../middleware/authMiddleware')
const User = require('../models/User')
const Conversation = require('../models/Conversation')
const Message = require('../models/Message')
const { getCloudinary, uploadToCloudinary } = require('../services/cloudinaryService')

const router = express.Router()
const mongoose = require('mongoose')
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
})

router.post('/:conversationId/upload', authMiddleware, async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId).select('participants')
    const isParticipant = conversation?.participants.some((participant) => participant.toString() === req.user.id)

    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' })
    }

    if (!isParticipant) {
      return res.status(403).json({ message: 'You are not a member of this conversation' })
    }

    return upload.single('file')(req, res, (error) => {
      if (error) return next(error)
      return next()
    })
  } catch (error) {
    return res.status(500).json({ message: 'Could not verify conversation access' })
  }
}, async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' })
  }

  try {
    const result = await uploadToCloudinary(req.file, `${req.protocol}://${req.get('host')}`)

    return res.status(201).json({
      ok: true,
      file: {
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        storageUrl: result.secure_url,
        storageProvider: result.storage_provider,
        publicId: result.public_id,
        resourceType: result.resource_type,
      },
    })
  } catch (error) {
    console.error('Cloudinary upload failed:', error.message)
    return res.status(502).json({ message: 'Cloudinary could not store this file' })
  }
})

router.get('/users/search', authMiddleware, async (req, res) => {
  const query = (req.query.query || '').trim()

  try {
    const account = await User.findById(req.user.id).select('hiddenConversationIds')
    const hiddenDirectChats = await Conversation.find({
      _id: { $in: account?.hiddenConversationIds || [] },
      type: 'direct',
    }).select('participants')
    const hiddenUserIds = hiddenDirectChats
      .flatMap((conversation) => conversation.participants.map(String))
      .filter((userId) => userId !== String(req.user.id))
    const baseFilter = {
      _id: { $ne: req.user.id, ...(!query ? { $nin: hiddenUserIds } : {}) },
    }

    const queryFilter = query
      ? {
          $or: [
            { name: { $regex: query, $options: 'i' } },
            { username: { $regex: query, $options: 'i' } },
            { email: { $regex: query, $options: 'i' } },
          ],
        }
      : {}

    const users = await User.find({
      ...baseFilter,
      ...queryFilter,
    })
      .select('_id name username email profilePhoto status isOnline lastSeen preferences.privacy.showOnlineStatus')
      .sort({ isOnline: -1, name: 1 })
      .limit(30)

    return res.json(users.map((user) => {
      const result = user.toObject()
      if (result.preferences?.privacy?.showOnlineStatus === false) {
        result.isOnline = false
        result.status = 'Offline'
      }
      return result
    }))
  } catch (error) {
    return res.status(500).json({ message: 'Could not search users' })
  }
})

router.get('/', authMiddleware, async (req, res) => {
  try {
    const account = await User.findById(req.user.id).select('archivedConversationIds hiddenConversationIds')
    const archivedIds = account?.archivedConversationIds || []
    const hiddenIds = account?.hiddenConversationIds || []
    const archivedView = req.query.view === 'archived'
    const conversationFilter = archivedView
      ? { $in: archivedIds }
      : { $nin: [...archivedIds, ...hiddenIds] }
    const conversations = await Conversation.find({
      participants: req.user.id,
      _id: conversationFilter,
    })
      .populate('participants', '_id name username email profilePhoto status isOnline preferences.privacy.showOnlineStatus')
      .populate({
        path: 'lastMessage',
        populate: { path: 'senderId', select: '_id name username' },
      })
      .sort({ updatedAt: -1 })

    return res.json(conversations)
  } catch (error) {
    return res.status(500).json({ message: 'Could not load conversations' })
  }
})

router.post('/', authMiddleware, async (req, res) => {
  const { receiverId } = req.body

  if (!receiverId) {
    return res.status(400).json({ message: 'Receiver is required' })
  }

  try {
    const receiver = await User.findById(receiverId)
    if (!receiver) {
      return res.status(404).json({ message: 'User not found' })
    }

    if (receiver._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'You cannot chat with yourself' })
    }

    const existing = await Conversation.findOne({
      type: 'direct',
      participants: { $all: [req.user.id, receiverId], $size: 2 },
    })

    if (existing) {
      await User.updateOne(
        { _id: req.user.id },
        { $pull: { archivedConversationIds: existing._id, hiddenConversationIds: existing._id } },
      )
      return res.status(200).json(existing)
    }

    const conversation = await Conversation.create({
      type: 'direct',
      participants: [req.user.id, receiverId],
      createdBy: req.user.id,
    })

    return res.status(201).json(conversation)
  } catch (error) {
    return res.status(500).json({ message: 'Could not create conversation' })
  }
})

router.patch('/:conversationId/archive', authMiddleware, async (req, res) => {
  if (typeof req.body.archived !== 'boolean') {
    return res.status(400).json({ message: 'Archived must be true or false' })
  }

  try {
    const conversation = await Conversation.findById(req.params.conversationId).select('participants')
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' })
    if (!conversation.participants.some((participant) => participant.toString() === req.user.id)) {
      return res.status(403).json({ message: 'You are not a member of this conversation' })
    }

    const update = req.body.archived
      ? { $addToSet: { archivedConversationIds: conversation._id }, $pull: { hiddenConversationIds: conversation._id } }
      : { $pull: { archivedConversationIds: conversation._id } }
    await User.updateOne({ _id: req.user.id }, update)
    return res.json({ ok: true, archived: req.body.archived })
  } catch (error) {
    return res.status(500).json({ message: 'Could not update archived chats' })
  }
})

router.delete('/:conversationId', authMiddleware, async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.conversationId).select('participants')
    if (!conversation) return res.status(404).json({ message: 'Conversation not found' })
    if (!conversation.participants.some((participant) => participant.toString() === req.user.id)) {
      return res.status(403).json({ message: 'You are not a member of this conversation' })
    }

    await User.updateOne(
      { _id: req.user.id },
      { $addToSet: { hiddenConversationIds: conversation._id }, $pull: { archivedConversationIds: conversation._id } },
    )
    return res.json({ ok: true, hidden: true })
  } catch (error) {
    return res.status(500).json({ message: 'Could not remove chat from your list' })
  }
})

router.post('/groups', authMiddleware, async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : ''
  const requestedIds = Array.isArray(req.body.participantIds) ? req.body.participantIds.map(String) : []
  const participantIds = [...new Set(requestedIds)]

  if (name.length < 2 || name.length > 60) {
    return res.status(400).json({ message: 'Group name must be between 2 and 60 characters' })
  }

  if (participantIds.length < 2 || participantIds.some((id) => !mongoose.Types.ObjectId.isValid(id))) {
    return res.status(400).json({ message: 'Choose at least two valid group members' })
  }

  try {
    const members = await User.find({ _id: { $in: participantIds } }).select('_id')
    if (members.length !== participantIds.length) {
      return res.status(400).json({ message: 'One or more selected users could not be found' })
    }

    const conversation = await Conversation.create({
      type: 'group',
      name,
      participants: [req.user.id, ...participantIds],
      createdBy: req.user.id,
    })

    const populatedConversation = await Conversation.findById(conversation._id)
      .populate('participants', '_id name username email profilePhoto status isOnline preferences.privacy.showOnlineStatus')

    return res.status(201).json(populatedConversation)
  } catch (error) {
    return res.status(500).json({ message: 'Could not create group conversation' })
  }
})

router.get('/:conversationId/messages', authMiddleware, async (req, res) => {
  const { conversationId } = req.params

  try {
    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' })
    }

    const isParticipant = conversation.participants.some((participant) => participant.toString() === req.user.id)
    if (!isParticipant) {
      return res.status(403).json({ message: 'You are not a member of this conversation' })
    }

    const messages = await Message.find({ conversationId })
      .populate('senderId', '_id name username profilePhoto')
      .populate('replyTo')
      .sort({ createdAt: 1 })

    return res.json(messages)
  } catch (error) {
    return res.status(500).json({ message: 'Could not load messages' })
  }
})

router.post('/:conversationId/messages/read', authMiddleware, async (req, res) => {
  const { conversationId } = req.params

  try {
    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' })
    }

    const isParticipant = conversation.participants.some((participant) => participant.toString() === req.user.id)
    if (!isParticipant) {
      return res.status(403).json({ message: 'You are not a member of this conversation' })
    }

    const viewer = await User.findById(req.user.id).select('preferences.privacy.readReceipts')
    if (viewer?.preferences?.privacy?.readReceipts === false) {
      return res.json({ ok: true, modifiedCount: 0, disabled: true })
    }

    const unreadMessages = await Message.find({
      conversationId,
      senderId: { $ne: req.user.id },
      readAt: null,
    }).select('_id')

    const readAt = new Date()
    await Message.updateMany(
      {
        conversationId,
        senderId: { $ne: req.user.id },
        readAt: null,
      },
      { $set: { readAt, status: 'read' } },
    )

    const messageIds = unreadMessages.map((message) => message._id)
    const roomIds = [String(conversationId), ...conversation.participants.map((participant) => participant.toString())]
    req.app.get('io')?.to(roomIds).emit('message:read', {
      conversationId,
      readBy: req.user.id,
      messageIds,
      readAt,
    })

    return res.json({ ok: true, modifiedCount: messageIds.length })
  } catch (error) {
    return res.status(500).json({ message: 'Could not mark messages read' })
  }
})

router.post('/:conversationId/messages', authMiddleware, async (req, res) => {
  const { conversationId } = req.params
  const { text = '', type = 'text', attachment = null } = req.body

  try {
    const conversation = await Conversation.findById(conversationId)
    if (!conversation) {
      return res.status(404).json({ message: 'Conversation not found' })
    }

    const isParticipant = conversation.participants.some((participant) => participant.toString() === req.user.id)
    if (!isParticipant) {
      return res.status(403).json({ message: 'You are not a member of this conversation' })
    }

    if (!text && (!attachment || !attachment.storageUrl)) {
      return res.status(400).json({ message: 'Message content is required' })
    }

    const message = await Message.create({
      conversationId,
      senderId: req.user.id,
      type,
      text,
      attachment,
      status: 'sent',
    })

    conversation.lastMessage = message._id
    await conversation.save()

    const populatedMessage = await Message.findById(message._id).populate('senderId', '_id name username profilePhoto')
    const roomIds = [String(conversationId), ...conversation.participants.map((participant) => participant.toString())]
    req.app.get('io')?.to(roomIds).emit('message:new', populatedMessage)

    return res.status(201).json(populatedMessage)
  } catch (error) {
    return res.status(500).json({ message: 'Could not send message' })
  }
})

module.exports = router
