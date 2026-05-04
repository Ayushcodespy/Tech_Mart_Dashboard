import cors from 'cors';
import express from 'express';
import fs from 'fs/promises';

import { adminWebHtml } from './adminWeb.js';
import { settings } from './config.js';
import { initDatabase } from './db.js';
import { errorHandler, notFoundHandler } from './errors.js';
import apiRouter from './routes/index.js';

const app = express();

const loopbackHosts = new Set(['localhost', '127.0.0.1', '::1']);

const parseOrigin = (origin) => {
  try {
    return new URL(origin);
  } catch {
    return null;
  }
};

const isLoopbackOrigin = (origin) => {
  const parsed = parseOrigin(origin);
  return parsed ? loopbackHosts.has(parsed.hostname) : false;
};

const isAllowedOrigin = (origin) => {
  if (!origin || settings.corsOrigins.includes('*') || settings.corsOrigins.includes(origin)) {
    return true;
  }

  if (isLoopbackOrigin(origin) && settings.corsOrigins.some((value) => isLoopbackOrigin(value))) {
    return true;
  }

  return false;
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400, // 24 hours - cache preflight response
};

app.disable('x-powered-by');
app.use(cors(corsOptions));
// Handle OPTIONS requests explicitly
app.options('*', cors(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/storage', express.static(settings.storageRoot));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/admin', (_req, res) => res.type('html').send(adminWebHtml(settings.storeName)));
app.use(settings.apiV1Prefix, apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);

let setupPromise;

export const prepareApp = () => {
  setupPromise ??= (async () => {
    await fs.mkdir(settings.storageRoot, { recursive: true });
    await initDatabase();
  })();
  return setupPromise;
};

export default app;
