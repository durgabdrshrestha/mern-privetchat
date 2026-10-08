const assert = require('node:assert/strict')
const { getAllowedOrigins, isAllowedOrigin } = require('../utils/corsConfig')

const originalEnvironment = {
	NODE_ENV: process.env.NODE_ENV,
	CLIENT_URL: process.env.CLIENT_URL,
}

process.env.NODE_ENV = 'development'
process.env.CLIENT_URL = ''
assert.equal(getAllowedOrigins().includes('http://localhost:5173'), true)
assert.equal(getAllowedOrigins().includes('http://localhost:5177'), true)
assert.equal(isAllowedOrigin('http://localhost:5177'), true)
assert.equal(isAllowedOrigin('https://example.com'), false)

process.env.NODE_ENV = 'production'
process.env.CLIENT_URL = 'https://chat.example.com'
assert.deepEqual(getAllowedOrigins(), ['https://chat.example.com'])
assert.equal(isAllowedOrigin('http://localhost:5177'), false)
assert.equal(isAllowedOrigin('https://chat.example.com'), true)

if (originalEnvironment.NODE_ENV === undefined) delete process.env.NODE_ENV
else process.env.NODE_ENV = originalEnvironment.NODE_ENV
if (originalEnvironment.CLIENT_URL === undefined) delete process.env.CLIENT_URL
else process.env.CLIENT_URL = originalEnvironment.CLIENT_URL

console.log('corsConfig test passed')
