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

const ALLOWED_CHAT_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'application/octet-stream',
]);

export const uploadChatImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: CHAT_IMAGE_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const mime = (file.mimetype || '').toLowerCase();
    const nameOk = /\.(jpe?g|png|webp)$/i.test(file.originalname || '');
    if (ALLOWED_CHAT_IMAGE_MIMES.has(mime) || nameOk) {
      cb(null, true);
      return;
    }
    cb(new Error('Formato no permitido. Use JPG, PNG o WEBP.'));
  },
});

export function sniffChatImageMime(buffer: Buffer, declared?: string): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  const d = (declared || '').toLowerCase();
  if (d === 'image/jpeg' || d === 'image/jpg') return 'image/jpeg';
  if (d === 'image/png') return 'image/png';
  if (d === 'image/webp') return 'image/webp';
  return null;
}

export function chatImageExt(mime: string): string {
  if (mime === 'image/png') return '.png';
  if (mime === 'image/webp') return '.webp';
  return '.jpg';
}

/** Ruta relativa estable con / (evita backslash de Windows). */
export function chatImageRelativePath(participantId: string, filename: string): string {
  return `${participantId}/${filename}`;
}

export function absoluteChatImagePath(relativePath: string): string {
  const parts = relativePath
    .replace(/\\/g, '/')
    .split('/')
    .filter((p) => p && p !== '.' && p !== '..');
  const root = path.resolve(CHAT_UPLOADS_DIR);
  const resolved = path.resolve(path.join(CHAT_UPLOADS_DIR, ...parts));
  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('Ruta de imagen no válida');
  }
  return resolved;
}

export function ensureParticipantChatDir(participantId: string): string {
  const dir = path.join(CHAT_UPLOADS_DIR, participantId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
