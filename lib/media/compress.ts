/**
 * Client-side image compression. CLAUDE.md rule 4: compress photos on upload.
 *
 * A modern phone camera produces 4-8 MB JPEGs. On a basement LTE signal that
 * is the difference between a 30-second finding and a 3-minute one, so we
 * always resize and re-encode before the bytes ever leave the phone.
 */

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
  /** Original byte count, for logging how much we saved. */
  originalBytes: number;
}

export interface CompressOptions {
  /** Longest edge, in pixels. 1600 is plenty for a report photo. */
  maxEdge?: number;
  /** JPEG quality, 0-1. */
  quality?: number;
}

export async function compressImage(
  file: File,
  { maxEdge = 1600, quality = 0.72 }: CompressOptions = {},
): Promise<CompressedImage> {
  const originalBytes = file.size;
  const bitmap = await loadBitmap(file);

  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    // Canvas unavailable — send the original rather than losing the photo.
    return { blob: file, width: bitmap.width, height: bitmap.height, originalBytes };
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  if ('close' in bitmap && typeof bitmap.close === 'function') bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', quality),
  );

  return {
    blob: blob ?? file,
    width,
    height,
    originalBytes,
  };
}

async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      // Honours EXIF orientation, which matters for photos shot sideways.
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Fall through to the <img> path (older Safari, HEIC edge cases).
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    img.src = url;
  });
}

/** Human-readable size, for the "saved 4.1 MB" hint. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
