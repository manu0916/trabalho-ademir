// Kicks Store - Sneaker Exporter & Importer Controller

document.addEventListener('DOMContentLoaded', async () => {
  const imageProcessor = globalThis.KicksImageProcessor;
  const colorTranslator = globalThis.KicksColorTranslator;
  const MAX_PRODUCT_IMAGES = 8;
  const CONTENT_SCRIPT_VERSION = '1.2.0';
  if (!imageProcessor) {
    throw new Error('O conversor WebP da extensão não foi carregado. Recarregue a extensão.');
  }

  // Navigation & Views
  const tabScanner = document.getElementById('tabScanner');
  const tabBatch = document.getElementById('tabBatch');
  const tabSettings = document.getElementById('tabSettings');
  const scannerView = document.getElementById('scannerView');
  const batchView = document.getElementById('batchView');
  const settingsView = document.getElementById('settingsView');
  const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');
  
  // Scanner View Elements
  const scanPageBtn = document.getElementById('scanPageBtn');
  const statusMessage = document.getElementById('statusMessage');
  const productForm = document.getElementById('productForm');
  const emptyState = document.getElementById('emptyState');
  const imageGallery = document.getElementById('imageGallery');
  const selectAllImagesBtn = document.getElementById('selectAllImagesBtn');
  const selectedImagesCount = document.getElementById('selectedImagesCount');
  const colorVariantsSection = document.getElementById('colorVariantsSection');
  const colorVariantsList = document.getElementById('colorVariantsList');
  const selectedColorVariantsCount = document.getElementById('selectedColorVariantsCount');
  
  const productNameInput = document.getElementById('productName');
  const productPriceInput = document.getElementById('productPrice');
  const productStockInput = document.getElementById('productStock');
  const productCategoryInput = document.getElementById('productCategory');
  const productDescriptionInput = document.getElementById('productDescription');
  
  const downloadProductJsonBtn = document.getElementById('downloadProductJsonBtn');
  const addToBatchBtn = document.getElementById('addToBatchBtn');
  const copyProductJsonBtn = document.getElementById('copyProductJsonBtn');
  const submitProductBtn = document.getElementById('submitProductBtn');
  
  // Batch View Elements
  const batchCountBadge = document.getElementById('batchCountBadge');
  const batchCountTitle = document.getElementById('batchCountTitle');
  const batchItemsList = document.getElementById('batchItemsList');
  const downloadBatchJsonBtn = document.getElementById('downloadBatchJsonBtn');
  const clearBatchBtn = document.getElementById('clearBatchBtn');

  // Settings View Elements
  const apiUrlInput = document.getElementById('apiUrl');
  const adminEmailInput = document.getElementById('adminEmail');
  const adminPasswordInput = document.getElementById('adminPassword');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  const settingsFeedback = document.getElementById('settingsFeedback');
  const connectionDot = document.getElementById('connectionDot');
  const openStoreLink = document.getElementById('openStoreLink');

  let currentImages = [];
  let currentColorVariants = [];
  let currentScannedMetadata = {};
  let adminToken = null;
  let adminTokenExpiresAt = 0;
  let batchProducts = [];

  // ── 1. Initialization ───────────────────────────────────────────────────────
  try {
    await loadSettings();
  } catch (error) {
    apiUrlInput.value = 'http://localhost:8080';
    showStatus(error.message, 'error');
  }
  try {
    await loadBatch();
  } catch (error) {
    showStatus(error.message, 'error');
  }
  checkApiConnection();

  // Tab Switching
  tabScanner.addEventListener('click', () => switchTab('scanner'));
  tabBatch.addEventListener('click', () => switchTab('batch'));
  tabSettings.addEventListener('click', () => switchTab('settings'));
  toggleSettingsBtn.addEventListener('click', () => switchTab('settings'));

  function switchTab(tab) {
    [tabScanner, tabBatch, tabSettings].forEach(t => t.classList.remove('is-active'));
    [scannerView, batchView, settingsView].forEach(v => v.classList.remove('is-active'));

    if (tab === 'scanner') {
      tabScanner.classList.add('is-active');
      scannerView.classList.add('is-active');
    } else if (tab === 'batch') {
      tabBatch.classList.add('is-active');
      batchView.classList.add('is-active');
      renderBatchView();
    } else {
      tabSettings.classList.add('is-active');
      settingsView.classList.add('is-active');
    }
  }

  // ── 2. Scan Current Webpage ────────────────────────────────────────────────
  scanPageBtn.addEventListener('click', async () => {
    hideStatus();
    scanPageBtn.disabled = true;
    scanPageBtn.innerHTML = '<span class="btn-icon">⏳</span> Escaneando...';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) throw new Error('Nenhuma aba ativa encontrada.');

      await ensureContentScript(tab.id);
      const response = await sendTabMessage(tab.id, { action: 'SCAN_PAGE_V2' });
      if (!response?.success) {
        throw new Error(response?.error || 'Não foi possível escanear esta página. Certifique-se de estar na página de um tênis.');
      }
      populateProduct(response.product);
    } catch (err) {
      showStatus(err.message || 'Erro ao escanear a página.', 'error');
    } finally {
      scanPageBtn.disabled = false;
      scanPageBtn.innerHTML = '<span class="btn-icon">🔍</span> Escanear Tênis Nesta Página';
    }
  });

  async function ensureContentScript(tabId) {
    try {
      const response = await sendTabMessage(tabId, { action: 'PING' });
      if (response?.ready && response.version === CONTENT_SCRIPT_VERSION) return;
    } catch {
      // The script has not been injected in this tab yet.
    }

    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['color-translation.js', 'content.js']
    });
  }

  function sendTabMessage(tabId, message) {
    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabId, message, (response) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(error.message || 'Não foi possível comunicar com a página ativa.'));
          return;
        }
        resolve(response);
      });
    });
  }

  function populateProduct(product) {
    if (!product) return;

    currentScannedMetadata = {
      sourceStore: product.sourceStore || '',
      sourceUrl: product.url || '',
    };

    productNameInput.value = product.title || '';
    productPriceInput.value = product.price || '';
    productStockInput.value = '10';
    if (product.category) productCategoryInput.value = product.category;
    productDescriptionInput.value = product.description || '';

    currentImages = (product.images || []).map((img, index) => ({
      id: index + 1,
      url: typeof img === 'string' ? img : img.url,
      selected: index < MAX_PRODUCT_IMAGES
    }));

    currentColorVariants = (product.variants || []).map((variant, index) => ({
      id: `color-${index + 1}`,
      sourceName: String(variant?.sourceName || variant?.name || '').trim(),
      name: String(variant?.name || '').trim()
        || colorTranslator?.translateColorName?.(variant?.sourceName, index)
        || String(variant?.sourceName || `Cor ${index + 1}`).trim(),
      imageUrl: String(variant?.imageUrl || variant?.images?.[0]?.url || '').trim(),
      images: (variant?.images || [])
        .map((image) => typeof image === 'string' ? image : image?.url)
        .filter(Boolean),
      selected: variant?.selected !== false,
    }));

    renderGallery();
    renderColorVariants();

    emptyState.classList.add('is-hidden');
    productForm.classList.remove('is-hidden');

    const selectedCount = Math.min(currentImages.length, MAX_PRODUCT_IMAGES);
    const limitNotice = currentImages.length > MAX_PRODUCT_IMAGES
      ? ` As ${MAX_PRODUCT_IMAGES} primeiras foram selecionadas, que é o limite aceito pela loja.`
      : '';
    const colorNotice = currentColorVariants.length > 0
      ? ` ${currentColorVariants.length} cor(es) separada(s) e traduzida(s) para português.`
      : ' Nenhuma divisão de cor foi identificada nesta página.';
    showStatus(`Tênis escaneado com sucesso! Encontradas ${currentImages.length} fotos.${limitNotice || ` ${selectedCount} prontas para exportar.`}${colorNotice}`, 'success');
  }

  function renderColorVariants() {
    colorVariantsList.innerHTML = '';
    if (currentColorVariants.length === 0) {
      colorVariantsSection.classList.add('is-hidden');
      selectedColorVariantsCount.textContent = '0';
      return;
    }

    colorVariantsSection.classList.remove('is-hidden');
    for (const variant of currentColorVariants) {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = `color-variant-card ${variant.selected ? 'is-selected' : ''}`;
      card.title = variant.selected ? 'Clique para não exportar esta cor' : 'Clique para exportar esta cor';

      const swatch = document.createElement('span');
      swatch.className = 'color-variant-swatch';
      if (variant.imageUrl) {
        const image = document.createElement('img');
        image.src = variant.imageUrl;
        image.alt = '';
        image.loading = 'lazy';
        image.onerror = () => { swatch.textContent = '🎨'; };
        swatch.appendChild(image);
      } else {
        swatch.textContent = '🎨';
      }

      const copy = document.createElement('span');
      copy.className = 'color-variant-copy';
      const translated = document.createElement('span');
      translated.className = 'color-variant-name';
      translated.textContent = variant.name;
      const source = document.createElement('span');
      source.className = 'color-variant-source';
      source.textContent = variant.sourceName && variant.sourceName !== variant.name
        ? `${variant.sourceName} → ${variant.images.length} foto(s)`
        : `${variant.images.length} foto(s) desta cor`;
      copy.append(translated, source);

      const check = document.createElement('span');
      check.className = 'color-variant-check';
      check.textContent = '✓';
      card.append(swatch, copy, check);
      card.addEventListener('click', () => {
        variant.selected = !variant.selected;
        renderColorVariants();
      });
      colorVariantsList.appendChild(card);
    }
    selectedColorVariantsCount.textContent = String(currentColorVariants.filter((variant) => variant.selected).length);
  }

  // ── 3. Image Gallery Controller ───────────────────────────────────────────
  function renderGallery() {
    imageGallery.innerHTML = '';
    let selectedCount = 0;

    currentImages.forEach((img, idx) => {
      if (img.selected) selectedCount++;

      const card = document.createElement('div');
      card.className = `image-card ${img.selected ? 'is-selected' : ''}`;
      card.title = `Foto ${idx + 1} (Clique para selecionar/desmarcar)`;

      const imageEl = document.createElement('img');
      imageEl.src = img.url;
      imageEl.loading = 'lazy';
      imageEl.onerror = () => {
        card.style.display = 'none';
        img.selected = false;
        updateSelectedCount();
      };

      const checkEl = document.createElement('span');
      checkEl.className = 'image-card-checkbox';
      checkEl.innerHTML = img.selected ? '✓' : '';

      card.appendChild(imageEl);
      card.appendChild(checkEl);

      card.addEventListener('click', () => {
        const selectedTotal = currentImages.filter(item => item.selected).length;
        if (!img.selected && selectedTotal >= MAX_PRODUCT_IMAGES) {
          showStatus(`A loja aceita no máximo ${MAX_PRODUCT_IMAGES} fotos por produto. Desmarque uma foto antes de selecionar outra.`, 'error');
          return;
        }
        img.selected = !img.selected;
        renderGallery();
      });

      imageGallery.appendChild(card);
    });

    selectedImagesCount.textContent = selectedCount;
  }

  function updateSelectedCount() {
    const count = currentImages.filter(img => img.selected).length;
    selectedImagesCount.textContent = count;
  }

  selectAllImagesBtn.addEventListener('click', () => {
    const eligibleImages = currentImages.slice(0, MAX_PRODUCT_IMAGES);
    const allEligibleSelected = eligibleImages.length > 0 && eligibleImages.every(img => img.selected);
    currentImages.forEach((img, index) => {
      img.selected = !allEligibleSelected && index < MAX_PRODUCT_IMAGES;
    });
    renderGallery();
  });

  // ── 4. Build Self-Contained Product Data Object ────────────────────────────
  async function buildCurrentProductData(progressCallback) {
    const name = productNameInput.value.trim();
    const price = parseFloat(productPriceInput.value);
    const stockQuantity = parseInt(productStockInput.value, 10);
    const category = productCategoryInput.value;
    const description = productDescriptionInput.value.trim();
    const selectedImages = currentImages.filter(img => img.selected);

    if (!name) throw new Error('Informe o nome do tênis.');
    if (isNaN(price) || price <= 0) throw new Error('Informe um preço válido.');
    if (isNaN(stockQuantity) || stockQuantity < 0) throw new Error('Informe um estoque válido.');
    if (selectedImages.length === 0) throw new Error('Selecione pelo menos uma foto para a galeria.');

    if (selectedImages.length > MAX_PRODUCT_IMAGES) {
      throw new Error(`A loja aceita no máximo ${MAX_PRODUCT_IMAGES} fotos por produto.`);
    }

    // Download, decode and re-encode every selected image. A URL-only fallback
    // would make the JSON depend on CORS/hotlinking when opened by the store.
    const preparationCache = new Map();
    const prepareImages = async (sources, label) => {
      const uniqueSources = [...new Set(sources.filter(Boolean))].slice(0, MAX_PRODUCT_IMAGES);
      const processed = [];
      for (let i = 0; i < uniqueSources.length; i++) {
        const source = uniqueSources[i];
        progressCallback?.(`Convertendo ${label}: foto ${i + 1} de ${uniqueSources.length} para WebP…`);
        try {
          let prepared = preparationCache.get(source);
          if (!prepared) {
            prepared = await imageProcessor.prepareImageAsWebp(source);
            preparationCache.set(source, prepared);
          }
          processed.push(imageProcessor.createExportImage(prepared, i + 1, source));
        } catch (error) {
          throw new Error(`${label}, foto ${i + 1}: ${error.message} Desmarque esta foto ou tente outra origem.`);
        }
      }
      return processed;
    };

    const processedImages = await prepareImages(selectedImages.map((image) => image.url), 'galeria geral');
    const selectedVariants = currentColorVariants.filter((variant) => variant.selected);
    const colorVariants = [];
    for (let index = 0; index < selectedVariants.length; index++) {
      const variant = selectedVariants[index];
      const variantImages = await prepareImages(variant.images, `cor ${variant.name}`);
      colorVariants.push({
        id: variant.id || `color-${index + 1}`,
        name: variant.name,
        sourceName: variant.sourceName,
        coverImageUrl: variantImages[0]?.dataUrl || processedImages[0]?.dataUrl || '',
        images: variantImages,
      });
    }

    return {
      name,
      price,
      stockQuantity,
      category,
      description,
      sourceStore: currentScannedMetadata.sourceStore || '',
      sourceUrl: currentScannedMetadata.sourceUrl || '',
      coverImageUrl: processedImages[0]?.dataUrl || processedImages[0]?.url || '',
      images: processedImages,
      colorVariants,
    };
  }

  function expandColorwaysForStore(productData) {
    const variants = Array.isArray(productData?.colorVariants) ? productData.colorVariants : [];
    if (variants.length === 0) return [productData];
    return variants.map((variant) => {
      const colorName = String(variant.name || '').trim();
      const images = Array.isArray(variant.images) && variant.images.length > 0
        ? variant.images
        : productData.images;
      return {
        ...productData,
        name: colorName ? `${productData.name} — ${colorName}` : productData.name,
        colorName,
        colorSourceName: variant.sourceName || '',
        coverImageUrl: images?.[0]?.dataUrl || images?.[0]?.url || productData.coverImageUrl,
        images,
        colorVariants: undefined,
      };
    });
  }

  // ── 5. Download Single Sneaker JSON File ───────────────────────────────────
  downloadProductJsonBtn.addEventListener('click', async () => {
    hideStatus();
    downloadProductJsonBtn.disabled = true;
    const originalText = downloadProductJsonBtn.innerHTML;

    try {
      const productData = await buildCurrentProductData((msg) => {
        downloadProductJsonBtn.innerHTML = `<span class="btn-icon">⏳</span> ${msg}`;
      });

      downloadProductJsonBtn.innerHTML = '<span class="btn-icon">💾</span> Gerando arquivo JSON…';

      const filePayload = {
        format: 'kicks-store-product',
        version: '1.2',
        exportedAt: new Date().toISOString(),
        product: productData
      };

      const safeName = productData.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'tenis-kicks';

      const fileName = `kicks-${safeName}.json`;
      downloadJsonFile(filePayload, fileName);

      showStatus(`🎉 Arquivo "${fileName}" baixado com sucesso! Agora basta arrastá-lo para "Importar Arquivo (.JSON)" no Painel Admin da sua Loja!`, 'success');

    } catch (err) {
      showStatus(err.message || 'Erro ao gerar o arquivo do produto.', 'error');
    } finally {
      downloadProductJsonBtn.disabled = false;
      downloadProductJsonBtn.innerHTML = originalText;
    }
  });

  // ── 6. Copy Product JSON to Clipboard ──────────────────────────────────────
  copyProductJsonBtn.addEventListener('click', async () => {
    hideStatus();
    const originalText = copyProductJsonBtn.innerHTML;
    copyProductJsonBtn.disabled = true;

    try {
      const productData = await buildCurrentProductData((msg) => {
        copyProductJsonBtn.innerHTML = `<span class="btn-icon">⏳</span> ${msg}`;
      });

      const filePayload = {
        format: 'kicks-store-product',
        version: '1.2',
        exportedAt: new Date().toISOString(),
        product: productData
      };

      await navigator.clipboard.writeText(JSON.stringify(filePayload, null, 2));
      showStatus('📋 Dados do tênis copiados para a área de transferência!', 'success');
    } catch (err) {
      showStatus(err.message || 'Erro ao copiar JSON.', 'error');
    } finally {
      copyProductJsonBtn.disabled = false;
      copyProductJsonBtn.innerHTML = originalText;
    }
  });

  // ── 7. Batch Queue Management ──────────────────────────────────────────────
  addToBatchBtn.addEventListener('click', async () => {
    hideStatus();
    addToBatchBtn.disabled = true;
    const originalText = addToBatchBtn.innerHTML;

    try {
      const productData = await buildCurrentProductData((msg) => {
        addToBatchBtn.innerHTML = `<span class="btn-icon">⏳</span> ${msg}`;
      });

      const batchItem = {
        id: globalThis.crypto?.randomUUID?.() || String(Date.now()),
        addedAt: new Date().toISOString(),
        ...productData
      };
      batchProducts.push(batchItem);

      try {
        await saveBatch();
      } catch (error) {
        batchProducts = batchProducts.filter(item => item !== batchItem);
        throw error;
      }
      updateBatchBadges();

      showStatus(`✅ "${productData.name}" adicionado ao lote! Total de ${batchProducts.length} tênis no lote.`, 'success');
    } catch (err) {
      showStatus(err.message || 'Erro ao adicionar ao lote.', 'error');
    } finally {
      addToBatchBtn.disabled = false;
      addToBatchBtn.innerHTML = originalText;
    }
  });

  function updateBatchBadges() {
    const count = batchProducts.length;
    batchCountBadge.textContent = count;
    batchCountTitle.textContent = count;
    downloadBatchJsonBtn.disabled = count === 0;
  }

  function renderBatchView() {
    updateBatchBadges();
    batchItemsList.innerHTML = '';

    if (batchProducts.length === 0) {
      batchItemsList.innerHTML = `
        <div class="empty-state" style="padding: 24px 12px;">
          <div class="empty-icon">📦</div>
          <p class="empty-title">O lote está vazio</p>
          <p class="empty-desc">Escaneie tênis na aba Extrator e clique em <b>"Salvar no Lote"</b> para acumular vários modelos.</p>
        </div>
      `;
      return;
    }

    batchProducts.forEach((item, index) => {
      const card = document.createElement('div');
      card.className = 'batch-item-card';

      const thumbUrl = item.coverImageUrl || (item.images && item.images[0]?.dataUrl) || (item.images && item.images[0]?.url) || '';

      card.innerHTML = `
        <div class="batch-item-info">
          ${thumbUrl ? `<img src="${thumbUrl}" alt="" class="batch-item-thumb" />` : ''}
          <div>
            <div class="batch-item-title" title="${item.name}">${item.name}</div>
            <div class="batch-item-meta">R$ ${Number(item.price).toFixed(2)} • ${item.category} • ${item.images?.length || 0} fotos</div>
          </div>
        </div>
        <button type="button" class="batch-item-remove" title="Remover do lote" data-index="${index}">✕</button>
      `;

      card.querySelector('.batch-item-remove').addEventListener('click', async (e) => {
        const idx = parseInt(e.target.getAttribute('data-index'), 10);
        const [removed] = batchProducts.splice(idx, 1);
        try {
          await saveBatch();
          renderBatchView();
        } catch (error) {
          batchProducts.splice(idx, 0, removed);
          showStatus(error.message, 'error');
        }
      });

      batchItemsList.appendChild(card);
    });
  }

  downloadBatchJsonBtn.addEventListener('click', () => {
    if (batchProducts.length === 0) return;

    const filePayload = {
      format: 'kicks-store-catalog',
      version: '1.2',
      exportedAt: new Date().toISOString(),
      count: batchProducts.length,
      items: batchProducts
    };

    const dateStr = new Date().toISOString().slice(0, 10);
    const fileName = `catalogo-kicks-lote-${dateStr}.json`;
    downloadJsonFile(filePayload, fileName);

    showStatus(`🎉 Arquivo de lote "${fileName}" com ${batchProducts.length} tênis baixado com sucesso!`, 'success');
  });

  clearBatchBtn.addEventListener('click', async () => {
    if (batchProducts.length === 0) return;
    if (!confirm('Deseja limpar todos os tênis do lote?')) return;
    const previousBatch = batchProducts;
    batchProducts = [];
    try {
      await saveBatch();
      renderBatchView();
    } catch (error) {
      batchProducts = previousBatch;
      showStatus(error.message, 'error');
    }
  });

  async function loadBatch() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['batchProducts'], (res) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(`Não foi possível carregar o lote salvo: ${error.message}`));
          return;
        }
        batchProducts = Array.isArray(res.batchProducts) ? res.batchProducts : [];
        updateBatchBadges();
        resolve(batchProducts);
      });
    });
  }

  async function saveBatch() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ batchProducts }, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(`Não foi possível salvar o lote na extensão: ${error.message}. Baixe ou limpe o lote atual e tente novamente.`));
          return;
        }
        resolve();
      });
    });
  }

  // ── Helper Download Function ───────────────────────────────────────────────
  function downloadJsonFile(dataObj, fileName) {
    const jsonString = JSON.stringify(dataObj, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ── 8. Direct API Submission (Optional fallback) ───────────────────────────
  submitProductBtn.addEventListener('click', async () => {
    submitProductBtn.disabled = true;
    submitProductBtn.innerHTML = '<span class="btn-icon">⏳</span> Enviando para a API...';
    hideStatus();

    try {
      const productData = await buildCurrentProductData((msg) => {
        submitProductBtn.innerHTML = `<span class="btn-icon">⏳</span> ${msg}`;
      });

      const token = await getOrFetchAdminToken();
      if (!token) throw new Error('Não foi possível autenticar como Administrador no Kicks Store.');
      const settings = await getSettings();
      const productsToCreate = expandColorwaysForStore(productData);
      const createdProducts = [];
      for (let productIndex = 0; productIndex < productsToCreate.length; productIndex++) {
        const colorway = productsToCreate[productIndex];
        submitProductBtn.innerHTML = `<span class="btn-icon">⏳</span> Enviando cor ${productIndex + 1} de ${productsToCreate.length}...`;

        const formData = new FormData();
        formData.append('product', new Blob([JSON.stringify({
          name: colorway.name,
          price: colorway.price,
          stockQuantity: colorway.stockQuantity,
          category: colorway.category,
          description: colorway.description
        })], { type: 'application/json' }));

        for (let imageIndex = 0; imageIndex < colorway.images.length; imageIndex++) {
          const image = colorway.images[imageIndex];
          const imageResponse = await fetch(image.dataUrl);
          const blob = await imageResponse.blob();
          if (blob.type !== imageProcessor.OUTPUT_MIME_TYPE || !(await imageProcessor.hasWebpSignature(blob))) {
            throw new Error(`${colorway.name}, foto ${imageIndex + 1}: os dados preparados não são um WebP válido.`);
          }
          if (blob.size > imageProcessor.MAX_OUTPUT_BYTES) {
            throw new Error(`${colorway.name}, foto ${imageIndex + 1}: o arquivo WebP excede 2 MB.`);
          }
          formData.append('images', blob, image.name || `foto-${imageIndex + 1}.webp`);
        }

        const response = await fetch(`${settings.apiUrl}/api/products`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: formData
        });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || errorData.detail || errorData.error || `Falha ao cadastrar ${colorway.name} (HTTP ${response.status})`);
        }
        createdProducts.push(await response.json());
      }

      const colorNotice = createdProducts.length > 1 ? ` em ${createdProducts.length} divisões de cor` : '';
      showStatus(`🎉 "${productData.name}" cadastrado com sucesso${colorNotice} na Kicks Store!`, 'success');

    } catch (err) {
      showStatus(err.message || 'Erro ao enviar para a API da loja.', 'error');
    } finally {
      submitProductBtn.disabled = false;
      submitProductBtn.innerHTML = '<span class="btn-icon">🚀</span> Enviar Direto para API da Loja';
    }
  });

  // ── 9. Admin Authentication & Token Cache ──────────────────────────────────
  async function getOrFetchAdminToken() {
    const nowEpochSeconds = Math.floor(Date.now() / 1000);
    if (adminToken && adminTokenExpiresAt > nowEpochSeconds + 30) return adminToken;

    const settings = await getSettings();
    if (!settings.adminEmail || !settings.adminPassword) {
      throw new Error('Informe o e-mail e a senha do administrador na aba Conexão API.');
    }

    const loginRes = await fetch(`${settings.apiUrl}/api/admin/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: settings.adminEmail,
        password: settings.adminPassword
      })
    });

    if (!loginRes.ok) {
      throw new Error(`Falha no login admin no Kicks Store (${settings.apiUrl}). Verifique as credenciais na aba Conexão API.`);
    }

    const data = await loginRes.json().catch(() => ({}));
    if (!data.accessToken || typeof data.accessToken !== 'string') {
      throw new Error('A API respondeu sem um token de administrador válido.');
    }
    adminToken = data.accessToken;
    const receivedExpiry = Number(data.expiresAtEpochSeconds);
    adminTokenExpiresAt = Number.isFinite(receivedExpiry) && receivedExpiry > nowEpochSeconds
      ? receivedExpiry
      : nowEpochSeconds + 60;
    return adminToken;
  }

  // ── 10. Settings Actions ───────────────────────────────────────────────────
  saveSettingsBtn.addEventListener('click', async () => {
    try {
      const apiUrl = normalizeApiUrl(apiUrlInput.value);
      const adminEmail = adminEmailInput.value.trim();
      const adminPassword = adminPasswordInput.value;

      await setLocalStorage({ apiUrl, adminEmail, adminPassword });
      adminToken = null;
      adminTokenExpiresAt = 0;
      showSettingsFeedback('Configurações salvas com sucesso!', 'success');
      checkApiConnection();
    } catch (error) {
      showSettingsFeedback(error.message || 'Não foi possível salvar as configurações.', 'error');
    }
  });

  testConnectionBtn.addEventListener('click', async () => {
    showSettingsFeedback('Testando conexão com o back-end...', 'info');
    try {
      adminToken = null;
      adminTokenExpiresAt = 0;
      const token = await getOrFetchAdminToken();
      if (token) {
        showSettingsFeedback('⚡ Conexão estabelecida com sucesso! Autenticado como Administrador.', 'success');
        connectionDot.className = 'status-dot is-online';
      }
    } catch (err) {
      showSettingsFeedback(err.message, 'error');
      connectionDot.className = 'status-dot is-offline';
    }
  });

  async function checkApiConnection() {
    try {
      const settings = await getSettings();
      const res = await fetch(`${settings.apiUrl}/api/products`);
      if (res.ok) {
        connectionDot.className = 'status-dot is-online';
        connectionDot.title = `Conectado a ${settings.apiUrl}`;
      } else {
        connectionDot.className = 'status-dot is-offline';
      }
    } catch {
      connectionDot.className = 'status-dot is-offline';
      connectionDot.title = 'Desconectado da API';
    }
  }

  async function loadSettings() {
    const settings = await getSettings();
    apiUrlInput.value = settings.apiUrl;
    adminEmailInput.value = settings.adminEmail;
    adminPasswordInput.value = settings.adminPassword;
    if (openStoreLink && settings.apiUrl.includes('localhost')) {
      openStoreLink.href = 'http://localhost:5173';
    }
  }

  function getSettings() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(['apiUrl', 'adminEmail', 'adminPassword'], (result) => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(`Não foi possível ler as configurações da extensão: ${error.message}`));
          return;
        }

        let apiUrl;
        try {
          apiUrl = normalizeApiUrl(result.apiUrl || 'http://localhost:8080');
        } catch {
          apiUrl = 'http://localhost:8080';
        }
        resolve({
          apiUrl,
          adminEmail: typeof result.adminEmail === 'string' ? result.adminEmail : '',
          adminPassword: typeof result.adminPassword === 'string' ? result.adminPassword : ''
        });
      });
    });
  }

  function normalizeApiUrl(value) {
    let parsed;
    try {
      parsed = new URL(String(value || '').trim());
    } catch {
      throw new Error('Informe uma URL válida para a API, incluindo http:// ou https://.');
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('A URL da API precisa usar HTTP ou HTTPS.');
    }
    if (parsed.username || parsed.password) {
      throw new Error('Não inclua credenciais dentro da URL da API.');
    }
    parsed.hash = '';
    parsed.search = '';
    return parsed.href.replace(/\/+$/, '');
  }

  function setLocalStorage(values) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(values, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          reject(new Error(`Não foi possível gravar os dados da extensão: ${error.message}`));
          return;
        }
        resolve();
      });
    });
  }

  // ── Helper UI Functions ────────────────────────────────────────────────────
  function showStatus(text, type = 'info') {
    statusMessage.textContent = text;
    statusMessage.className = `status-card is-${type}`;
  }

  function hideStatus() {
    statusMessage.className = 'status-card is-hidden';
  }

  function showSettingsFeedback(text, type = 'info') {
    settingsFeedback.textContent = text;
    settingsFeedback.className = `status-card is-${type}`;
  }
});
