const mongoose = require('mongoose')

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    profilePhoto: { type: String, default: '' },
    profilePhotoPublicId: { type: String, default: '' },
    archivedConversationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' }],
    hiddenConversationIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Conversation' }],
    bio: { type: String, default: '' },
    status: { type: String, enum: ['Online', 'Offline', 'Away', 'Busy', 'Invisible'], default: 'Offline' },
    preferences: {
      notifications: {
        messages: { type: Boolean, default: true },
        calls: { type: Boolean, default: true },
      },
      privacy: {
        showOnlineStatus: { type: Boolean, default: true },
        readReceipts: { type: Boolean, default: true },
      },
    },
    isOnline: { type: Boolean, default: false },
    lastSeen: { type: Date, default: Date.now },
  },
  { timestamps: true },
)

module.exports = mongoose.model('User', userSchema)
