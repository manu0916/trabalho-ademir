// Kicks Store - Universal Sneaker & Product Scraper Engine

function scanProductPage() {
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

  // 4. Extract all gallery and high-res images
  extractAllImages(result);

  // 5. Clean up, format, and deduce category
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
        }
      } catch {
        // Continue to next script
      }
    }
  } catch (e) {
    console.warn('Erro ao processar JSON-LD:', e);
  }
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

// ── 4. Image Harvesting (High Res & Multi-angle) ──────────────────────────────
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

// ── 5. Final Formatting & Category Deduction ──────────────────────────────────
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
  if (request.action === 'SCAN_PAGE') {
    const product = scanProductPage();
    sendResponse({ success: true, product });
  }
  return true;
});
