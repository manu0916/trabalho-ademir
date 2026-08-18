// Kicks Store - Sneaker Exporter & Importer Controller

document.addEventListener('DOMContentLoaded', async () => {
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
  let currentScannedMetadata = {};
  let adminToken = null;
  let batchProducts = [];

  // ── 1. Initialization ───────────────────────────────────────────────────────
  await loadSettings();
  await loadBatch();
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

      // Inject content script if needed
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
      } catch {
        // Continue if already injected
      }

      // Send SCAN_PAGE message to content script
      chrome.tabs.sendMessage(tab.id, { action: 'SCAN_PAGE' }, (response) => {
        scanPageBtn.disabled = false;
        scanPageBtn.innerHTML = '<span class="btn-icon">🔍</span> Escanear Tênis Nesta Página';

        if (chrome.runtime.lastError || !response || !response.success) {
          showStatus('Não foi possível escanear esta página. Certifique-se de estar na página de um tênis.', 'error');
          return;
        }

        populateProduct(response.product);
      });
    } catch (err) {
      scanPageBtn.disabled = false;
      scanPageBtn.innerHTML = '<span class="btn-icon">🔍</span> Escanear Tênis Nesta Página';
      showStatus(err.message || 'Erro ao escanear a página.', 'error');
    }
  });

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
      selected: true
    }));

    renderGallery();

    emptyState.classList.add('is-hidden');
    productForm.classList.remove('is-hidden');

    showStatus(`Tênis escaneado com sucesso! Encontradas ${currentImages.length} fotos prontas para exportar.`, 'success');
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
    const allSelected = currentImages.every(img => img.selected);
    currentImages.forEach(img => { img.selected = !allSelected; });
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

    // Fetch and convert images to Base64 data URLs for 100% self-contained JSON
    const processedImages = [];
    for (let i = 0; i < selectedImages.length; i++) {
      const imgItem = selectedImages[i];
      progressCallback?.(`Baixando e processando foto ${i + 1} de ${selectedImages.length}…`);
      
      const dataUrl = await fetchImageAsDataUrl(imgItem.url);
      processedImages.push({
        id: i + 1,
        url: imgItem.url,
        dataUrl: dataUrl || imgItem.url, // Full Base64 or fallback to original URL
        name: `foto-${i + 1}.jpg`
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
      images: processedImages
    };
  }

  async function fetchImageAsDataUrl(url) {
    if (!url) return null;
    if (url.startsWith('data:image/')) return url;

    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const blob = await res.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
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
        version: '1.0',
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
        version: '1.0',
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

      batchProducts.push({
        id: globalThis.crypto?.randomUUID?.() || String(Date.now()),
        addedAt: new Date().toISOString(),
        ...productData
      });

      await saveBatch();
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
        batchProducts.splice(idx, 1);
        await saveBatch();
        renderBatchView();
      });

      batchItemsList.appendChild(card);
    });
  }

  downloadBatchJsonBtn.addEventListener('click', () => {
    if (batchProducts.length === 0) return;

    const filePayload = {
      format: 'kicks-store-catalog',
      version: '1.0',
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
    batchProducts = [];
    await saveBatch();
    renderBatchView();
  });

  async function loadBatch() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['batchProducts'], (res) => {
        batchProducts = Array.isArray(res.batchProducts) ? res.batchProducts : [];
        updateBatchBadges();
        resolve(batchProducts);
      });
    });
  }

  async function saveBatch() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ batchProducts }, () => {
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

      const formData = new FormData();
      const productPayload = {
        name: productData.name,
        price: productData.price,
        stockQuantity: productData.stockQuantity,
        category: productData.category,
        description: productData.description
      };

      formData.append('product', new Blob([JSON.stringify(productPayload)], { type: 'application/json' }));

      for (let i = 0; i < productData.images.length; i++) {
        const img = productData.images[i];
        let blob;
        if (img.dataUrl.startsWith('data:')) {
          const res = await fetch(img.dataUrl);
          blob = await res.blob();
        } else {
          blob = await fetchImageAsBlob(img.url);
        }
        if (blob) {
          const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
          formData.append('images', blob, `shoe-image-${i + 1}.${ext}`);
        }
      }

      const settings = await getSettings();
      const response = await fetch(`${settings.apiUrl}/api/products`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Falha ao cadastrar tênis (HTTP ${response.status})`);
      }

      const created = await response.json();
      showStatus(`🎉 "${created.name}" cadastrado com sucesso na Kicks Store (ID #${created.id})!`, 'success');

    } catch (err) {
      showStatus(err.message || 'Erro ao enviar para a API da loja.', 'error');
    } finally {
      submitProductBtn.disabled = false;
      submitProductBtn.innerHTML = '<span class="btn-icon">🚀</span> Enviar Direto para API da Loja';
    }
  });

  async function fetchImageAsBlob(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.blob();
    } catch {
      return null;
    }
  }

  // ── 9. Admin Authentication & Token Cache ──────────────────────────────────
  async function getOrFetchAdminToken() {
    if (adminToken) return adminToken;

    const settings = await getSettings();
    const loginRes = await fetch(`${settings.apiUrl}/api/admin/auth/login`, {
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

    const data = await loginRes.json();
    adminToken = data.accessToken;
    return adminToken;
  }

  // ── 10. Settings Actions ───────────────────────────────────────────────────
  saveSettingsBtn.addEventListener('click', async () => {
    const apiUrl = apiUrlInput.value.trim().replace(/\/+$/, '');
    const adminEmail = adminEmailInput.value.trim();
    const adminPassword = adminPasswordInput.value.trim();

    await chrome.storage.local.set({ apiUrl, adminEmail, adminPassword });
    adminToken = null;
    showSettingsFeedback('Configurações salvas com sucesso!', 'success');
    checkApiConnection();
  });

  testConnectionBtn.addEventListener('click', async () => {
    showSettingsFeedback('Testando conexão com o back-end...', 'info');
    try {
      adminToken = null;
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
    apiUrlInput.value = settings.apiUrl || 'http://localhost:8080';
    adminEmailInput.value = settings.adminEmail || 'admin@example.test';
    adminPasswordInput.value = settings.adminPassword || 'password1234';
    if (openStoreLink && settings.apiUrl.includes('localhost')) {
      openStoreLink.href = 'http://localhost:5173';
    }
  }

  function getSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['apiUrl', 'adminEmail', 'adminPassword'], (result) => {
        resolve({
          apiUrl: (result.apiUrl || 'http://localhost:8080').replace(/\/+$/, ''),
          adminEmail: result.adminEmail || 'admin@example.test',
          adminPassword: result.adminPassword || 'password1234'
        });
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
