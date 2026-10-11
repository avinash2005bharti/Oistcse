const crypto = require('crypto');
const ImageKit = require('imagekit');
const config = require('../config');

let ikInstance = null;

const getImageKit = () => {
  if (!ikInstance && config.imagekit.publicKey && config.imagekit.privateKey) {
    ikInstance = new ImageKit({
      publicKey: config.imagekit.publicKey,
      privateKey: config.imagekit.privateKey,
      urlEndpoint: config.imagekit.urlEndpoint
    });
  }
  return ikInstance;
};

/**
 * Generates signed client-side authentication parameters for ImageKit upload (§5).
 */
const getUploadAuthParams = (tenantId = 'CSE', feature = 'general') => {
  const ik = getImageKit();
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const suggestedFolder = `/erp/${tenantId}/${feature}/${yyyy}/${mm}/`;

  if (ik) {
    const authParams = ik.getAuthenticationParameters();
    return {
      ...authParams,
      publicKey: config.imagekit.publicKey,
      urlEndpoint: config.imagekit.urlEndpoint,
      folder: suggestedFolder
    };
  }

  // Fallback HMAC calculation if SDK instance is not initialized
  const token = crypto.randomUUID();
  const expire = Math.floor(Date.now() / 1000) + 1800; // 30 min
  const privateKey = config.imagekit.privateKey || 'dev_key';
  const signature = crypto
    .createHmac('sha1', privateKey)
    .update(token + expire)
    .digest('hex');

  return {
    token,
    expire,
    signature,
    publicKey: config.imagekit.publicKey,
    urlEndpoint: config.imagekit.urlEndpoint,
    folder: suggestedFolder
  };
};

module.exports = {
  getImageKit,
  getUploadAuthParams
};
