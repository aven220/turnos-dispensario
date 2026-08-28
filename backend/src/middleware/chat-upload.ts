import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Archivos de chat (volumen uploads). No servir por static público. */
export const CHAT_UPLOADS_DIR = path.join(__dirname, '../../uploads/chat');

if (!fs.existsSync(CHAT_UPLOADS_DIR)) {
  fs.mkdirSync(CHAT_UPLOADS_DIR, { recursive: true });
}

export const CHAT_IMAGE_MAX_BYTES = 1 * 1024 * 1024;

const ALLOWED_CHAT_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export const uploadChatImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHAT_IMAGE_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_CHAT_IMAGE_MIMES.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Formato no permitido. Use JPG, PNG o WEBP.'));
  },
});

export function chatImageExt(mime: string): string {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  return '.jpg';
}

export function absoluteChatImagePath(relativePath: string): string {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const full = path.join(CHAT_UPLOADS_DIR, normalized);
  if (!full.startsWith(CHAT_UPLOADS_DIR)) {
    throw new Error('Ruta de imagen no válida');
  }
  return full;
}

export function ensureParticipantChatDir(participantId: string): string {
  const dir = path.join(CHAT_UPLOADS_DIR, participantId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
