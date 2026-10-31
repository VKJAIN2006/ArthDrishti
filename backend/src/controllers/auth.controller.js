const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { signToken } = require('../utils/auth.util');
const { isDbConnected } = require('../config/db');
const env = require('../config/env');

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isProduction,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

function assertDb() {
  if (!isDbConnected()) {
    throw ApiError.serviceUnavailable(
      'Database is not connected. Start MongoDB and run `npm run seed`, then try again.'
    );
  }
}

const register = asyncHandler(async (req, res) => {
  assertDb();
  const { name, email, password, role } = req.body || {};
  if (!name || !email || !password) {
    throw ApiError.badRequest('Name, email and password are required.');
  }
  if (String(password).length < 6) {
    throw ApiError.badRequest('Password must be at least 6 characters long.');
  }

  const existing = await User.findOne({ email: String(email).toLowerCase() });
  if (existing) throw ApiError.conflict('An account with that email already exists.');

  const user = await User.create({
    name,
    email,
    password,
    role: role === 'admin' ? 'admin' : 'manager',
  });
  const token = signToken({ id: user._id, email: user.email, role: user.role, name: user.name });
  res.cookie('token', token, COOKIE_OPTIONS);

  return sendSuccess(res, {
    statusCode: 201,
    message: 'Account created successfully. Welcome aboard!',
    data: { token, user: user.toSafeJSON() },
  });
});

const login = asyncHandler(async (req, res) => {
  assertDb();
  const { email, password } = req.body || {};
  if (!email || !password) throw ApiError.badRequest('Email and password are required.');

  const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
  if (!user || !user.comparePassword(password)) {
    throw new ApiError(401, 'Invalid email or password.');
  }

  const token = signToken({ id: user._id, email: user.email, role: user.role, name: user.name });
  res.cookie('token', token, COOKIE_OPTIONS);

  return sendSuccess(res, {
    message: `Welcome back, ${user.name.split(' ')[0]}!`,
    data: { token, user: user.toSafeJSON() },
  });
});

const logout = asyncHandler(async (req, res) => {
  res.clearCookie('token', { ...COOKIE_OPTIONS, maxAge: undefined });
  return sendSuccess(res, { message: 'You have been signed out.' });
});

const me = asyncHandler(async (req, res) => {
  assertDb();
  const user = await User.findById(req.user.id);
  if (!user) throw ApiError.unauthorized();
  return sendSuccess(res, { data: { user: user.toSafeJSON() } });
});

module.exports = { register, login, logout, me };
