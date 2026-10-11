const http = require('http');
const express = require('express');
const cors = require('cors');

const config = require('./config');
const healthRoutes = require('./routes/health');
const imagekitRoutes = require('./routes/imagekit');
const { initSocketServer } = require('./socket');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/health', healthRoutes);
app.use('/imagekit', imagekitRoutes);

// Root
app.get('/', (req, res) => {
  res.json({
    service: 'CampusFlow AI Agent Gateway',
    status: 'online',
    version: '2.0.0'
  });
});

const server = http.createServer(app);

// Initialize Socket.IO with JWT verification
const io = initSocketServer(server);

if (require.main === module) {
  server.listen(config.port, () => {
    console.log(`[Gateway] Node.js AI Gateway running on port ${config.port}`);
    console.log(`[Gateway] Connected to AI Service at: ${config.aiServiceUrl}`);
  });
}

module.exports = { app, server, io };
