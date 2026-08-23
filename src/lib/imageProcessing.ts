import sharp from "sharp";
import heicConvert from "heic-convert";

const HEIC_MIME_TYPES = new Set(["image/heic", "image/heif", "image/heic-sequence", "image/heif-sequence"]);
const HEIC_FTYP_BRANDS = new Set(["heic", "heix", "hevc", "heim", "heis", "hevm", "hevs", "mif1", "msf1"]);

// iOS Safari doesn't always send a useful mimetype for HEIC files (some
// versions/contexts report application/octet-stream or leave it blank), so
// the ISO base media file format's "ftyp" brand — bytes 8-11 of any
// HEIC/HEIF/MP4-family file — is checked as a fallback.
function looksLikeHeic(buffer: Buffer, mimetype: string): boolean {
  if (HEIC_MIME_TYPES.has(mimetype.toLowerCase())) return true;
  if (buffer.length < 12) return false;
  const brand = buffer.toString("ascii", 8, 12).toLowerCase();
  return HEIC_FTYP_BRANDS.has(brand);
}

const MAX_DIMENSION = 1568; // Anthropic's vision API downsamples beyond this anyway
const JPEG_QUALITY = 85;

export interface ProcessedImage {
  buffer: Buffer;
  mimeType: "image/jpeg";
}

/**
 * Normalizes any uploaded photo into a modest JPEG. Two real problems this
 * fixes: (1) HEIC — the default format for iPhone camera/Photos — isn't a
 * format Claude's vision API accepts, and was being sent through unconverted,
 * silently failing every estimate; (2) a phone camera's native photo can be
 * 10-30MB+ (HDR, high-megapixel sensors), which is both wasteful to store and
 * was hitting multer's upload size limit with no friendly error. Runs on
 * every upload, not just HEIC ones, since even an already-JPEG original is
 * usually far larger than useful here.
 */
export async function normalizeUploadedImage(buffer: Buffer, mimetype: string): Promise<ProcessedImage> {
  const working = looksLikeHeic(buffer, mimetype) ? await heicConvert({ buffer, format: "JPEG", quality: 0.9 }) : buffer;

  const resized = await sharp(working)
    .rotate() // bake in EXIF orientation before it gets stripped by re-encoding
    .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: JPEG_QUALITY })
    .toBuffer();

  return { buffer: resized, mimeType: "image/jpeg" };
}
