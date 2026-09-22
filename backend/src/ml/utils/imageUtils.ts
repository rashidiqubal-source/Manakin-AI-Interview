const MAX_BASE64_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

export interface ValidatedImagePayload {
  base64Image: string;
  buffer?: Buffer;
}

/**
 * Validates and normalizes an image input (base64 string or binary buffer)
 * into a clean base64 string ready for YOLO26 vision inference
 */
export function processBase64Frame(base64Image: string): ValidatedImagePayload {
  if (!base64Image || typeof base64Image !== 'string') {
    throw new Error('Missing or invalid image data');
  }

  // Strip any data URI prefix (e.g. data:image/jpeg;base64, data:image/png;base64, etc.)
  const cleanBase64 = base64Image.replace(/^data:[^;]+;base64,/, '').trim();
  if (cleanBase64.length === 0) {
    throw new Error('Empty base64 image payload');
  }

  const byteLength = Math.ceil((cleanBase64.length * 3) / 4);
  if (byteLength > MAX_BASE64_SIZE_BYTES) {
    throw new Error('Image exceeds maximum allowed size (10MB)');
  }

  return {
    base64Image: cleanBase64,
  };
}

/**
 * Normalizes binary image buffer to base64
 */
export function decodeImageBuffer(imageBuffer: Buffer): ValidatedImagePayload {
  if (!imageBuffer || imageBuffer.length === 0) {
    throw new Error('Empty image buffer');
  }

  if (imageBuffer.length > MAX_BASE64_SIZE_BYTES) {
    throw new Error('Image buffer exceeds maximum allowed size (10MB)');
  }

  return {
    base64Image: imageBuffer.toString('base64'),
    buffer: imageBuffer,
  };
}
