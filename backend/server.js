/**
 * ArthDrishti backend entry point.
 *   Express API  ->  proxies the Python ML service
 *   Static       ->  serves the multi-page frontend
 */
const env = require('./src/config/env');
const { connectDB } = require('./src/config/db');
const app = require('./src/app');

async function startServer() {
  await connectDB();

  const server = app.listen(env.port, () => {
    console.log('');
    console.log('  ArthDrishti API is running');
    console.log(`  Local:   http://localhost:${env.port}`);
    console.log(`  API:     http://localhost:${env.port}/api/health`);
    console.log(`  ML svc:  ${env.mlServiceUrl}`);
    console.log('');
  });

  const shutdown = (signal) => {
    console.log(`\n${signal} received — shutting down gracefully.`);
    server.close(() => process.exit(0));
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer();
