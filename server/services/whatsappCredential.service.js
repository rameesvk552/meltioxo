const crypto = require('crypto');
const { AppError } = require('../middleware/errorHandler');

const encryptionKey = () => {
  const secret = process.env.WHATSAPP_CREDENTIAL_ENCRYPTION_KEY || process.env.JWT_SECRET;
  if (!secret) throw new AppError('WhatsApp credentials cannot be stored until WHATSAPP_CREDENTIAL_ENCRYPTION_KEY is configured.', 503);
  return crypto.createHash('sha256').update(secret).digest();
};

const encrypt = value => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${ciphertext.toString('base64url')}`;
};

const decrypt = value => {
  if (!value) return '';
  const [version, iv, authTag, ciphertext] = String(value).split('.');
  if (version !== 'v1' || !iv || !authTag || !ciphertext) throw new AppError('The saved WhatsApp credential is invalid. Save the API token again.', 503);
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('The saved WhatsApp credential could not be decrypted. Save the API token again.', 503);
  }
};

module.exports = { decrypt, encrypt };
