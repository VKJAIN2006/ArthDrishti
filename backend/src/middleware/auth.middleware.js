const ApiError = require('../utils/ApiError');
const { verifyToken } = require('../utils/auth.util');

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  if (req.cookies && req.cookies.token) return req.cookies.token;
  return null;
}

function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return next(ApiError.unauthorized());
  const payload = verifyToken(token);
  if (!payload) return next(ApiError.unauthorized('Your session has expired. Please sign in again.'));
  req.user = payload;
  return next();
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) return next(ApiError.forbidden());
    return next();
  };
}

module.exports = { requireAuth, requireRole };
