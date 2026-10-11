const express = require('express');
const router = express.Router();
const config = require('../config');

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'campusflow-ai-gateway',
    timestamp: new Date().toISOString(),
    aiServiceUrl: config.aiServiceUrl
  });
});

module.exports = router;
