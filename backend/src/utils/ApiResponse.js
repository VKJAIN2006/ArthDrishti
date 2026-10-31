/** Consistent JSON envelope: { success, message, data }. */
function sendSuccess(res, { statusCode = 200, message = 'OK', data = null } = {}) {
  return res.status(statusCode).json({ success: true, message, data });
}

module.exports = { sendSuccess };
