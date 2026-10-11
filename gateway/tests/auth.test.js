const test = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const { socketAuthMiddleware } = require('../src/middleware/auth');

test('Socket handshake succeeds with valid JWT', (t, done) => {
  const token = jwt.sign(
    { id: 'user_123', role: 'STUDENT', permissions: ['ATTENDANCE_READ_SELF'] },
    config.jwtSecret,
    { expiresIn: '1h' }
  );

  const socketMock = {
    handshake: {
      auth: { token }
    }
  };

  socketAuthMiddleware(socketMock, (err) => {
    assert.strictEqual(err, undefined);
    assert.strictEqual(socketMock.user.userId, 'user_123');
    assert.strictEqual(socketMock.user.role, 'STUDENT');
    assert.deepStrictEqual(socketMock.user.permissions, ['ATTENDANCE_READ_SELF']);
    done();
  });
});

test('Socket handshake is rejected with invalid JWT', (t, done) => {
  const socketMock = {
    handshake: {
      auth: { token: 'invalid_malformed_token' }
    }
  };

  socketAuthMiddleware(socketMock, (err) => {
    assert.ok(err instanceof Error);
    assert.match(err.message, /Authentication error/);
    done();
  });
});

test('Socket handshake is rejected without token', (t, done) => {
  const socketMock = {
    handshake: {
      auth: {}
    }
  };

  socketAuthMiddleware(socketMock, (err) => {
    assert.ok(err instanceof Error);
    assert.match(err.message, /Missing token/);
    done();
  });
});
