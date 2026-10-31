const path = require('path');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const apiRoutes = require('./routes');
const errorHandler = require('./middleware/error.middleware');
const ApiError = require('./utils/ApiError');

const app = express();

// Behind a proxy (Render, Railway, nginx) the client IP / protocol come from headers.
app.set('trust proxy', 1);

// --- Security + parsing middleware -----------------------------------------
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(null, true); // allow same-origin / file previews in dev
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Tiny request logger (dev only)
if (!env.isProduction) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`[api] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
  });
}

// --- API --------------------------------------------------------------------
app.use('/api', apiRoutes);

// --- Static frontend --------------------------------------------------------
const frontendDir = path.join(__dirname, '..', '..', 'frontend');
app.use(express.static(frontendDir, { extensions: ['html'], maxAge: env.isProduction ? '1d' : 0 }));

// Unknown API route -> JSON 404
app.use('/api', (req, res, next) => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
});

// Any other route -> custom 404 page
app.use((req, res) => {
  res.status(404).sendFile(path.join(frontendDir, '404.html'), (err) => {
    if (err) res.status(404).type('text').send('404 — Page not found');
  });
});

// --- Error handler (must be last) ------------------------------------------
app.use(errorHandler);

module.exports = app;
