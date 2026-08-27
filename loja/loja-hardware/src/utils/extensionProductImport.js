const SUPPORTED_FORMATS = new Set(['kicks-store-product', 'kicks-store-catalog']);
const SUPPORTED_VERSIONS = new Set(['1.0', '1.1', '1.2']);
const IMAGE_SOURCE_KEYS = ['dataUrl', 'webpDataUrl', 'imageUrl', 'sourceUrl', 'url', 'src'];

export function extractExtensionProducts(payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('O arquivo de importação deve conter um objeto JSON.');
  }

  const format = cleanString(payload.format);
  const version = cleanString(payload.version);
  if (format && SUPPORTED_FORMATS.has(format) && version && !SUPPORTED_VERSIONS.has(version)) {
    throw new Error(`A versão ${version} do arquivo ainda não é compatível. Use uma exportação 1.0, 1.1 ou 1.2 da extensão.`);
  }

  let products;
  if (format === 'kicks-store-product' && payload.product) {
    products = [payload.product];
  } else if (format === 'kicks-store-catalog' && Array.isArray(payload.items)) {
    products = payload.items;
  } else if (Array.isArray(payload)) {
    products = payload;
  } else if (cleanString(payload.name) && payload.price !== undefined) {
    products = [payload];
  } else if (payload.product && cleanString(payload.product.name)) {
    products = [payload.product];
  } else {
    throw new Error('Formato de dados do tênis não reconhecido. Use o JSON exportado pela extensão Kicks Store.');
  }

  const validProducts = products
    .filter((product) => product && typeof product === 'object')
    .flatMap(expandColorVariants);
  if (validProducts.length === 0) {
    throw new Error('Nenhum produto foi encontrado dentro do arquivo.');
  }
  return validProducts;
}

function expandColorVariants(product) {
  const variants = Array.isArray(product?.colorVariants)
    ? product.colorVariants.filter((variant) => variant && typeof variant === 'object' && variant.selected !== false)
    : [];
  if (variants.length === 0) return [product];

  const baseProduct = { ...product };
  delete baseProduct.colorVariants;
  const uniqueNames = new Set();
  const expanded = [];
  for (const [index, variant] of variants.entries()) {
    const colorName = cleanString(variant.name) || `Cor ${index + 1}`;
    const key = colorName.toLocaleLowerCase('pt-BR');
    if (uniqueNames.has(key)) continue;
    uniqueNames.add(key);

    const variantImages = Array.isArray(variant.images) && variant.images.length > 0
      ? variant.images
      : baseProduct.images;
    const baseName = cleanString(baseProduct.name);
    const alreadyNamed = baseName.toLocaleLowerCase('pt-BR').includes(colorName.toLocaleLowerCase('pt-BR'));
    expanded.push({
      ...baseProduct,
      name: alreadyNamed ? baseName : `${baseName} — ${colorName}`,
      colorName,
      colorSourceName: cleanString(variant.sourceName),
      images: variantImages,
      coverImageUrl: cleanString(variant.coverImageUrl)
        || firstImageSource(variantImages)
        || cleanString(baseProduct.coverImageUrl),
    });
  }
  return expanded.length > 0 ? expanded : [baseProduct];
}

function firstImageSource(images) {
  if (!Array.isArray(images) || images.length === 0) return '';
  const first = images[0];
  if (typeof first === 'string') return cleanString(first);
  if (!first || typeof first !== 'object') return '';
  return IMAGE_SOURCE_KEYS.map((key) => cleanString(first[key])).find(Boolean) || '';
}

export function getExtensionImageCandidates(product, { maxImages = 8 } = {}) {
  const rawCandidates = Array.isArray(product?.images) ? [...product.images] : [];
  for (const fallback of [product?.coverImageUrl, product?.imageUrl, product?.image]) {
    if (fallback) rawCandidates.push(fallback);
  }

  const candidates = [];
  const seenSources = new Set();
  for (const rawCandidate of rawCandidates) {
    const candidate = normalizeImageCandidate(rawCandidate, candidates.length);
    if (!candidate || seenSources.has(candidate.source)) continue;
    seenSources.add(candidate.source);
    candidates.push(candidate);
    if (candidates.length >= maxImages) break;
  }
  return candidates;
}

export function normalizeImageCandidate(rawCandidate, index = 0) {
  if (typeof rawCandidate === 'string') {
    const source = rawCandidate.trim();
    return source ? defaultCandidate(source, index) : null;
  }
  if (!rawCandidate || typeof rawCandidate !== 'object') return null;

  let source = IMAGE_SOURCE_KEYS
    .map((key) => cleanString(rawCandidate[key]))
    .find(Boolean);
  const declaredMimeType = cleanString(rawCandidate.mimeType || rawCandidate.type).toLowerCase();
  if (!source && cleanString(rawCandidate.base64)) {
    const mimeType = declaredMimeType.startsWith('image/') ? declaredMimeType : 'image/webp';
    source = `data:${mimeType};base64,${cleanString(rawCandidate.base64).replace(/^data:[^,]+,/, '')}`;
  }
  if (!source) return null;

  return {
    source,
    name: safeImageName(rawCandidate.name || rawCandidate.fileName || rawCandidate.filename, index),
    mimeType: declaredMimeType || mimeTypeFromDataUrl(source),
    size: finitePositiveNumber(rawCandidate.size),
    width: finitePositiveNumber(rawCandidate.width),
    height: finitePositiveNumber(rawCandidate.height),
  };
}

function defaultCandidate(source, index) {
  return {
    source,
    name: safeImageName('', index),
    mimeType: mimeTypeFromDataUrl(source),
    size: null,
    width: null,
    height: null,
  };
}

function safeImageName(value, index) {
  const filename = cleanString(value).replace(/^.*[\\/]/, '');
  return filename || `foto-${index + 1}.webp`;
}

function mimeTypeFromDataUrl(source) {
  const match = /^data:(image\/[a-z0-9.+-]+)[;,]/i.exec(source);
  return match ? match[1].toLowerCase() : '';
}

function finitePositiveNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}
