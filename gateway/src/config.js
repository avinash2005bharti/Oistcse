const path = require('path');
const dotenv = require('dotenv');

// Load .env from gateway, root, or backend
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../backend/.env') });

module.exports = {
  port: process.env.GATEWAY_PORT || 5001,
  aiServiceUrl: process.env.AI_SERVICE_URL || process.env.FASTAPI_URL || 'http://localhost:8000',
  aiServiceKey: process.env.AI_SERVICE_KEY || process.env.INTERNAL_API_SECRET || 'dev_internal_microservice_secret_key_123',
  jwtSecret: process.env.JWT_SECRET || '6LP4FBmCAQIy9KCbpbaTwLIGZC55bMeNiBFB2rW9GtMwLSgIbwJipqbw77i',
  imagekit: {
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY || '',
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY || '',
    urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/avi2005/'
  }
};
