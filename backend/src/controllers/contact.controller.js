const Contact = require('../models/contact.model');
const ApiError = require('../utils/ApiError');
const { sendSuccess } = require('../utils/ApiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { isDbConnected } = require('../config/db');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** POST /api/contact */
const createContact = asyncHandler(async (req, res) => {
  const { name, email, subject, message } = req.body || {};
  const errors = [];
  if (!name || String(name).trim().length < 2) errors.push({ field: 'name', message: 'Please enter your name.' });
  if (!email || !EMAIL_RE.test(String(email))) errors.push({ field: 'email', message: 'Please enter a valid email address.' });
  if (!message || String(message).trim().length < 10) {
    errors.push({ field: 'message', message: 'Please write at least 10 characters.' });
  }
  if (errors.length) throw ApiError.badRequest('Please fix the highlighted fields.', errors);

  if (!isDbConnected()) {
    // Still acknowledge so the form UX works, but say persistence is unavailable.
    throw ApiError.serviceUnavailable(
      'Messaging is temporarily unavailable because the database is offline. Please email us directly.'
    );
  }

  await Contact.create({ name, email, subject, message });
  return sendSuccess(res, {
    statusCode: 201,
    message: 'Thanks! Your message has been received — we will get back to you shortly.',
    data: null,
  });
});

module.exports = { createContact };
