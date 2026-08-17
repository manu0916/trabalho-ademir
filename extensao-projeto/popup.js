// Kicks Store - Popup Controller

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const tabScanner = document.getElementById('tabScanner');
  const tabSettings = document.getElementById('tabSettings');
  const scannerView = document.getElementById('scannerView');
  const settingsView = document.getElementById('settingsView');
  const toggleSettingsBtn = document.getElementById('toggleSettingsBtn');
  
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
  const submitProductBtn = document.getElementById('submitProductBtn');
  
  const apiUrlInput = document.getElementById('apiUrl');
  const adminEmailInput = document.getElementById('adminEmail');
  const adminPasswordInput = document.getElementById('adminPassword');
  const saveSettingsBtn = document.getElementById('saveSettingsBtn');
  const testConnectionBtn = document.getElementById('testConnectionBtn');
  const settingsFeedback = document.getElementById('settingsFeedback');
  const connectionDot = document.getElementById('connectionDot');
  const openStoreLink = document.getElementById('openStoreLink');

  let currentImages = [];
  let adminToken = null;

  // ── 1. Settings Initialization ──────────────────────────────────────────────
  await loadSettings();
  checkApiConnection();

  // Tab Switching
  tabScanner.addEventListener('click', () => switchTab('scanner'));
  tabSettings.addEventListener('click', () => switchTab('settings'));
  toggleSettingsBtn.addEventListener('click', () => switchTab('settings'));

  function switchTab(tab) {
    if (tab === 'scanner') {
      tabScanner.classList.add('is-active');
      tabSettings.classList.remove('is-active');
      scannerView.classList.add('is-active');
      settingsView.classList.remove('is-active');
    } else {
      tabSettings.classList.add('is-active');
      tabScanner.classList.remove('is-active');
      settingsView.classList.add('is-active');
      scannerView.classList.remove('is-active');
    }
  }

  // ── 2. Scan Current Page ──────────────────────────────────────────────────
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
        // Script might already be injected, continue
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

    showStatus(`Tênis escaneado com sucesso! Encontradas ${currentImages.length} fotos.`, 'success');
  }

  // ── 3. Gallery Rendering & Image Selection ─────────────────────────────────
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

  // ── 4. Submit Product to Kicks Store ───────────────────────────────────────
  submitProductBtn.addEventListener('click', async () => {
    const name = productNameInput.value.trim();
    const price = parseFloat(productPriceInput.value);
    const stockQuantity = parseInt(productStockInput.value, 10);
    const category = productCategoryInput.value;
    const description = productDescriptionInput.value.trim();
    const selectedImages = currentImages.filter(img => img.selected);

    if (!name) return showStatus('Informe o nome do tênis.', 'error');
    if (isNaN(price) || price <= 0) return showStatus('Informe um preço válido.', 'error');
    if (isNaN(stockQuantity) || stockQuantity < 0) return showStatus('Informe um estoque válido.', 'error');
    if (selectedImages.length === 0) return showStatus('Selecione pelo menos uma foto para a galeria.', 'error');

    submitProductBtn.disabled = true;
    submitProductBtn.innerHTML = '<span class="btn-icon">⏳</span> Baixando fotos e enviando...';
    hideStatus();

    try {
      // 1. Authenticate with Admin if needed
      const token = await getOrFetchAdminToken();
      if (!token) throw new Error('Não foi possível autenticar como Administrador no Kicks Store.');

      // 2. Fetch and convert all selected images to Blobs
      const imageBlobs = [];
      for (let i = 0; i < selectedImages.length; i++) {
        submitProductBtn.innerHTML = `<span class="btn-icon">⏳</span> Baixando foto ${i + 1}/${selectedImages.length}...`;
        const blob = await fetchImageAsBlob(selectedImages[i].url);
        if (blob) imageBlobs.push(blob);
      }

      if (imageBlobs.length === 0) {
        throw new Error('Não foi possível carregar as imagens selecionadas para envio.');
      }

      // 3. Build Multipart FormData
      submitProductBtn.innerHTML = '<span class="btn-icon">⏳</span> Cadastrando tênis no catálogo...';
      const formData = new FormData();
      
      const productPayload = {
        name,
        price,
        stockQuantity,
        category,
        description
      };

      formData.append('product', new Blob([JSON.stringify(productPayload)], { type: 'application/json' }));

      imageBlobs.forEach((blob, index) => {
        const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
        formData.append('images', blob, `shoe-image-${index + 1}.${ext}`);
      });

      // 4. Send POST to Kicks Store API
      const settings = await getSettings();
      const response = await fetch(`${settings.apiUrl}/api/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Falha ao cadastrar tênis (HTTP ${response.status})`);
      }

      const created = await response.json();
      showStatus(`🎉 Sucesso! "${created.name}" cadastrado na Kicks Store (ID #${created.id}) com ${imageBlobs.length} fotos!`, 'success');
      
      submitProductBtn.disabled = false;
      submitProductBtn.innerHTML = '<span class="btn-icon">🚀</span> Enviar para a Kicks Store';

    } catch (err) {
      console.error(err);
      showStatus(err.message || 'Erro ao enviar produto para a loja.', 'error');
      submitProductBtn.disabled = false;
      submitProductBtn.innerHTML = '<span class="btn-icon">🚀</span> Enviar para a Kicks Store';
    }
  });

  async function fetchImageAsBlob(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Fetch failed');
      return await res.blob();
    } catch {
      // If direct fetch fails (CORS), try converting via canvas or proxy
      return null;
    }
  }

  // ── 5. Admin Authentication & Token Cache ──────────────────────────────────
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

  // ── 6. Settings Actions ────────────────────────────────────────────────────
  saveSettingsBtn.addEventListener('click', async () => {
    const apiUrl = apiUrlInput.value.trim().replace(/\/+$/, '');
    const adminEmail = adminEmailInput.value.trim();
    const adminPassword = adminPasswordInput.value.trim();

    await chrome.storage.local.set({ apiUrl, adminEmail, adminPassword });
    adminToken = null; // Clear cached token
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
