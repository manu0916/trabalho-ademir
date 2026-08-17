export const IMAGE_FILE_ACCEPT = 'image/jpeg,image/png,image/webp';
export const MAX_IMAGE_SOURCE_BYTES = 12 * 1024 * 1024;
export const MAX_IMAGE_UPLOAD_BYTES = 2 * 1024 * 1024;

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function releaseImagePreviewUrls(images) {
  for (const image of images) {
    if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
  }
}

export async function prepareImageUpload(file, { maxDimension = 1800 } = {}) {
  if (!(file instanceof File) || !ACCEPTED_IMAGE_TYPES.has(file.type)) {
    throw new Error(`${file?.name || 'Arquivo'}: use uma imagem JPG, PNG ou WebP.`);
  }
  if (file.size < 1) throw new Error(`${file.name}: o arquivo está vazio.`);
  if (file.size > MAX_IMAGE_SOURCE_BYTES) {
    throw new Error(`${file.name}: o arquivo original deve ter no máximo 12 MB.`);
  }

  const source = await loadImageSource(file);
  const width = Number(source.width);
  const height = Number(source.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    source.close?.();
    throw new Error(`${file.name}: a imagem não possui dimensões válidas.`);
  }

  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) {
    source.close?.();
    throw new Error(`${file.name}: o navegador não conseguiu preparar esta foto.`);
  }

  try {
    context.fillStyle = '#ebe7de';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
  } finally {
    source.close?.();
  }

  let blob = await canvasToBlob(canvas, 'image/webp', 0.84);
  if (blob.size > MAX_IMAGE_UPLOAD_BYTES) blob = await canvasToBlob(canvas, 'image/webp', 0.68);
  if (blob.type !== 'image/webp' || blob.size > MAX_IMAGE_UPLOAD_BYTES) {
    blob = await canvasToBlob(canvas, 'image/jpeg', 0.82);
  }
  if (blob.size > MAX_IMAGE_UPLOAD_BYTES) blob = await canvasToBlob(canvas, 'image/jpeg', 0.66);
  if (blob.size > MAX_IMAGE_UPLOAD_BYTES) {
    throw new Error(`${file.name}: não foi possível reduzir a foto para menos de 2 MB.`);
  }

  const safeBaseName = file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '') || 'foto-kicks';
  const outputType = ACCEPTED_IMAGE_TYPES.has(blob.type) ? blob.type : 'image/jpeg';
  const extension = outputType === 'image/png' ? 'png' : outputType === 'image/webp' ? 'webp' : 'jpg';
  return new File([blob], `${safeBaseName}.${extension}`, { type: outputType });
}

async function loadImageSource(file) {
  if ('createImageBitmap' in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Some browsers expose createImageBitmap but reject orientation options.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = objectUrl;
    await image.decode();
    return image;
  } catch {
    throw new Error(`${file.name}: não foi possível ler esta imagem.`);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Não foi possível preparar a imagem.')),
      type,
      quality,
    );
  });
}
