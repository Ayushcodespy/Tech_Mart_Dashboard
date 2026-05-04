import app, { prepareApp } from './app.js';
import { settings } from './config.js';
import { pool } from './db.js';

const start = async () => {
  await prepareApp();
  const server = app.listen(settings.port, settings.host, () => {
    console.log(`${settings.appName} listening on http://${settings.host}:${settings.port}`);
  });

  const shutdown = async () => {
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

start().catch(async (error) => {
  console.error('Failed to start API server:', error);
  await pool.end();
  process.exit(1);
});
