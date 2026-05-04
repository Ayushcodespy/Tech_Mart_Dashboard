import app, { prepareApp } from '../src/app.js';

export default async function handler(req, res) {
  await prepareApp();
  return app(req, res);
}
