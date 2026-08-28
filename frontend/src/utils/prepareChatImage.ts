const MAX_BYTES = 1 * 1024 * 1024;
const MAX_EDGE = 1280;
const ALLOWED = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp']);

export function isAllowedChatImageType(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  return ALLOWED.has(type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

/** Reduce dimensiones/calidad en el cliente antes de subir (máx. 1 MB). */
export async function prepareChatImage(file: File): Promise<File> {
  if (!isAllowedChatImageType(file)) {
    throw new Error('Formato no permitido. Use JPG, PNG o WEBP.');
  }
  if (file.size <= MAX_BYTES && file.size > 0) {
    // Si ya es pequeña, intentar comprimir; si falla, enviar original
    try {
      return await compressFile(file);
    } catch {
      return file;
    }
  }
  if (file.size > MAX_BYTES * 12) {
    throw new Error('La imagen supera el tamaño permitido.');
  }
  return compressFile(file);
}

async function compressFile(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      if (file.size <= MAX_BYTES) return file;
      throw new Error('No se pudo procesar la imagen');
    }
    ctx.drawImage(bitmap, 0, 0, w, h);

    const type = (file.type || '').toLowerCase();
    let mime: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg';
    if (type === 'image/png' && file.size <= MAX_BYTES) mime = 'image/png';
    else if (type === 'image/webp') mime = 'image/webp';

    let quality = 0.85;
    let blob: Blob | null = null;
    for (let i = 0; i < 8; i++) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(
          resolve,
          mime,
          mime === 'image/jpeg' || mime === 'image/webp' ? quality : undefined
        )
      );
      if (!blob) break;
      if (blob.size <= MAX_BYTES) break;
      if (mime === 'image/png') {
        mime = 'image/jpeg';
        quality = 0.85;
        continue;
      }
      quality -= 0.1;
      if (quality < 0.35) break;
    }

    if (!blob || blob.size > MAX_BYTES) {
      if (file.size <= MAX_BYTES) return file;
      throw new Error('La imagen supera el tamaño permitido.');
    }

    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '') || 'imagen';
    return new File([blob], `${base}.${ext}`, { type: mime });
  } finally {
    bitmap.close();
  }
}
