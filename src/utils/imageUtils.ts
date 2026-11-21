export interface CompressImageOptions {
  /** Maximum width/height in pixels (default: 96) */
  size?: number;
  /** If true, crops center square; if false, preserves aspect ratio inside size x size */
  squareCrop?: boolean;
  /** Compression quality 0..1 (default: 0.85) */
  quality?: number;
}

/**
 * Compresses an uploaded image File into a lightweight base64 Data URL
 * suitable for fast localStorage / IndexedDB persistence and JSON export.
 */
export function compressImageFile(
  file: File,
  opts: CompressImageOptions = {}
): Promise<string> {
  const { size = 96, squareCrop = false, quality = 0.85 } = opts;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire le fichier image.'));
    reader.onload = () => {
      const src = String(reader.result || '');
      const img = new Image();
      img.onerror = () => reject(new Error('Format image non pris en charge.'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(src);
          return;
        }

        if (squareCrop) {
          canvas.width = size;
          canvas.height = size;
          const minSide = Math.min(img.naturalWidth || size, img.naturalHeight || size);
          const sx = Math.max(0, ((img.naturalWidth || size) - minSide) / 2);
          const sy = Math.max(0, ((img.naturalHeight || size) - minSide) / 2);
          ctx.clearRect(0, 0, size, size);
          ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        } else {
          const w = img.naturalWidth || size;
          const h = img.naturalHeight || size;
          const scale = Math.min(1, size / Math.max(w, h));
          const targetW = Math.max(1, Math.round(w * scale));
          const targetH = Math.max(1, Math.round(h * scale));
          canvas.width = targetW;
          canvas.height = targetH;
          ctx.clearRect(0, 0, targetW, targetH);
          ctx.drawImage(img, 0, 0, targetW, targetH);
        }

        try {
          const webp = canvas.toDataURL('image/webp', quality);
          if (webp.startsWith('data:image/webp')) {
            resolve(webp);
            return;
          }
          resolve(canvas.toDataURL('image/png'));
        } catch {
          resolve(src);
        }
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export function getInitials(label: string, fallback = 'TM'): string {
  const clean = label.trim();
  if (!clean) return fallback;
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}
