const assert = require('node:assert/strict')
const { validateEnvironment } = require('../config/validateEnvironment')

const validProductionEnvironment = {
  NODE_ENV: 'production',
  PORT: '5000',
  MONGODB_URI: 'mongodb+srv://user:password@cluster.example/database',
  JWT_SECRET: 'a'.repeat(48),
  CLIENT_URL: 'https://chat.example.com',
  BACKEND_URL: 'https://api.example.com',
  CLOUDINARY_CLOUD_NAME: 'example-cloud',
  CLOUDINARY_API_KEY: '123456',
  CLOUDINARY_API_SECRET: 'example-secret',
  TURN_URLS: 'turn:turn.example.com:3478',
  TURN_SHARED_SECRET: 'turn-secret',
}

assert.doesNotThrow(() => validateEnvironment(validProductionEnvironment))
assert.doesNotThrow(() => validateEnvironment({ NODE_ENV: 'development' }))
assert.throws(() => validateEnvironment({ ...validProductionEnvironment, JWT_SECRET: 'short' }), /JWT_SECRET/)
assert.throws(() => validateEnvironment({ ...validProductionEnvironment, CLIENT_URL: 'http://chat.example.com' }), /CLIENT_URL/)
assert.throws(() => validateEnvironment({ ...validProductionEnvironment, CLOUDINARY_API_SECRET: '' }), /Cloudinary/)
assert.throws(() => validateEnvironment({ ...validProductionEnvironment, PORT: '70000' }), /PORT/)

console.log('productionConfig tests passed')