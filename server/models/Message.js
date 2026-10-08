const mongoose = require('mongoose')

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'audio', 'document', 'file', 'system'],
      default: 'text',
    },
    text: {
      type: String,
      default: '',
    },
    attachment: {
      filename: String,
      mimeType: String,
      size: Number,
      storageUrl: String,
      storageProvider: String,
      publicId: String,
      resourceType: String,
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    deliveredAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    status: {
      type: String,
      enum: ['sending', 'sent', 'delivered', 'read'],
      default: 'sent',
    },
  },
  { timestamps: true },
)

module.exports = mongoose.model('Message', messageSchema)
