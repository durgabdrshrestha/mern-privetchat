const express = require('express')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const User = require('../models/User')
const authMiddleware = require('../middleware/authMiddleware')
const { getCloudinary, uploadToCloudinary, deleteFromCloudinary } = require('../services/cloudinaryService')

const router = express.Router()
const profilePhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new Error('Profile photo must be an image'))
      return
    }
    callback(null, true)
  },
})

const createToken = (user) => jwt.sign(
  { id: user._id, email: user.email },
  process.env.JWT_SECRET || 'dev-secret-key',
  { expiresIn: '7d' },
)

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-passwordHash')

    if (!user) {
      return res.status(404).json({ message: 'User not found' })
    }

    return res.json({
      ok: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        username: user.username,
        profilePhoto: user.profilePhoto,
        bio: user.bio,
        status: user.status,
        isOnline: user.isOnline,
        preferences: user.preferences,
      },
    })
  } catch (error) {
    return res.status(500).json({ message: 'Could not load current user' })
  }
})

router.patch('/profile', authMiddleware, async (req, res) => {
  const { name, username, bio, status } = req.body
  const allowedStatuses = ['Online', 'Offline', 'Away', 'Busy', 'Invisible']

  if (typeof name !== 'string' || !name.trim() || typeof username !== 'string' || !username.trim()) {
    return res.status(400).json({ message: 'Name and username are required' })
  }

  const normalizedUsername = username.trim().toLowerCase()
  if (!/^[a-z0-9_.]{3,24}$/.test(normalizedUsername)) {
    return res.status(400).json({ message: 'Username must be 3-24 characters using letters, numbers, dots, or underscores' })
  }

  if (typeof bio !== 'string' || bio.length > 280) {
    return res.status(400).json({ message: 'Bio must be 280 characters or fewer' })
  }

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ message: 'Choose a valid availability status' })
  }

  try {
    const duplicateUsername = await User.findOne({ username: normalizedUsername, _id: { $ne: req.user.id } })
    if (duplicateUsername) {
      return res.status(409).json({ message: 'Username already taken' })
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { name: name.trim(), username: normalizedUsername, bio: bio.trim(), status } },
      { new: true, runValidators: true },
    ).select('-passwordHash -profilePhotoPublicId')

    if (!user) return res.status(404).json({ message: 'User not found' })
    return res.json({ ok: true, user })
  } catch (error) {
    return res.status(500).json({ message: 'Could not update profile' })
  }
})

router.post('/profile/photo', authMiddleware, (req, res, next) => profilePhotoUpload.single('file')(req, res, next), async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'Choose an image to upload' })

  try {
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    const previousPhotoId = user.profilePhotoPublicId
    const uploaded = await uploadToCloudinary(req.file, `${req.protocol}://${req.get('host')}`)
    user.profilePhoto = uploaded.secure_url
    user.profilePhotoPublicId = uploaded.public_id
    await user.save()

    if (previousPhotoId) {
      deleteFromCloudinary(previousPhotoId).catch((error) => {
        console.error('Could not remove previous profile photo:', error.message)
      })
    }

    return res.json({ ok: true, profilePhoto: user.profilePhoto, storageProvider: uploaded.storage_provider })
  } catch (error) {
    console.error('Profile photo upload failed:', error.message)
    return res.status(502).json({ message: 'Could not upload profile photo' })
  }
})

router.patch('/preferences', authMiddleware, async (req, res) => {
  const { notifications = {}, privacy = {} } = req.body
  const updates = {}

  for (const key of ['messages', 'calls']) {
    if (typeof notifications[key] === 'boolean') updates[`preferences.notifications.${key}`] = notifications[key]
  }

  for (const key of ['showOnlineStatus', 'readReceipts']) {
    if (typeof privacy[key] === 'boolean') updates[`preferences.privacy.${key}`] = privacy[key]
  }

  if (!Object.keys(updates).length) {
    return res.status(400).json({ message: 'No valid preferences provided' })
  }

  try {
    const user = await User.findByIdAndUpdate(req.user.id, { $set: updates }, { new: true, runValidators: true })
      .select('preferences')
    if (!user) return res.status(404).json({ message: 'User not found' })
    return res.json({ ok: true, preferences: user.preferences })
  } catch (error) {
    return res.status(500).json({ message: 'Could not save preferences' })
  }
})

router.patch('/password', authMiddleware, async (req, res) => {
  const { currentPassword, newPassword } = req.body
  if (!currentPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
    return res.status(400).json({ message: 'Enter your current password and a new password with at least 8 characters' })
  }

  try {
    const user = await User.findById(req.user.id)
    if (!user) return res.status(404).json({ message: 'User not found' })

    const currentPasswordMatches = await bcrypt.compare(currentPassword, user.passwordHash)
    if (!currentPasswordMatches) return res.status(400).json({ message: 'Current password is incorrect' })

    user.passwordHash = await bcrypt.hash(newPassword, 12)
    await user.save()
    return res.json({ ok: true, message: 'Password updated' })
  } catch (error) {
    return res.status(500).json({ message: 'Could not update password' })
  }
})

router.post('/register', async (req, res) => {
  const { name, username, email, password } = req.body

  if (!name || !username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' })
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' })
  }

  const trimmedName = name.trim()
  const trimmedUsername = username.trim().toLowerCase()
  const trimmedEmail = email.trim().toLowerCase()

  if (!trimmedName || !trimmedUsername || !trimmedEmail) {
    return res.status(400).json({ message: 'All fields must contain valid values' })
  }

  const existingEmail = await User.findOne({ email: trimmedEmail })
  if (existingEmail) {
    return res.status(409).json({ message: 'Email already registered' })
  }

  const existingUsername = await User.findOne({ username: trimmedUsername })
  if (existingUsername) {
    return res.status(409).json({ message: 'Username already taken' })
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await User.create({
      name: trimmedName,
      username: trimmedUsername,
      email: trimmedEmail,
      passwordHash,
      status: 'Online',
      isOnline: true,
    })

    const token = createToken(user)

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        profilePhoto: user.profilePhoto,
        bio: user.bio,
        status: user.status,
        preferences: user.preferences,
      },
    })
  } catch (error) {
    return res.status(500).json({ message: 'Could not create user' })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' })
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() })
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' })
    }

    const token = createToken(user)

    return res.json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        profilePhoto: user.profilePhoto,
        bio: user.bio,
        status: user.status,
        preferences: user.preferences,
      },
    })
  } catch (error) {
    return res.status(500).json({ message: 'Login failed' })
  }
})

module.exports = router
