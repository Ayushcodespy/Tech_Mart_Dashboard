import crypto from 'crypto';
import fs from 'fs/promises';
import multer from 'multer';
import path from 'path';

import { settings } from './config.js';
import { AppError } from './errors.js';

const allowedExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const allowedContentTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const validatedExtension = (filename = 'image.jpg') => {
  const suffix = path.extname(filename).toLowerCase();
  return allowedExtensions.has(suffix) ? suffix : '.jpg';
};

export const validateImage = (file) => {
  if (!file) throw new AppError(400, 'Image file is required');
  const suffix = path.extname(file.originalname || '').toLowerCase();
  if (!allowedExtensions.has(suffix)) {
    throw new AppError(400, 'Unsupported image extension');
  }
  if (!allowedContentTypes.has(file.mimetype)) {
    throw new AppError(400, 'Unsupported image content type');
  }
  if (!file.buffer?.length) {
    throw new AppError(400, 'Empty image file');
  }
};

export const saveImage = async (file, folder) => {
  validateImage(file);
  const filename = `${crypto.randomUUID().replaceAll('-', '')}${validatedExtension(file.originalname)}`;
  const targetDir = path.join(settings.storageRoot, folder);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.writeFile(path.join(targetDir, filename), file.buffer);
  return `/storage/${folder}/${filename}`;
};

export const deleteStoredFile = async (publicPath) => {
  if (!publicPath) return;
  const cleaned = String(publicPath).replace(/^\/+/, '').replaceAll('\\', '/');
  if (!cleaned.startsWith('storage/')) return;

  const relative = cleaned.slice('storage/'.length);
  const target = path.resolve(settings.storageRoot, relative);
  const root = path.resolve(settings.storageRoot);
  if (!target.startsWith(root)) return;

  try {
    const stat = await fs.stat(target);
    if (stat.isFile()) await fs.unlink(target);
  } catch {
    // Missing files should not block DB updates.
  }
};
