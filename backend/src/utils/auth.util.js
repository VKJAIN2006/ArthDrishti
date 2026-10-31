/**
 * Dependency-free auth helpers built on Node's crypto module:
 * scrypt password hashing + an HS256 JWT.
 */
const crypto = require('crypto');
const env = require('../config/env');

const SCRYPT_KEYLEN = 64;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyPassword(password, stored) {
  try {
    const [scheme, salt, hash] = String(stored).split('$');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const derived = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN);
    const expected = Buffer.from(hash, 'hex');
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function signToken(payload, expiresInSeconds = 60 * 60 * 24 * 7) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = { ...payload, iat: now, exp: now + expiresInSeconds };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(body))}`;
  const signature = base64url(
    crypto.createHmac('sha256', env.jwtSecret).update(unsigned).digest()
  );
  return `${unsigned}.${signature}`;
}

function verifyToken(token) {
  try {
    const [header, payload, signature] = String(token).split('.');
    if (!header || !payload || !signature) return null;
    const expected = base64url(
      crypto.createHmac('sha256', env.jwtSecret).update(`${header}.${payload}`).digest()
    );
    if (expected !== signature) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
