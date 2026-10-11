const { Server } = require('socket.io');
const { socketAuthMiddleware } = require('../middleware/auth');
const { registerAgentHandlers } = require('./agentHandlers');

function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  // Verify JWT on handshake
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const user = socket.user;
    const userRoom = `user:${user.userId}`;

    socket.join(userRoom);
    console.log(`[Socket.IO] User #${user.userId} (${user.role}) connected and joined ${userRoom}`);

    // Register agent event listeners
    registerAgentHandlers(io, socket);

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] User #${user.userId} disconnected`);
    });
  });

  return io;
}

module.exports = {
  initSocketServer
};
