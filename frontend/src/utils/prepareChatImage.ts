const MAX_BYTES = 1 * 1024 * 1024;
const MAX_EDGE = 1280;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function isAllowedChatImageType(file: File): boolean {
  return ALLOWED.has(file.type) || /\.(jpe?g|png|webp)$/i.test(file.name);
}

/** Reduce dimensiones/calidad en el cliente antes de subir (máx. 1 MB). */
export async function prepareChatImage(file: File): Promise<File> {
  if (!isAllowedChatImageType(file)) {
    throw new Error('Formato no permitido. Use JPG, PNG o WEBP.');
  }
  if (file.size > MAX_BYTES * 4) {
    // Demasiado grande incluso para intentar comprimir en canvas de forma razonable
    throw new Error('La imagen supera el tamaño permitido.');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo procesar la imagen');
    ctx.drawImage(bitmap, 0, 0, w, h);

    const preferJpeg = file.type !== 'image/png';
    let mime: 'image/jpeg' | 'image/png' | 'image/webp' = 'image/jpeg';
    if (!preferJpeg) mime = 'image/png';
    else if (file.type === 'image/webp') mime = 'image/webp';

    let quality = 0.85;
    let blob: Blob | null = null;
    for (let i = 0; i < 6; i++) {
      blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mime, mime === 'image/jpeg' || mime === 'image/webp' ? quality : undefined)
      );
      if (!blob) break;
      if (blob.size <= MAX_BYTES) break;
      quality -= 0.12;
      if (quality < 0.4) break;
    }

    if (!blob || blob.size > MAX_BYTES) {
      throw new Error('La imagen supera el tamaño permitido.');
    }

    const ext = mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg';
    const base = file.name.replace(/\.[^.]+$/, '') || 'imagen';
    return new File([blob], `${base}.${ext}`, { type: mime });
  } finally {
    bitmap.close();
  }
}
