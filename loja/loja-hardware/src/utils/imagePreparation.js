export const IMAGE_FILE_ACCEPT = 'image/jpeg,image/png,image/webp';
export const MAX_IMAGE_SOURCE_BYTES = 12 * 1024 * 1024;
export const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024;

const WEBP_TYPE = 'image/webp';
const REMOTE_IMAGE_TIMEOUT_MS = 12_000;
const WEBP_QUALITIES = [0.84, 0.72, 0.60, 0.48];
const MIN_RESIZE_DIMENSION = 640;

export function releaseImagePreviewUrls(images) {
  if (!Array.isArray(images)) return;
  for (const image of images) {
    if (image?.previewUrl?.startsWith?.('blob:')) {
      try {
        URL.revokeObjectURL(image.previewUrl);
      } catch {
        // A revoked or foreign URL does not require any additional cleanup.
      }
    }
  }
}

export async function prepareImageUpload(file, { maxDimension = 1800 } = {}) {
  if (!(file instanceof Blob)) {
    throw new Error(`${file?.name || 'Arquivo'}: selecione uma imagem JPG, PNG ou WebP.`);
  }

  const filename = file instanceof File && file.name ? file.name : 'foto-kicks';
  validateSourceBlob(file, filename);
  return convertBlobToWebpFile(file, filename, { maxDimension });
}

export async function prepareRawOrDataUrlImage(input, filename = 'foto-kicks.webp', { maxDimension = 1800 } = {}) {
  const sourceBlob = await readImageInput(input);
  validateSourceBlob(sourceBlob, filename);
  return convertBlobToWebpFile(sourceBlob, filename, { maxDimension });
}

export async function isWebpBlob(blob) {
  if (!(blob instanceof Blob) || blob.size < 12) return false;
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  return asciiAt(header, 0, 'RIFF') && asciiAt(header, 8, 'WEBP');
}

async function readImageInput(input) {
  if (input instanceof Blob) return input;
  if (typeof input !== 'string' || !input.trim()) {
    throw new Error('A foto exportada não contém dados de imagem válidos.');
  }

  const source = input.trim();
  const isEmbeddedImage = /^data:image\/[a-z0-9.+-]+(?:;[^,]*)?,/i.test(source);
  const isRemoteImage = /^https?:\/\//i.test(source);
  if (!isEmbeddedImage && !isRemoteImage) {
    throw new Error('A foto exportada deve ser uma imagem incorporada ou um endereço HTTP(S).');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_IMAGE_TIMEOUT_MS);
  try {
    const response = await fetch(source, {
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
    });
    if (!response.ok) {
      throw new Error(`o servidor da imagem respondeu HTTP ${response.status}`);
    }
    const blob = await response.blob();
    if (blob.type && !blob.type.toLowerCase().startsWith('image/')) {
      throw new Error(`o endereço retornou ${blob.type}, e não uma imagem`);
    }
    return blob;
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error('Tempo limite excedido ao carregar a foto exportada.');
    }
    const detail = error?.message ? ` (${error.message})` : '';
    if (isRemoteImage) {
      throw new Error(`Não foi possível baixar a foto remota${detail}. Exporte novamente pela extensão para incorporá-la em WebP.`);
    }
    throw new Error(`Não foi possível ler a foto incorporada${detail}.`);
  } finally {
    clearTimeout(timeout);
  }
}

function validateSourceBlob(blob, filename) {
  if (blob.size < 1) throw new Error(`${filename}: o arquivo está vazio.`);
  if (blob.size > MAX_IMAGE_SOURCE_BYTES) {
    throw new Error(`${filename}: o arquivo original deve ter no máximo 12 MB.`);
  }
}

async function convertBlobToWebpFile(blob, filename, { maxDimension }) {
  const loaded = await loadImageSource(blob, filename);
  const width = Number(loaded.source.width || loaded.source.naturalWidth);
  const height = Number(loaded.source.height || loaded.source.naturalHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 5 || height < 5) {
    loaded.release();
    throw new Error(`${filename}: a imagem é muito pequena ou não possui dimensões válidas.`);
  }

  const normalizedMaxDimension = Number.isFinite(Number(maxDimension))
    ? Math.max(MIN_RESIZE_DIMENSION, Math.min(5000, Number(maxDimension)))
    : 1800;
  const scale = Math.min(1, normalizedMaxDimension / Math.max(width, height));
  let canvas;
  try {
    canvas = drawSourceToCanvas(
      loaded.source,
      Math.max(1, Math.round(width * scale)),
      Math.max(1, Math.round(height * scale)),
    );
  } finally {
    loaded.release();
  }

  const outputBlob = await encodeWebpWithinLimit(canvas);
  const safeBaseName = String(filename || 'foto-kicks')
    .replace(/^.*[\\/]/, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'foto-kicks';
  return new File([outputBlob], `${safeBaseName}.webp`, { type: WEBP_TYPE });
}

async function loadImageSource(blob, filename) {
  if ('createImageBitmap' in globalThis) {
    try {
      const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
      return { source: bitmap, release: () => bitmap.close?.() };
    } catch {
      // Some browsers expose createImageBitmap but cannot decode every supported raster.
    }
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = objectUrl;
    await image.decode();
    return { source: image, release: () => URL.revokeObjectURL(objectUrl) };
  } catch {
    URL.revokeObjectURL(objectUrl);
    throw new Error(`${filename}: não foi possível decodificar esta imagem.`);
  }
}

function drawSourceToCanvas(source, width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('O navegador não conseguiu preparar esta foto.');

  context.fillStyle = '#FFFFFF';
  context.fillRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  return canvas;
}

async function encodeWebpWithinLimit(initialCanvas) {
  let canvas = initialCanvas;
  let smallestBlob = null;

  while (true) {
    for (const quality of WEBP_QUALITIES) {
      const blob = await canvasToBlob(canvas, WEBP_TYPE, quality);
      if (!await isWebpBlob(blob)) {
        throw new Error('Este navegador não consegue gerar imagens WebP. Atualize o navegador e tente novamente.');
      }
      if (!smallestBlob || blob.size < smallestBlob.size) smallestBlob = blob;
      if (blob.size <= MAX_IMAGE_UPLOAD_BYTES) return blob;
    }

    const longestSide = Math.max(canvas.width, canvas.height);
    if (longestSide <= MIN_RESIZE_DIMENSION) break;

    const byteRatio = Math.sqrt(MAX_IMAGE_UPLOAD_BYTES / smallestBlob.size);
    const resizeRatio = Math.max(0.65, Math.min(0.85, byteRatio * 0.92));
    const nextWidth = Math.max(1, Math.round(canvas.width * resizeRatio));
    const nextHeight = Math.max(1, Math.round(canvas.height * resizeRatio));
    canvas = drawSourceToCanvas(canvas, nextWidth, nextHeight);
  }

  throw new Error('Não foi possível reduzir a foto WebP para menos de 2 MB.');
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('Não foi possível preparar a imagem WebP.')),
        type,
        quality,
      );
    } catch (error) {
      reject(error);
    }
  });
}

function asciiAt(bytes, offset, expected) {
  if (offset + expected.length > bytes.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    if (bytes[offset + index] !== expected.charCodeAt(index)) return false;
  }
  return true;
}
