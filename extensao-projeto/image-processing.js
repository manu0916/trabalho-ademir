// Kicks Store - browser-native image normalization for exported products.
// Kept as a standalone script so the popup, smoke test and future extension
// surfaces all use the exact same WebP conversion contract.

(function exposeKicksImageProcessor(scope) {
  'use strict';

  const OUTPUT_MIME_TYPE = 'image/webp';
  const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
  const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
  const MAX_DIMENSION = 1800;
  const FETCH_TIMEOUT_MS = 20_000;
  const WEBP_QUALITIES = Object.freeze([0.86, 0.76, 0.66, 0.56]);

  function assertSupportedInput(input) {
    const isBlob = typeof Blob !== 'undefined' && input instanceof Blob;
    if (!isBlob && (typeof input !== 'string' || !input.trim())) {
      throw new Error('A origem da imagem está vazia ou não é suportada.');
    }
  }

  function normalizedMimeType(value) {
    return String(value || '').split(';', 1)[0].trim().toLowerCase();
  }

  function assertPlausibleImageType(type) {
    const normalized = normalizedMimeType(type);
    if (normalized && !normalized.startsWith('image/') && normalized !== 'application/octet-stream') {
      throw new Error(`A origem retornou "${normalized}" em vez de uma imagem.`);
    }
  }

  async function fetchSourceBlob(input, {
    fetchImpl = scope.fetch?.bind(scope),
    maxSourceBytes = MAX_SOURCE_BYTES,
    timeoutMs = FETCH_TIMEOUT_MS,
  } = {}) {
    assertSupportedInput(input);

    if (typeof Blob !== 'undefined' && input instanceof Blob) {
      assertPlausibleImageType(input.type);
      if (input.size < 1) throw new Error('A imagem recebida está vazia.');
      if (input.size > maxSourceBytes) {
        throw new Error('A imagem original excede o limite de 12 MB.');
      }
      return input;
    }

    if (typeof fetchImpl !== 'function') {
      throw new Error('Este navegador não disponibiliza o download de imagens.');
    }

    const sourceUrl = input.trim();
    if (!sourceUrl.startsWith('data:image/')) {
      let parsed;
      try {
        parsed = new URL(sourceUrl);
      } catch {
        throw new Error('A URL da imagem é inválida.');
      }
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('A imagem precisa usar HTTP, HTTPS ou um Data URL.');
      }
    }

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
      const response = await fetchImpl(sourceUrl, {
        cache: 'force-cache',
        credentials: 'omit',
        signal: controller?.signal,
      });
      if (!response.ok) {
        throw new Error(`Não foi possível baixar a imagem (HTTP ${response.status}).`);
      }

      const declaredLength = Number(response.headers?.get?.('content-length'));
      if (Number.isFinite(declaredLength) && declaredLength > maxSourceBytes) {
        throw new Error('A imagem original excede o limite de 12 MB.');
      }

      assertPlausibleImageType(response.headers?.get?.('content-type'));
      const blob = await response.blob();
      assertPlausibleImageType(blob.type);
      if (blob.size < 1) throw new Error('A imagem baixada está vazia.');
      if (blob.size > maxSourceBytes) {
        throw new Error('A imagem original excede o limite de 12 MB.');
      }
      return blob;
    } catch (error) {
      if (error?.name === 'AbortError') {
        throw new Error('O download da imagem excedeu 20 segundos.');
      }
      throw error;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  async function decodeSource(blob) {
    if (typeof scope.createImageBitmap === 'function') {
      try {
        const bitmap = await scope.createImageBitmap(blob, { imageOrientation: 'from-image' });
        return {
          drawable: bitmap,
          width: Number(bitmap.width),
          height: Number(bitmap.height),
          release: () => bitmap.close?.(),
        };
      } catch {
        // Some formats/browser builds only work through HTMLImageElement.
      }
    }

    if (!scope.document || typeof scope.Image !== 'function') {
      throw new Error('O navegador não conseguiu decodificar esta imagem.');
    }

    const objectUrl = scope.URL.createObjectURL(blob);
    const image = new scope.Image();
    image.decoding = 'async';

    try {
      await new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => reject(new Error('A decodificação da imagem excedeu 20 segundos.')), FETCH_TIMEOUT_MS);
        image.onload = () => {
          clearTimeout(timeoutId);
          resolve();
        };
        image.onerror = () => {
          clearTimeout(timeoutId);
          reject(new Error('O arquivo baixado não contém uma imagem válida.'));
        };
        image.src = objectUrl;
      });

      return {
        drawable: image,
        width: Number(image.naturalWidth || image.width),
        height: Number(image.naturalHeight || image.height),
        release: () => scope.URL.revokeObjectURL(objectUrl),
      };
    } catch (error) {
      scope.URL.revokeObjectURL(objectUrl);
      throw error;
    }
  }

  function calculateOutputSize(width, height, maxDimension = MAX_DIMENSION) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
      throw new Error('A imagem não possui dimensões válidas.');
    }

    const scale = Math.min(1, maxDimension / Math.max(width, height));
    return {
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
    };
  }

  function createCanvas(width, height) {
    if (scope.document?.createElement) {
      const canvas = scope.document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      return canvas;
    }
    if (typeof scope.OffscreenCanvas === 'function') {
      return new scope.OffscreenCanvas(width, height);
    }
    throw new Error('O navegador não disponibiliza canvas para converter a imagem.');
  }

  function drawOnCanvas(drawable, width, height) {
    const canvas = createCanvas(width, height);
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) {
      throw new Error('O navegador não conseguiu inicializar o conversor de imagens.');
    }

    // The storefront already normalizes transparent images over white. Doing it
    // here makes JSON import and direct multipart upload produce identical bytes.
    context.fillStyle = '#FFFFFF';
    context.fillRect(0, 0, width, height);
    context.drawImage(drawable, 0, 0, width, height);
    return canvas;
  }

  function canvasToWebpBlob(canvas, quality) {
    if (typeof canvas.convertToBlob === 'function') {
      return canvas.convertToBlob({ type: OUTPUT_MIME_TYPE, quality });
    }
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error('O navegador não conseguiu gerar a imagem WebP.')),
        OUTPUT_MIME_TYPE,
        quality,
      );
    });
  }

  async function hasWebpSignature(blob) {
    if (!(blob instanceof Blob) || blob.size < 12) return false;
    const bytes = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
    const ascii = (offset, value) => [...value].every((character, index) => bytes[offset + index] === character.charCodeAt(0));
    return ascii(0, 'RIFF') && ascii(8, 'WEBP');
  }

  async function encodeWithinLimit(drawable, initialSize, {
    maxOutputBytes = MAX_OUTPUT_BYTES,
    qualities = WEBP_QUALITIES,
  } = {}) {
    const requestedLimit = Number(maxOutputBytes);
    const outputLimit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_OUTPUT_BYTES)
      : MAX_OUTPUT_BYTES;
    const qualitySteps = Array.isArray(qualities) && qualities.length > 0 ? qualities : WEBP_QUALITIES;
    let { width, height } = initialSize;
    let lastBlob = null;

    for (let resizeAttempt = 0; resizeAttempt < 8; resizeAttempt++) {
      const canvas = drawOnCanvas(drawable, width, height);

      for (const quality of qualitySteps) {
        const blob = await canvasToWebpBlob(canvas, quality);
        if (normalizedMimeType(blob.type) !== OUTPUT_MIME_TYPE || !(await hasWebpSignature(blob))) {
          throw new Error('Este navegador não oferece codificação WebP compatível.');
        }
        lastBlob = blob;
        if (blob.size <= outputLimit) {
          return { blob, width, height, quality };
        }
      }

      // Estimate the next area from the latest encoded size, while guaranteeing
      // meaningful progress even when the encoder size estimate is noisy.
      const estimatedScale = Math.sqrt(outputLimit / Math.max(1, lastBlob.size)) * 0.92;
      const scale = Math.min(0.85, Math.max(0.55, estimatedScale));
      const nextWidth = Math.max(1, Math.floor(width * scale));
      const nextHeight = Math.max(1, Math.floor(height * scale));
      if (nextWidth === width && nextHeight === height) break;
      width = nextWidth;
      height = nextHeight;
    }

    throw new Error('Não foi possível reduzir a imagem WebP para menos de 2 MB.');
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Não foi possível serializar a imagem WebP.'));
      reader.readAsDataURL(blob);
    });
  }

  async function prepareImageAsWebp(input, options = {}) {
    const blob = await fetchSourceBlob(input, options);
    const decoded = await decodeSource(blob);

    try {
      const requestedDimension = Number(options.maxDimension);
      const maximumDimension = Number.isFinite(requestedDimension) && requestedDimension > 0
        ? Math.min(requestedDimension, MAX_DIMENSION)
        : MAX_DIMENSION;
      const initialSize = calculateOutputSize(decoded.width, decoded.height, maximumDimension);
      const encoded = await encodeWithinLimit(decoded.drawable, initialSize, options);
      const dataUrl = await blobToDataUrl(encoded.blob);
      if (!dataUrl.startsWith('data:image/webp;base64,')) {
        throw new Error('A imagem convertida não gerou um Data URL WebP válido.');
      }
      return {
        blob: encoded.blob,
        dataUrl,
        mimeType: OUTPUT_MIME_TYPE,
        size: encoded.blob.size,
        width: encoded.width,
        height: encoded.height,
        quality: encoded.quality,
      };
    } finally {
      decoded.release?.();
    }
  }

  function createExportImage(prepared, index, sourceUrl = '') {
    if (!prepared?.dataUrl?.startsWith('data:image/webp;base64,')) {
      throw new Error('A imagem preparada não está no formato WebP esperado.');
    }
    const normalizedIndex = Number.isInteger(index) && index > 0 ? index : 1;
    return {
      id: normalizedIndex,
      url: sourceUrl,
      sourceUrl,
      dataUrl: prepared.dataUrl,
      name: `foto-${normalizedIndex}.webp`,
      mimeType: OUTPUT_MIME_TYPE,
      size: prepared.size,
      width: prepared.width,
      height: prepared.height,
    };
  }

  scope.KicksImageProcessor = Object.freeze({
    OUTPUT_MIME_TYPE,
    MAX_SOURCE_BYTES,
    MAX_OUTPUT_BYTES,
    MAX_DIMENSION,
    fetchSourceBlob,
    hasWebpSignature,
    prepareImageAsWebp,
    createExportImage,
  });
})(globalThis);
