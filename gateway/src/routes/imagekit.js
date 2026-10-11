const express = require('express');
const router = express.Router();
const { httpAuthMiddleware } = require('../middleware/auth');
const { getUploadAuthParams } = require('../services/imagekit');

/**
 * GET /imagekit/auth - Generates signed upload params for browser direct upload
 */
router.get('/auth', httpAuthMiddleware, (req, res) => {
  const tenantId = req.user?.tenantId || 'CSE';
  const feature = req.query.feature || 'attachments';
  const params = getUploadAuthParams(tenantId, feature);
  res.json(params);
});

module.exports = router;
