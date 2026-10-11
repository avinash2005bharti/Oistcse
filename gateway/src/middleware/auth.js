const jwt = require('jsonwebtoken');
const config = require('../config');

/**
 * Socket.IO Handshake Authentication Middleware (§6)
 * Validates JWT from socket.handshake.auth.token and attaches identity.
 */
const socketAuthMiddleware = (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace('Bearer ', '');

  if (!token) {
    return next(new Error('Authentication error: Missing token in socket handshake'));
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const userId = String(decoded.id || decoded.sub || decoded.userId || '');
    const role = String(decoded.role || 'STUDENT').toUpperCase();
    const permissions = Array.isArray(decoded.permissions) ? decoded.permissions : [];
    const tenantId = String(decoded.departmentId || decoded.tenantId || 'CSE');

    socket.user = {
      userId,
      role,
      permissions,
      tenantId,
      rawToken: token,
      email: decoded.email,
      name: decoded.name
    };
    next();
  } catch (err) {
    return next(new Error(`Authentication error: ${err.message}`));
  }
};

/**
 * Express HTTP JWT Verification Middleware
 */
const httpAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Missing Authorization Bearer header' });
  }

  const token = authHeader.split(' ')[1].trim();
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = {
      userId: String(decoded.id || decoded.sub || decoded.userId || ''),
      role: String(decoded.role || 'STUDENT').toUpperCase(),
      permissions: Array.isArray(decoded.permissions) ? decoded.permissions : [],
      tenantId: String(decoded.departmentId || decoded.tenantId || 'CSE'),
      rawToken: token
    };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: `Invalid token: ${err.message}` });
  }
};

module.exports = {
  socketAuthMiddleware,
  httpAuthMiddleware
};
