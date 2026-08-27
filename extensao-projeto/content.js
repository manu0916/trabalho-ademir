// Kicks Store - Universal Sneaker & Product Scraper Engine

async function scanProductPage() {
  const result = {
    title: '',
    price: '',
    category: 'Basquete',
    description: '',
    images: [],
    variants: [],
    url: window.location.href,
    sourceStore: window.location.hostname.replace(/^www\./, ''),
  };

  // 1. Extract from JSON-LD Schema (High accuracy)
  extractJsonLd(result);

  // 2. Extract from OpenGraph and Meta tags
  extractMetaTags(result);

  // 3. Extract using DOM heuristics and custom e-commerce selectors
  extractDomHeuristics(result);

  // 4. Extract each supplier colorway before harvesting the general gallery.
  // Color options are kept separate so the exported file can create one clean
  // storefront entry per color instead of mixing every photo together.
  await extractColorVariants(result);

  // 5. Extract all gallery and high-res images
  extractAllImages(result);

  // 6. Clean up, format, and deduce category
  finalizeData(result);

  return result;
}

// ── 1. JSON-LD Schema Extraction ─────────────────────────────────────────────
function extractJsonLd(result) {
  try {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const json = JSON.parse(script.textContent);
        const products = findProductObjects(json);
        for (const item of products) {
          if (!result.title && item.name) result.title = cleanText(item.name);
          if (!result.description && item.description) result.description = cleanText(item.description);
          
          if (!result.price && item.offers) {
            const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
            if (offers && offers.price) {
              result.price = String(offers.price);
            }
          }

          if (item.image) {
            const images = Array.isArray(item.image) ? item.image : [item.image];
            for (const img of images) {
              const url = typeof img === 'string' ? img : (img.url || img.contentUrl);
              if (url) addUniqueImage(result.images, url);
            }
          }

          extractStructuredProductColors(item, result);
        }
      } catch {
        // Continue to next script
      }
    }
  } catch (e) {
    console.warn('Erro ao processar JSON-LD:', e);
  }
}

function extractStructuredProductColors(product, result) {
  const variants = Array.isArray(product?.hasVariant) ? product.hasVariant : [];
  for (const variant of variants) {
    const sourceName = variant?.color || variant?.name;
    if (!sourceName) continue;
    mergeColorVariant(result, {
      sourceName,
      images: normalizeStructuredImages(variant.image),
    });
  }

  const colors = Array.isArray(product?.color) ? product.color : [product?.color];
  for (const sourceName of colors.filter(Boolean)) {
    mergeColorVariant(result, {
      sourceName,
      images: normalizeStructuredImages(product.image),
    });
  }
}

function normalizeStructuredImages(value) {
  const values = Array.isArray(value) ? value : [value];
  return values
    .map((image) => typeof image === 'string' ? image : image?.url || image?.contentUrl)
    .filter(Boolean)
    .map(resolveUrl);
}

function findProductObjects(obj) {
  const items = [];
  if (!obj || typeof obj !== 'object') return items;
  if (Array.isArray(obj)) {
    for (const item of obj) items.push(...findProductObjects(item));
    return items;
  }
  if (obj['@type'] === 'Product' || (Array.isArray(obj['@type']) && obj['@type'].includes('Product'))) {
    items.push(obj);
  }
  if (obj['@graph'] && Array.isArray(obj['@graph'])) {
    for (const item of obj['@graph']) items.push(...findProductObjects(item));
  }
  return items;
}

// ── 2. Meta Tags Extraction ───────────────────────────────────────────────────
function extractMetaTags(result) {
  const getMeta = (props) => {
    for (const prop of props) {
      const el = document.querySelector(`meta[property="${prop}"], meta[name="${prop}"]`);
      if (el && el.content) return el.content.trim();
    }
    return '';
  };

  if (!result.title) result.title = getMeta(['og:title', 'twitter:title']);
  if (!result.description) result.description = getMeta(['og:description', 'twitter:description', 'description']);
  
  const ogPrice = getMeta(['product:price:amount', 'og:price:amount']);
  if (!result.price && ogPrice) result.price = ogPrice;

  const ogImage = getMeta(['og:image', 'og:image:secure_url', 'twitter:image']);
  if (ogImage) addUniqueImage(result.images, ogImage);
}

// ── 3. DOM Heuristics Extraction ─────────────────────────────────────────────
function extractDomHeuristics(result) {
  // Title
  if (!result.title) {
    const titleSelectors = [
      'h1.product-title', 'h1[class*="product"]', 'h1[class*="title"]', 'h1[class*="name"]',
      '.product-name h1', '.product-details h1', 'h1', '[data-test*="product-title"]'
    ];
    for (const selector of titleSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim().length > 3) {
        result.title = cleanText(el.textContent);
        break;
      }
    }
  }

  // Price
  if (!result.price) {
    const priceSelectors = [
      '[data-test*="product-price"]', '.product-price', '.sales-price', '.price-sales',
      '[class*="salesPrice"]', '[class*="finalPrice"]', '[class*="bestPrice"]',
      '.price', '[itemprop="price"]', '.val-price', '.preco-promocional'
    ];
    for (const selector of priceSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent.replace(/\s+/g, ' ').trim();
        const priceMatch = text.match(/R?\$?\s*([0-9]{1,3}(?:\.[0-9]{3})*,[0-9]{2}|[0-9]+(?:\.[0-9]{2})?)/);
        if (priceMatch) {
          result.price = priceMatch[1];
          break;
        }
      }
    }
  }

  // Description
  if (!result.description) {
    const descSelectors = [
      '[itemprop="description"]', '.product-description', '#product-description',
      '.description-content', '.detalhes-produto', '[class*="description"] p'
    ];
    for (const selector of descSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim().length > 20) {
        result.description = cleanText(el.textContent);
        break;
      }
    }
  }
}

// ── 4. Colorway Extraction ───────────────────────────────────────────────────
const COLOR_GROUP_MARKER = /(?:颜色分类|颜色|色号|配色|colour|color|\bcor\b)/i;
const COLOR_OPTION_SELECTOR = [
  '[role="radio"]',
  '[role="option"]',
  'button',
  '[data-value]',
  'li[data-value]',
  'li[data-sku-id]',
  '[data-color]',
  '[data-color-name]',
  '[data-option-value]',
  '[data-sku-id]',
  '[data-vid]',
  '[title]',
  '[aria-label]',
  '[class*="sku-item"]',
  '[class*="skuItem"]',
  '[class*="sku-value"]',
  '[class*="skuValue"]',
  '[class*="prop-item"]',
  '[class*="propItem"]',
  '[class*="prop-value"]',
  '[class*="propValue"]',
  '[class*="spec-item"]',
  '[class*="specItem"]',
  '[class*="color-item"]',
  '[class*="colorItem"]',
  '[class*="value-item"]',
  '[class*="valueItem"]',
].join(',');

async function extractColorVariants(result) {
  extractEmbeddedColorData(result);

  const group = findBestColorGroup();
  if (!group) {
    finalizeColorVariants(result);
    return;
  }

  const options = getColorOptionElements(group);
  const descriptors = options
    .map((element, index) => describeColorOption(element, index))
    .filter(Boolean)
    .slice(0, 32);

  for (const descriptor of descriptors) mergeColorVariant(result, descriptor);

  // Many marketplaces replace the main gallery only after a color is selected.
  // We briefly select each safe button and take a snapshot of that gallery.
  const originalSelection = options.find(isSelectedOption);
  const originalSelectionName = getColorOptionLabel(originalSelection);
  for (const descriptor of descriptors.slice(0, 24)) {
    const element = resolveLiveColorOption(group, descriptor);
    if (!isSafeClickableOption(element)) continue;
    try {
      element.click();
      await waitForVariantGallery();
      const galleryImages = collectFocusedGalleryImages();
      mergeColorVariant(result, { ...descriptor, images: galleryImages });
    } catch {
      // A supplier can replace or disable its SKU element while the page updates.
      // The label and swatch captured before clicking remain useful.
    }
  }

  const liveOriginalSelection = originalSelection && document.contains(originalSelection)
    ? originalSelection
    : findColorOptionByName(findBestColorGroup(), originalSelectionName);
  if (isSafeClickableOption(liveOriginalSelection)) {
    try {
      liveOriginalSelection.click();
      await waitForVariantGallery(80);
    } catch {
      // Restoring the original option is best effort only.
    }
  }

  finalizeColorVariants(result);
}

function resolveLiveColorOption(originalGroup, descriptor) {
  if (document.contains(descriptor?.element)) return descriptor.element;
  const liveGroup = document.contains(originalGroup) ? originalGroup : findBestColorGroup();
  return findColorOptionByName(liveGroup, descriptor?.sourceName);
}

function findColorOptionByName(group, sourceName) {
  const target = cleanVariantText(sourceName).toLocaleLowerCase();
  if (!group || !target) return null;
  return getColorOptionElements(group)
    .find((element) => getColorOptionLabel(element).toLocaleLowerCase() === target) || null;
}

function findBestColorGroup() {
  let singleOptionFallback = null;
  const directSelectors = [
    '[data-property-name*="颜色"]',
    '[data-prop-name*="颜色"]',
    '[aria-label*="颜色"]',
    '.J_Prop_Color',
    '[class*="color-sku"]',
    '[class*="colorSku"]',
    '[class*="sku-color"]',
    '[class*="skuColor"]',
    '[class*="color-variant"]',
    '[class*="colorVariant"]',
  ];
  for (const selector of directSelectors) {
    for (const candidate of document.querySelectorAll(selector)) {
      const optionCount = getColorOptionElements(candidate).length;
      if (optionCount >= 2) return candidate;
      if (optionCount === 1 && !singleOptionFallback) singleOptionFallback = candidate;
    }
  }

  const labels = document.querySelectorAll('legend, dt, label, h2, h3, h4, strong, span, div');
  for (const label of [...labels].slice(0, 4000)) {
    const ownText = getOwnText(label);
    if (!ownText || ownText.length > 80 || !COLOR_GROUP_MARKER.test(ownText)) continue;

    let candidate = label.parentElement;
    for (let depth = 0; candidate && depth < 4; depth++, candidate = candidate.parentElement) {
      const options = getColorOptionElements(candidate);
      if (options.length >= 2 && options.length <= 80) return candidate;
      if (options.length === 1 && !singleOptionFallback) singleOptionFallback = candidate;
    }
  }
  return singleOptionFallback;
}

function getOwnText(element) {
  return [...(element?.childNodes || [])]
    .filter((node) => node.nodeType === Node.TEXT_NODE)
    .map((node) => node.textContent || '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getColorOptionElements(group) {
  if (!group?.querySelectorAll) return [];
  const candidates = [...group.querySelectorAll(COLOR_OPTION_SELECTOR)];
  const usable = candidates.filter((element) => {
    if (!element || element.closest('script, style, template')) return false;
    const label = getColorOptionLabel(element);
    if (!label || label.length > 100) return false;
    if (/^(?:选择|请选择|颜色分类|颜色|color|colour|cor)$/i.test(label)) return false;
    if (/^[\d.:_-]+$/.test(label) && !getElementImageUrl(element)) return false;
    return true;
  });

  const leaves = usable.filter((element) => !usable.some((other) => other !== element && element.contains(other)));
  const unique = [];
  const seen = new Set();
  for (const element of leaves) {
    const key = `${getColorOptionLabel(element).toLocaleLowerCase()}|${getElementImageUrl(element)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(element);
  }
  return unique;
}

function describeColorOption(element, index) {
  const sourceName = getColorOptionLabel(element);
  if (!sourceName) return null;
  const imageUrl = getElementImageUrl(element);
  return {
    element,
    sourceName,
    name: translateColorName(sourceName, index),
    imageUrl,
    images: imageUrl ? [imageUrl] : [],
    selected: true,
  };
}

function getColorOptionLabel(element) {
  const values = [
    element?.getAttribute?.('data-name'),
    element?.getAttribute?.('data-title'),
    element?.getAttribute?.('data-label'),
    element?.getAttribute?.('aria-label'),
    element?.getAttribute?.('title'),
    element?.querySelector?.('img')?.getAttribute?.('alt'),
    element?.textContent,
    element?.getAttribute?.('data-value'),
    element?.getAttribute?.('data-option-value'),
  ];
  for (const value of values) {
    const clean = cleanVariantText(value);
    if (clean && !/^[\d.:_-]+$/.test(clean)) return clean;
  }
  return '';
}

function cleanVariantText(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/^(?:颜色分类|颜色|色号|配色|color|colour|cor)\s*[:：-]\s*/i, '')
    .replace(/(?:库存|已售|销量|约|剩余)\s*\d+.*$/i, '')
    .replace(/[¥￥$]\s*\d+(?:[.,]\d+)?/g, '')
    .trim();
}

function getElementImageUrl(element) {
  if (!element) return '';
  const image = element.matches?.('img') ? element : element.querySelector?.('img, source');
  const candidates = [
    element.getAttribute?.('data-image'),
    element.getAttribute?.('data-img'),
    element.getAttribute?.('data-src'),
    element.getAttribute?.('data-original'),
    image?.getAttribute?.('data-zoom'),
    image?.getAttribute?.('data-src'),
    image?.getAttribute?.('src'),
    image?.getAttribute?.('srcset'),
  ];
  for (let candidate of candidates) {
    if (!candidate) continue;
    if (candidate.includes(',')) candidate = candidate.split(',').at(-1).trim().split(/\s+/)[0];
    const url = upgradeToHighRes(resolveUrl(candidate));
    if (isValidImageUrl(url)) return url;
  }

  const backgroundImage = element.style?.backgroundImage || getComputedStyle(element).backgroundImage;
  const match = backgroundImage?.match(/url\(["']?([^"')]+)["']?\)/i);
  const url = match?.[1] ? upgradeToHighRes(resolveUrl(match[1])) : '';
  return isValidImageUrl(url) ? url : '';
}

function isSelectedOption(element) {
  if (!element) return false;
  return element.matches('[aria-checked="true"], [aria-selected="true"], .selected, .is-selected, .active, .checked')
    || element.getAttribute('data-selected') === 'true';
}

function isSafeClickableOption(element) {
  if (!element || !document.contains(element)) return false;
  if (element.matches('[disabled], [aria-disabled="true"], .disabled, .is-disabled')) return false;
  if (element.matches('a[href]')) {
    const href = element.getAttribute('href') || '';
    if (href && href !== '#' && !href.toLocaleLowerCase().startsWith('javascript:')) return false;
  }
  return typeof element.click === 'function';
}

function waitForVariantGallery(delay = 260) {
  return new Promise((resolve) => setTimeout(resolve, delay));
}

function collectFocusedGalleryImages() {
  const imageList = [];
  const selectors = [
    '.product-gallery', '.gallery', '.carousel', '.swiper-wrapper', '[data-gallery]',
    '[data-slider]', '.slick-track', '.product-images', '.pdp-images', '.image-gallery',
    '.main-image', '#product-gallery', '[class*="mainImage"]', '[class*="imagePreview"]',
    '[class*="magnifier"]', '[class*="preview"]',
  ];
  for (const selector of selectors) {
    for (const container of document.querySelectorAll(selector)) {
      for (const element of container.querySelectorAll('img, picture source, [style*="background-image"]')) {
        harvestElementImage(element, imageList);
        if (imageList.length >= 8) break;
      }
      if (imageList.length >= 8) break;
    }
    if (imageList.length >= 8) break;
  }
  return imageList.map((image) => image.url);
}

function extractEmbeddedColorData(result) {
  const scripts = document.querySelectorAll('script[type="application/json"], script[type="application/ld+json"]');
  let visited = 0;
  for (const script of [...scripts].slice(0, 40)) {
    const source = script.textContent?.trim();
    if (!source || source.length > 2_000_000 || !/^[{[]/.test(source)) continue;
    try {
      visitStructuredNode(JSON.parse(source), 0);
    } catch {
      // Not every application/json script is strict JSON.
    }
  }

  function visitStructuredNode(node, depth) {
    if (!node || typeof node !== 'object' || depth > 10 || visited++ > 30_000) return;
    if (Array.isArray(node)) {
      for (const child of node) visitStructuredNode(child, depth + 1);
      return;
    }

    const propertyName = cleanVariantText(node.propertyName || node.propName || node.label || node.title || node.name);
    const values = node.values || node.options || node.items || node.children || node.valueList;
    if (propertyName && COLOR_GROUP_MARKER.test(propertyName) && Array.isArray(values)) {
      for (const [index, value] of values.entries()) {
        if (typeof value === 'string') {
          mergeColorVariant(result, { sourceName: value, name: translateColorName(value, index), images: [] });
          continue;
        }
        const sourceName = value?.name || value?.label || value?.title || value?.value || value?.text;
        if (!sourceName) continue;
        const imageUrl = value?.imageUrl || value?.image || value?.imgUrl || value?.picture || value?.picUrl || '';
        mergeColorVariant(result, {
          sourceName,
          name: translateColorName(sourceName, index),
          imageUrl,
          images: imageUrl ? [imageUrl] : [],
        });
      }
    }
    for (const value of Object.values(node)) visitStructuredNode(value, depth + 1);
  }
}

function mergeColorVariant(result, incoming) {
  const sourceName = cleanVariantText(incoming?.sourceName || incoming?.name);
  if (!sourceName) return;
  const name = incoming?.name || translateColorName(sourceName, result.variants.length);
  const normalizedName = name.toLocaleLowerCase('pt-BR');
  const key = /^cor \d+$/i.test(name)
    ? `${sourceName}|${name}`.toLocaleLowerCase('pt-BR')
    : normalizedName;
  let variant = result.variants.find((item) => item._key === key);
  if (!variant) {
    variant = {
      _key: key,
      sourceName,
      name,
      imageUrl: '',
      images: [],
      selected: incoming?.selected !== false,
    };
    result.variants.push(variant);
  }

  const sources = [incoming?.imageUrl, ...(incoming?.images || [])];
  for (const rawSource of sources) {
    const source = typeof rawSource === 'string' ? rawSource : rawSource?.url;
    const url = source ? upgradeToHighRes(resolveUrl(source)) : '';
    if (!isValidImageUrl(url) || variant.images.some((image) => image.url.split('?')[0] === url.split('?')[0])) continue;
    variant.images.push({ id: variant.images.length + 1, url, selected: true });
    if (!variant.imageUrl) variant.imageUrl = url;
    if (variant.images.length >= 8) break;
  }
}

function finalizeColorVariants(result) {
  result.variants = result.variants
    .filter((variant) => variant?.name)
    .slice(0, 24)
    .map(({ _key, element, ...variant }) => variant);
}

function translateColorName(sourceName, index) {
  return globalThis.KicksColorTranslator?.translateColorName?.(sourceName, index)
    || cleanVariantText(sourceName)
    || `Cor ${index + 1}`;
}

// ── 5. Image Harvesting (High Res & Multi-angle) ──────────────────────────────
function extractAllImages(result) {
  // Look inside product galleries and carousels first
  const gallerySelectors = [
    '.product-gallery', '.gallery', '.carousel', '.swiper-wrapper',
    '[data-gallery]', '[data-slider]', '.slick-track', '.product-images',
    '.pdp-images', '.image-gallery', '.main-image', '#product-gallery'
  ];

  for (const selector of gallerySelectors) {
    const containers = document.querySelectorAll(selector);
    for (const container of containers) {
      const imgElements = container.querySelectorAll('img, picture source, [style*="background-image"]');
      for (const el of imgElements) {
        harvestElementImage(el, result.images);
      }
    }
  }

  // Also query all product page images that look like sneakers
  const allImgs = document.querySelectorAll('img[src], img[data-src], img[data-zoom]');
  for (const img of allImgs) {
    if (isLikelyProductImage(img)) {
      harvestElementImage(img, result.images);
    }
  }
}

function harvestElementImage(el, imageList) {
  if (!el) return;

  // 1. Check data attributes for high-res images
  const candidates = [
    el.getAttribute('data-zoom'),
    el.getAttribute('data-zoom-image'),
    el.getAttribute('data-highres'),
    el.getAttribute('data-large'),
    el.getAttribute('data-large-src'),
    el.getAttribute('data-full'),
    el.getAttribute('data-src'),
    el.getAttribute('data-lazy'),
    el.getAttribute('data-original'),
    el.getAttribute('srcset'),
    el.getAttribute('src'),
  ];

  for (let candidate of candidates) {
    if (!candidate) continue;

    // If candidate is a srcset (e.g. "image-500w.jpg 500w, image-1000w.jpg 1000w")
    if (candidate.includes(',')) {
      const sources = candidate.split(',').map(s => s.trim().split(' ')[0]);
      candidate = sources[sources.length - 1]; // Pick largest
    }

    const cleanUrl = upgradeToHighRes(resolveUrl(candidate));
    if (isValidImageUrl(cleanUrl)) {
      addUniqueImage(imageList, cleanUrl);
      break;
    }
  }

  // 2. Check inline background-image
  if (el.style && el.style.backgroundImage) {
    const match = el.style.backgroundImage.match(/url\(['"]?([^'")]+)['"]?\)/);
    if (match && match[1]) {
      const cleanUrl = upgradeToHighRes(resolveUrl(match[1]));
      if (isValidImageUrl(cleanUrl)) {
        addUniqueImage(imageList, cleanUrl);
      }
    }
  }
}

function upgradeToHighRes(url) {
  if (!url) return '';
  // Try to remove thumbnail downsampling parameters from common CDNs
  let highRes = url
    .replace(/_[0-9]+x[0-9]+(\.[a-z]{3,4})/i, '$1') // e.g. shoe_100x100.jpg -> shoe.jpg
    .replace(/(\/resize\/)[0-9]+x[0-9]+\//i, '$1')
    .replace(/(\?|&)width=[0-9]+/i, '')
    .replace(/(\?|&)w=[0-9]+/i, '')
    .replace(/(\?|&)quality=[0-9]+/i, '')
    .replace(/(\?|&)q=[0-9]+/i, '')
    .replace(/\/thumb\//i, '/large/')
    .replace(/\/small\//i, '/large/');
  
  return highRes;
}

function resolveUrl(url) {
  if (!url) return '';
  if (url.startsWith('//')) return window.location.protocol + url;
  if (url.startsWith('/')) return window.location.origin + url;
  if (!url.startsWith('http')) {
    try {
      return new URL(url, window.location.href).href;
    } catch {
      return url;
    }
  }
  return url;
}

function isValidImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  if (url.startsWith('data:image/svg')) return false; // Ignore SVG placeholders
  if (url.includes('pixel') || url.includes('tracker') || url.includes('beacon') || url.includes('blank.gif')) return false;
  if (url.includes('logo') || url.includes('icon') || url.includes('avatar') || url.includes('sprite')) return false;
  return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image/');
}

function isLikelyProductImage(img) {
  const width = img.naturalWidth || img.width || 0;
  const height = img.naturalHeight || img.height || 0;
  if (width > 0 && width < 120) return false;
  if (height > 0 && height < 120) return false;

  const alt = (img.alt || '').toLowerCase();
  const src = (img.src || '').toLowerCase();
  const className = (img.className || '').toLowerCase();

  // Exclude common noise
  if (src.includes('banner') || src.includes('header') || src.includes('footer') || src.includes('icon')) return false;
  if (className.includes('thumb') && !src.includes('product') && !src.includes('tenis')) return false;

  return true;
}

function addUniqueImage(list, url) {
  if (!url) return;
  const normalized = url.split('?')[0]; // Strip query for uniqueness check
  const exists = list.some(item => item.url.split('?')[0] === normalized);
  if (!exists && list.length < 20) {
    list.push({
      id: list.length + 1,
      url: url,
      selected: true
    });
  }
}

// ── 6. Final Formatting & Category Deduction ──────────────────────────────────
function finalizeData(result) {
  // Clean title
  if (result.title) {
    result.title = result.title
      .replace(/\s*\|\s*.*$/, '') // Strip "| Store Name"
      .replace(/\s*-\s*.*(?:Netshoes|Centauro|Nike|Adidas|Authentic Feet).*$/i, '')
      .trim();
  }

  // Format Price to standard decimal (e.g. 399.90)
  if (result.price) {
    let cleanPrice = String(result.price).replace(/[R$\s]/g, '');
    if (cleanPrice.includes(',') && cleanPrice.includes('.')) {
      // e.g. 1.299,90 -> 1299.90
      cleanPrice = cleanPrice.replace(/\./g, '').replace(',', '.');
    } else if (cleanPrice.includes(',')) {
      // e.g. 499,90 -> 499.90
      cleanPrice = cleanPrice.replace(',', '.');
    }
    const num = parseFloat(cleanPrice);
    result.price = !isNaN(num) && num > 0 ? num.toFixed(2) : '';
  }

  // Deduce sports category based on text keywords
  const fullText = (result.title + ' ' + result.description + ' ' + window.location.href).toLowerCase();
  if (fullText.includes('basquete') || fullText.includes('basketball') || fullText.includes('jordan') || fullText.includes('lebron') || fullText.includes('dunk')) {
    result.category = 'Basquete';
  } else if (fullText.includes('volei') || fullText.includes('vôlei') || fullText.includes('volleyball')) {
    result.category = 'Vôlei';
  } else if (fullText.includes('handball') || fullText.includes('handebol') || fullText.includes('stabil')) {
    result.category = 'Handball';
  } else if (fullText.includes('futsal') || fullText.includes('salão') || fullText.includes('indoor')) {
    result.category = 'Futsal';
  } else if (fullText.includes('futebol') || fullText.includes('campo') || fullText.includes('society') || fullText.includes('chuteira')) {
    result.category = 'Futebol';
  } else {
    result.category = 'Basquete'; // Default sneakers category
  }

  // Truncate description if too long
  if (result.description && result.description.length > 1800) {
    result.description = result.description.slice(0, 1800) + '...';
  }
}

function cleanText(text) {
  if (!text) return '';
  return text.replace(/\s+/g, ' ').replace(/[\n\r\t]/g, ' ').trim();
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'PING') {
    sendResponse({ ready: true, version: '1.2.0' });
    return false;
  }
  if (request.action === 'SCAN_PAGE' || request.action === 'SCAN_PAGE_V2') {
    scanProductPage()
      .then((product) => sendResponse({ success: true, product }))
      .catch((error) => sendResponse({ success: false, error: error?.message || 'Falha ao escanear a página.' }));
    return true;
  }
  return false;
});
