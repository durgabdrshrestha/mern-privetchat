const crypto = require('crypto')
const express = require('express')
const authMiddleware = require('../middleware/authMiddleware')

const router = express.Router()

router.get('/ice-servers', authMiddleware, (req, res) => {
  const iceServers = [{ urls: 'stun:stun.l.google.com:19302' }]
  const turnUrls = (process.env.TURN_URLS || '').split(',').map((url) => url.trim()).filter(Boolean)
  const sharedSecret = process.env.TURN_SHARED_SECRET

  if (turnUrls.length && sharedSecret) {
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60
    const username = `${expiresAt}:${req.user.id}`
    const credential = crypto.createHmac('sha1', sharedSecret).update(username).digest('base64')
    iceServers.push({ urls: turnUrls, username, credential })
  }

  return res.json({ iceServers })
})

module.exports = router
