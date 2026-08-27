import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractExtensionProducts,
  getExtensionImageCandidates,
  normalizeImageCandidate,
} from './extensionProductImport.js';

const WEBP_DATA_URL = 'data:image/webp;base64,UklGRgQAAABXRUJQ';

test('accepts extension product payloads in versions 1.0, 1.1 and 1.2', () => {
  for (const version of ['1.0', '1.1', '1.2']) {
    const product = { name: `Produto ${version}`, price: 100, images: [WEBP_DATA_URL] };
    assert.deepEqual(extractExtensionProducts({
      format: 'kicks-store-product',
      version,
      product,
    }), [product]);
  }
});

test('expands extension 1.2 colorways into separate storefront products', () => {
  const products = extractExtensionProducts({
    format: 'kicks-store-product',
    version: '1.2',
    product: {
      name: 'Tênis Lunar',
      price: 299.9,
      images: ['https://cdn.example/general.webp'],
      colorVariants: [
        {
          name: 'Branco e Azul',
          sourceName: '白蓝',
          images: ['https://cdn.example/branco-azul.webp'],
        },
        {
          name: 'Preto e Vermelho',
          sourceName: '黑红',
          images: [],
        },
      ],
    },
  });

  assert.equal(products.length, 2);
  assert.equal(products[0].name, 'Tênis Lunar — Branco e Azul');
  assert.equal(products[0].colorName, 'Branco e Azul');
  assert.equal(products[0].colorSourceName, '白蓝');
  assert.deepEqual(products[0].images, ['https://cdn.example/branco-azul.webp']);
  assert.equal(products[1].name, 'Tênis Lunar — Preto e Vermelho');
  assert.deepEqual(products[1].images, ['https://cdn.example/general.webp']);
});

test('reads the complete WebP image contract emitted by extension 1.1', () => {
  const [candidate] = getExtensionImageCandidates({
    images: [{
      dataUrl: WEBP_DATA_URL,
      sourceUrl: 'https://cdn.example/shoe.jpg',
      name: 'foto-1.webp',
      mimeType: 'image/webp',
      size: 1234,
      width: 1200,
      height: 900,
    }],
  });

  assert.deepEqual(candidate, {
    source: WEBP_DATA_URL,
    name: 'foto-1.webp',
    mimeType: 'image/webp',
    size: 1234,
    width: 1200,
    height: 900,
  });
});

test('keeps legacy URL images, adds the cover fallback and removes duplicates', () => {
  const candidates = getExtensionImageCandidates({
    images: [{ url: 'https://cdn.example/one.jpg', name: 'one.jpg' }],
    coverImageUrl: 'https://cdn.example/two.png',
    imageUrl: 'https://cdn.example/one.jpg',
  });

  assert.deepEqual(candidates.map(({ source }) => source), [
    'https://cdn.example/one.jpg',
    'https://cdn.example/two.png',
  ]);
});

test('accepts a base64-only compatibility image and normalizes its MIME type', () => {
  const candidate = normalizeImageCandidate({
    base64: 'UklGRgQAAABXRUJQ',
    mimeType: 'image/webp',
  });

  assert.equal(candidate.source, WEBP_DATA_URL);
  assert.equal(candidate.mimeType, 'image/webp');
  assert.equal(candidate.name, 'foto-1.webp');
});

test('rejects unsupported structured extension versions with an actionable error', () => {
  assert.throws(
    () => extractExtensionProducts({ format: 'kicks-store-product', version: '2.0', product: {} }),
    /1\.0, 1\.1 ou 1\.2/,
  );
});
