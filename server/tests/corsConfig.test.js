const assert = require('node:assert/strict')
const { getAllowedOrigins, isAllowedOrigin } = require('../utils/corsConfig')

assert.equal(getAllowedOrigins().includes('http://localhost:5173'), true)
assert.equal(getAllowedOrigins().includes('http://localhost:5177'), true)
assert.equal(isAllowedOrigin('http://localhost:5177'), true)
assert.equal(isAllowedOrigin('https://example.com'), false)

console.log('corsConfig test passed')
