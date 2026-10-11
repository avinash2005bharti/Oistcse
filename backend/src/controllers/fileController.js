// ============================================================================
// File Controller — Universal File Intelligence Pipeline
// Handles upload → ImageKit → metadata → processing trigger → status + history
// ============================================================================

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FileDocument = require('../models/mongo/FileDocument');
const imageKitService = require('../services/imageKitService');
const { logger } = require('../services/loggerService');

const PYTHON_AI_SERVICE_URL = process.env.AI_SERVICE_URL || process.env.PYTHON_AI_SERVICE_URL || 'http://localhost:8000';

/**
 * Derive normalized file type from extension
 */
function getFileType(filename) {
  const ext = path.extname(filename || '').toLowerCase().replace('.', '');
  const typeMap = {
    png: 'png', jpg: 'jpg', jpeg: 'jpeg', webp: 'webp',
    pdf: 'pdf',
    xlsx: 'xlsx', xls: 'xls', csv: 'csv',
    pptx: 'pptx', ppt: 'ppt',
    docx: 'docx', doc: 'doc',
    txt: 'txt'
  };
  return typeMap[ext] || 'other';
}

/**
 * POST /api/files/upload
 * Authenticated file upload → ImageKit → metadata → trigger processing
 */
exports.uploadFile = async (req, res) => {
  let tempFilePath = null;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided.' });
    }

    const userId = req.user ? String(req.user.id) : null;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    tempFilePath = req.file.path;
    const originalName = req.file.originalname;
    const mimeType = req.file.mimetype;
    const fileSize = req.file.size;
    const fileType = getFileType(originalName);
    const conversationId = req.body.conversationId || req.body.conversation_id || null;
    const departmentId = req.user.departmentId || null;

    // 1. Upload to ImageKit Cloud
    let storageUrl = null;
    let imagekitFileId = null;
    let storageProvider = 'local';

    if (imageKitService.isConfigured()) {
      const folder = `/campusflow-erp/uploads/${userId}`;
      const tags = ['user_upload', fileType, userId];
      const ikResult = await imageKitService.uploadFromPath(
        tempFilePath,
        originalName,
        folder,
        tags
      );

      if (ikResult && ikResult.url) {
        storageUrl = ikResult.url;
        imagekitFileId = ikResult.fileId;
        storageProvider = 'imagekit';
        logger.info(`[FileController] Uploaded to ImageKit: ${storageUrl}`);
      }
    }

    // Fallback URL if ImageKit fails
    if (!storageUrl) {
      storageUrl = `/uploads/${req.file.filename}`;
      storageProvider = 'local';
    }

    // 2. Create file metadata in MongoDB
    const fileDoc = await FileDocument.create({
      userId,
      conversationId,
      filename: originalName,
      originalName,
      mimeType,
      fileType,
      fileSize,
      source: 'user_upload',
      storageProvider,
      storageUrl,
      imagekitFileId,
      processingStatus: 'pending',
      departmentId,
      visibility: 'private'
    });

    // 3. Trigger async processing via FastAPI
    const backendHost = process.env.BACKEND_URL || (process.env.NODE_ENV === 'production' ? 'https://oistcse-server.onrender.com' : 'http://localhost:5000');
    const absoluteFileUrl = storageUrl.startsWith('http') ? storageUrl : `${backendHost}${storageUrl}`;

    try {
      const payload = {
        file_id: String(fileDoc._id),
        file_url: absoluteFileUrl,
        filename: originalName,
        mime_type: mimeType,
        file_type: fileType,
        user_id: userId,
        conversation_id: conversationId,
        department_id: departmentId,
        department_code: req.user.departmentCode || '',
        role: req.user.role,
        user: req.user
      };

      // Accelerate processing with direct local path if file exists on disk
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        payload.local_path = path.resolve(tempFilePath);
      }

      axios.post(`${PYTHON_AI_SERVICE_URL}/ai/files/process`, payload, {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.INTERNAL_API_SECRET || ''
        }
      }).catch(err => {
        logger.warn(`[FileController] Async processing trigger warning: ${err.message}`);
      });
    } catch (triggerErr) {
      logger.warn(`[FileController] Processing trigger error: ${triggerErr.message}`);
    }

    return res.status(201).json({
      success: true,
      message: 'File uploaded successfully. Processing started.',
      file: {
        id: fileDoc._id,
        filename: originalName,
        fileType,
        mimeType,
        fileSize,
        storageUrl,
        storageProvider,
        processingStatus: 'pending',
        createdAt: fileDoc.createdAt
      }
    });
  } catch (error) {
    logger.error(`[FileController] Upload error: ${error.message}`);
    // Clean up temp file on error
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { fs.unlinkSync(tempFilePath); } catch (_) {}
    }
    return res.status(500).json({ success: false, message: 'File upload failed.', error: error.message });
  }
};

/**
 * GET /api/files
 * Get user's file history (paginated)
 */
exports.getFiles = async (req, res) => {
  try {
    const userId = req.user ? String(req.user.id) : null;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;
    const source = req.query.source; // 'user_upload' or 'agent_generated'
    const conversationId = req.query.conversationId;

    const filter = { userId, isDeleted: false };
    if (source) filter.source = source;
    if (conversationId) filter.conversationId = conversationId;

    const [files, total] = await Promise.all([
      FileDocument.find(filter)
        .select('-__v')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FileDocument.countDocuments(filter)
    ]);

    return res.status(200).json({
      success: true,
      files,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) }
    });
  } catch (error) {
    logger.error(`[FileController] getFiles error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/files/:id
 * Get single file metadata
 */
exports.getFileById = async (req, res) => {
  try {
    const userId = req.user ? String(req.user.id) : null;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const file = await FileDocument.findOne({
      _id: req.params.id,
      isDeleted: false
    }).lean();

    if (!file) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }

    // Ownership check (admin can access all)
    const userRole = (req.user.role || '').toUpperCase();
    if (String(file.userId) !== userId && userRole !== 'ADMIN' && userRole !== 'HOD') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    return res.status(200).json({ success: true, file });
  } catch (error) {
    logger.error(`[FileController] getFileById error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/files/:id/status
 * Get file processing status
 */
exports.getFileStatus = async (req, res) => {
  try {
    const file = await FileDocument.findById(req.params.id)
      .select('processingStatus processingError processingStage extractedContent filename')
      .lean();

    if (!file) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }

    return res.status(200).json({
      success: true,
      fileId: req.params.id,
      filename: file.filename,
      processingStatus: file.processingStatus,
      processingStage: file.processingStage,
      processingError: file.processingError,
      extractedContent: file.extractedContent || null
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PATCH /api/files/:id/status
 * Update processing status (called by FastAPI service)
 */
exports.updateFileStatus = async (req, res) => {
  try {
    const { processingStatus, processingError, processingStage, extractedContent } = req.body;

    const update = {};
    if (processingStatus) update.processingStatus = processingStatus;
    if (processingError !== undefined) update.processingError = processingError;
    if (processingStage) update.processingStage = processingStage;
    if (extractedContent) update.extractedContent = extractedContent;

    const file = await FileDocument.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    ).lean();

    if (!file) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }

    return res.status(200).json({ success: true, file });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/files/:id
 * Soft-delete a file (marks as deleted, optionally removes from ImageKit)
 */
exports.deleteFile = async (req, res) => {
  try {
    const userId = req.user ? String(req.user.id) : null;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    const file = await FileDocument.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ success: false, message: 'File not found.' });
    }

    // Ownership check
    const userRole = (req.user.role || '').toUpperCase();
    if (String(file.userId) !== userId && userRole !== 'ADMIN') {
      return res.status(403).json({ success: false, message: 'Access denied.' });
    }

    // Soft delete
    file.isDeleted = true;
    await file.save();

    // Optionally remove from ImageKit
    if (file.imagekitFileId && imageKitService.isConfigured()) {
      imageKitService.deleteFile(file.imagekitFileId).catch(err => {
        logger.warn(`[FileController] ImageKit delete warning: ${err.message}`);
      });
    }

    return res.status(200).json({ success: true, message: 'File deleted successfully.' });
  } catch (error) {
    logger.error(`[FileController] deleteFile error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/files/agent-upload
 * Internal endpoint for agent-generated files (called by AI service)
 */
exports.agentUploadFile = async (req, res) => {
  try {
    const {
      user_id, conversation_id, filename, mime_type, file_type,
      storage_url, imagekit_file_id, generated_by_agent,
      file_size, department_id, extracted_content
    } = req.body;

    if (!user_id || !filename || !storage_url) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const fileDoc = await FileDocument.create({
      userId: user_id,
      conversationId: conversation_id,
      filename,
      originalName: filename,
      mimeType: mime_type || 'application/octet-stream',
      fileType: file_type || getFileType(filename),
      fileSize: file_size || 0,
      source: 'agent_generated',
      storageProvider: 'imagekit',
      storageUrl: storage_url,
      imagekitFileId: imagekit_file_id,
      processingStatus: 'completed',
      generatedByAgent: generated_by_agent,
      departmentId: department_id,
      visibility: 'private',
      extractedContent: extracted_content || null
    });

    return res.status(201).json({
      success: true,
      file: {
        id: fileDoc._id,
        filename,
        storageUrl: storage_url,
        fileType: fileDoc.fileType,
        source: 'agent_generated'
      }
    });
  } catch (error) {
    logger.error(`[FileController] agentUploadFile error: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};
