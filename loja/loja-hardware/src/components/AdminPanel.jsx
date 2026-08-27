import { useCallback, useEffect, useState } from 'react';
import HeroGallerySettings from './HeroGallerySettings';
import FooterSettingsEditor from './FooterSettingsEditor';
import ProductImagePicker from './ProductImagePicker';
import ProductFileImporter from './ProductFileImporter';
import { paymentMethodLabel, paymentStatusMeta } from '../services/paymentStatus';
import { releaseImagePreviewUrls } from '../utils/imagePreparation';
import { PRODUCT_CATEGORIES } from '../utils/catalogCategories';
import {
  fetchAdminSupportMessages,
  updateSupportMessageStatus,
  fetchAdminStockAlerts,
  markStockAlertNotified,
} from '../services/api';

const REFUNDABLE_STATUSES = new Set(['PAID', 'PARTIALLY_REFUNDED', 'REFUND_FAILED', 'FULFILLMENT_REVIEW_REQUIRED']);

function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return 'Valor indisponível';
  const amount = Number(value);
  return Number.isFinite(amount)
    ? amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : 'Valor indisponível';
}

function errorMessage(error, fallback) {
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error?.message) return error.message;
  return fallback;
}

function decimalForCsv(value) {
  if (value === null || value === undefined || value === '') return '';
  const amount = Number(value);
  return Number.isFinite(amount) ? amount.toFixed(2) : '';
}

function revenueFromOrders(orders) {
  let revenue = 0;
  for (const order of orders) {
    if (!order?.paymentVerified) continue;
    const total = Number(order.total);
    const refunded = order.refundedAmount === null || order.refundedAmount === undefined
      ? 0
      : Number(order.refundedAmount);
    if (!Number.isFinite(total) || !Number.isFinite(refunded)) return null;
    revenue += Math.max(0, total - refunded);
  }
  return revenue;
}

function maskCpf(value) {
  const displayedValue = String(value || '').trim();
  if (displayedValue.startsWith('***.')) return displayedValue;
  const digits = displayedValue.replace(/\D/g, '');
  return digits.length === 11 ? `***.***.***-${digits.slice(-2)}` : '***.***.***-**';
}

function formatOrderAddress(order) {
  const streetLine = [order.street, order.addressNumber].filter(Boolean).join(', ');
  const cityLine = [order.city, order.state].filter(Boolean).join('/');
  return [streetLine, order.neighborhood, cityLine, order.postalCode ? `CEP ${order.postalCode}` : '', order.complement]
    .filter(Boolean)
    .join(' - ');
}

function exportOrdersToCsv(orders) {
  if (!orders || orders.length === 0) {
    alert('Não há pedidos registrados para exportar.');
    return;
  }
  const headers = [
    'ID Pedido',
    'Data/Hora',
    'Nome do Cliente',
    'CPF',
    'E-mail',
    'Status Pagamento',
    'Método Pagamento',
    'Provedor Pagamento',
    'Total (R$)',
    'Valor Estornado (R$)',
    'Endereço de Entrega',
    'Itens (Nome | Tamanho | Cor | Qtd | Preço)',
  ];

  const rows = orders.map((order) => {
    const itemsSummary = (order.items || [])
      .map((item) => `${item.productName} (Tam: ${item.shoeSize || '-'}, Cor: ${item.colorVariant || '-'}, Qtd: ${item.quantity}, Preço: ${decimalForCsv(item.unitPrice) ? `R$ ${decimalForCsv(item.unitPrice)}` : 'não informado'})`)
      .join(' ; ');
    const address = formatOrderAddress(order) || 'Não informado';

    return [
      order.id,
      order.createdAt ? new Date(order.createdAt).toLocaleString('pt-BR') : '',
      `"${String(order.fullName || '').replace(/"/g, '""')}"`,
      `"${String(order.cpf || '').replace(/"/g, '""')}"`,
      `"${String(order.email || '').replace(/"/g, '""')}"`,
      order.status || '',
      order.paymentMethod || '',
      order.paymentProvider || '',
      decimalForCsv(order.total),
      decimalForCsv(order.refundedAmount),
      `"${address.replace(/"/g, '""')}"`,
      `"${itemsSummary.replace(/"/g, '""')}"`,
    ].join(';');
  });

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `relatorio_vendas_kicks_store_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function AdminPanel({
  products,
  productsError,
  onRetryProducts,
  heroSettings,
  heroSettingsError,
  onSaveHeroSettings,
  onUploadHeroImages,
  onDeleteHeroImage,
  onAddProduct,
  onDeleteCatalog,
  onUpdateProduct,
  onDeleteProduct,
  orders,
  dashboard,
  dashboardError,
  onRetryDashboard,
  onUpdateStock,
  onRefundOrder,
  onConfirmWhatsappPayment,
  onCancelWhatsappOrder,
  onLogout,
  theme,
  onFooterUpdated,
}) {
  const productList = Array.isArray(products) ? products : null;
  const hasDashboardObject = Boolean(dashboard) && typeof dashboard === 'object' && !Array.isArray(dashboard);
  const dashboardShapeError = hasDashboardObject && !Array.isArray(dashboard.orders)
    ? 'O painel foi carregado sem o histórico de pedidos esperado.'
    : '';
  const dashboardLoadError = dashboardError
    ? errorMessage(dashboardError, 'Não foi possível carregar o resumo administrativo.')
    : dashboardShapeError;
  const productsLoadError = productsError
    ? errorMessage(productsError, 'Não foi possível carregar os produtos cadastrados.')
    : '';
  const displayOrders = Array.isArray(dashboard?.orders)
    ? dashboard.orders
    : Array.isArray(orders)
      ? orders
      : null;
  const hasOrdersData = Array.isArray(displayOrders);
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [category, setCategory] = useState(PRODUCT_CATEGORIES[0]?.id || 'SNKRS');
  const [imageEntries, setImageEntries] = useState([]);
  const [refundErrorByOrder, setRefundErrorByOrder] = useState({});
  const [refundingOrderId, setRefundingOrderId] = useState(null);
  const [whatsappActionOrderId, setWhatsappActionOrderId] = useState(null);
  const [whatsappErrorByOrder, setWhatsappErrorByOrder] = useState({});
  const [stockDraftByProduct, setStockDraftByProduct] = useState({});
  const [stockErrorByProduct, setStockErrorByProduct] = useState({});
  const [updatingStockId, setUpdatingStockId] = useState(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isPreparingProductImages, setIsPreparingProductImages] = useState(false);
  const [productFormError, setProductFormError] = useState('');
  const [productFormMessage, setProductFormMessage] = useState('');
  const [isCatalogDeletionOpen, setIsCatalogDeletionOpen] = useState(false);
  const [catalogDeletionConfirmation, setCatalogDeletionConfirmation] = useState('');
  const [catalogDeletionError, setCatalogDeletionError] = useState('');
  const [catalogDeletionMessage, setCatalogDeletionMessage] = useState('');
  const [isDeletingCatalog, setIsDeletingCatalog] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState(null);

  // Support Messages (SAC / FAQ)
  const [supportMessages, setSupportMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [supportMessagesError, setSupportMessagesError] = useState('');
  const [updatingMessageId, setUpdatingMessageId] = useState(null);
  const [messageFilter, setMessageFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'ANSWERED'

  // Stock Alerts
  const [stockAlerts, setStockAlerts] = useState([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);
  const [stockAlertsError, setStockAlertsError] = useState('');

  const loadMessages = useCallback(async () => {
    setIsLoadingMessages(true);
    setSupportMessagesError('');
    try {
      const list = await fetchAdminSupportMessages();
      if (!Array.isArray(list)) throw new Error('O servidor retornou um formato inesperado para as mensagens.');
      setSupportMessages(list);
    } catch (error) {
      setSupportMessagesError(errorMessage(error, 'Não foi possível carregar as mensagens do suporte.'));
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const loadStockAlerts = useCallback(async () => {
    setIsLoadingAlerts(true);
    setStockAlertsError('');
    try {
      const list = await fetchAdminStockAlerts();
      if (!Array.isArray(list)) throw new Error('O servidor retornou um formato inesperado para os alertas de estoque.');
      setStockAlerts(list);
    } catch (error) {
      setStockAlertsError(errorMessage(error, 'Não foi possível carregar os alertas de estoque.'));
    } finally {
      setIsLoadingAlerts(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
    loadStockAlerts();
  }, [loadMessages, loadStockAlerts]);

  const handleToggleMessageStatus = async (msg) => {
    const nextStatus = msg.status === 'ANSWERED' ? 'PENDING' : 'ANSWERED';
    setUpdatingMessageId(msg.id);
    try {
      const updated = await updateSupportMessageStatus(msg.id, nextStatus);
      setSupportMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, status: updated.status } : m)));
    } catch (err) {
      alert(err.message || 'Não foi possível atualizar o status da mensagem.');
    } finally {
      setUpdatingMessageId(null);
    }
  };

  const handleMarkAlertNotified = async (id) => {
    try {
      await markStockAlertNotified(id);
      loadStockAlerts();
    } catch (err) {
      alert(err.message || 'Erro ao atualizar alerta de estoque.');
    }
  };

  const handleProductSubmit = async (event) => {
    event.preventDefault();
    setProductFormError('');
    setProductFormMessage('');
    const normalizedName = name.trim();
    const normalizedDescription = description.trim();
    const normalizedPrice = Number(price);
    const quantity = Number(stockQuantity);
    if (!normalizedName || !Number.isFinite(normalizedPrice) || normalizedPrice <= 0 || stockQuantity === '' || !category) {
      setProductFormError('Preencha o nome, categoria, um preço válido e o estoque.');
      return;
    }

    const payload = {
      name: normalizedName,
      description: normalizedDescription,
      price: normalizedPrice,
      stockQuantity: Number.isFinite(quantity) ? quantity : 0,
      category,
    };

    const filesToUpload = imageEntries
      .map((entry) => (entry.file ? entry.file : entry))
      .filter((file) => file instanceof File || file instanceof Blob);

    if (!editingId && filesToUpload.length === 0) {
      setProductFormError('Selecione pelo menos uma foto para cadastrar o produto.');
      return;
    }

    setIsSavingProduct(true);
    try {
      if (editingId) {
        if (typeof onUpdateProduct !== 'function') {
          throw new Error('A edição completa de produtos não está disponível nesta API.');
        }
        await onUpdateProduct(editingId, payload, imageEntries);
        setProductFormMessage('Produto atualizado com sucesso.');
      } else {
        if (typeof onAddProduct !== 'function') {
          throw new Error('O cadastro de produtos não está disponível.');
        }
        await onAddProduct(payload, filesToUpload);
        setProductFormMessage('Produto cadastrado com sucesso e publicado na vitrine!');
      }
      resetProductForm();
    } catch (error) {
      setProductFormError(error?.message || 'Não foi possível salvar o produto.');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleFillFormFromImport = (importedData) => {
    releaseImagePreviewUrls(imageEntries);
    setEditingId(null);
    setName(importedData.name || '');
    setDescription(importedData.description || '');
    setPrice(String(importedData.price ?? ''));
    setStockQuantity(String(importedData.stockQuantity ?? '10'));
    setCategory(importedData.category || PRODUCT_CATEGORIES[0]?.id || 'Basquete');
    setImageEntries(importedData.imageEntries || []);
    setProductFormError('');
    setProductFormMessage(`Dados e fotos de "${importedData.name}" carregados no formulário abaixo!`);
  };

  const handleDirectSaveFromImport = async (productPayload, files) => {
    setIsSavingProduct(true);
    try {
      if (typeof onAddProduct !== 'function') {
        throw new Error('O cadastro de produtos não está disponível.');
      }
      await onAddProduct(productPayload, files);
      setProductFormMessage(`Produto "${productPayload.name}" cadastrado com sucesso no catálogo!`);
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleDeleteCatalog = async () => {
    if (catalogDeletionConfirmation !== 'APAGAR CATALOGO' || typeof onDeleteCatalog !== 'function') return;
    setIsDeletingCatalog(true);
    setCatalogDeletionError('');
    setCatalogDeletionMessage('');
    try {
      const result = await onDeleteCatalog(catalogDeletionConfirmation);
      const deletedProducts = Number(result?.deletedProducts || 0);
      setCatalogDeletionMessage(
        deletedProducts === 1
          ? '1 produto foi apagado do catálogo.'
          : `${deletedProducts} produtos foram apagados do catálogo.`,
      );
      setStockAlerts([]);
      setStockAlertsError('');
      setCatalogDeletionConfirmation('');
      setIsCatalogDeletionOpen(false);
    } catch (error) {
      setCatalogDeletionError(error?.message || 'Não foi possível apagar o catálogo.');
    } finally {
      setIsDeletingCatalog(false);
    }
  };

  const handleEdit = (product) => {
    releaseImagePreviewUrls(imageEntries);
    setProductFormError('');
    setProductFormMessage('');
    setEditingId(product.id);
    setName(product.name || '');
    setDescription(product.description || '');
    setPrice(String(product.price ?? ''));
    setStockQuantity(String(product.stockQuantity ?? ''));
    setCategory(product.category || PRODUCT_CATEGORIES[0]?.id || 'SNKRS');
    setImageEntries(
      (product.images || []).map((img, index) => ({
        key: `existing-${img.id || index}`,
        kind: 'existing',
        imageId: img.id,
        imageUrl: img.imageUrl,
        altText: img.altText || '',
        previewUrl: img.imageUrl,
      }))
    );
  };

  const resetProductForm = () => {
    releaseImagePreviewUrls(imageEntries);
    setEditingId(null);
    setName('');
    setDescription('');
    setPrice('');
    setStockQuantity('');
    setCategory(PRODUCT_CATEGORIES[0]?.id || 'SNKRS');
    setImageEntries([]);
  };

  const handleDeleteSingleProduct = async (product) => {
    if (!product) return;
    const confirmed = window.confirm(
      `Tem certeza que deseja excluir "${product.name}" do catálogo?\nFotos, estoque e avaliações deste modelo serão excluídos permanentemente.`,
    );
    if (!confirmed) return;
    setDeletingProductId(product.id);
    try {
      if (typeof onDeleteProduct === 'function') {
        await onDeleteProduct(product.id);
      }
      if (editingId === product.id) {
        resetProductForm();
      }
    } catch (error) {
      alert(error?.message || 'Não foi possível excluir o produto.');
    } finally {
      setDeletingProductId(null);
    }
  };

  const handleRefundSubmit = async (orderId) => {
    if (typeof onRefundOrder !== 'function') return;
    const confirmed = window.confirm(
      `Confirmar o estorno do pagamento do pedido #${orderId}? A solicitação será enviada ao provedor de pagamento e não pode ser desfeita pelo painel.`,
    );
    if (!confirmed) return;
    setRefundErrorByOrder((prev) => ({ ...prev, [orderId]: null }));
    setRefundingOrderId(orderId);
    try {
      await onRefundOrder(orderId);
    } catch (error) {
      setRefundErrorByOrder((prev) => ({
        ...prev,
        [orderId]: errorMessage(error, 'Falha ao processar o estorno.'),
      }));
    } finally {
      setRefundingOrderId(null);
    }
  };

  const handleStockUpdate = async (product) => {
    const draft = stockDraftByProduct[product.id] ?? product.stockQuantity;
    const quantity = Number(draft);
    setStockErrorByProduct((previous) => ({ ...previous, [product.id]: '' }));
    if (!Number.isInteger(quantity) || quantity < 0) {
      setStockErrorByProduct((previous) => ({
        ...previous,
        [product.id]: 'Informe uma quantidade inteira maior ou igual a zero.',
      }));
      return;
    }
    if (typeof onUpdateStock !== 'function') {
      setStockErrorByProduct((previous) => ({
        ...previous,
        [product.id]: 'A atualização de estoque não está disponível.',
      }));
      return;
    }

    setUpdatingStockId(product.id);
    try {
      await onUpdateStock(product.id, quantity);
      setStockDraftByProduct((previous) => ({ ...previous, [product.id]: String(quantity) }));
    } catch (error) {
      setStockErrorByProduct((previous) => ({
        ...previous,
        [product.id]: error?.message || 'Não foi possível atualizar o estoque.',
      }));
    } finally {
      setUpdatingStockId(null);
    }
  };

  const handleWhatsappAction = async (orderId, action) => {
    if (typeof action !== 'function') return;
    setWhatsappErrorByOrder((previous) => ({ ...previous, [orderId]: '' }));
    setWhatsappActionOrderId(orderId);
    try {
      await action(orderId);
    } catch (error) {
      setWhatsappErrorByOrder((previous) => ({
        ...previous,
        [orderId]: error?.message || 'Não foi possível atualizar o pedido.',
      }));
    } finally {
      setWhatsappActionOrderId(null);
    }
  };

  const dashboardRevenue = dashboard?.revenue === null || dashboard?.revenue === undefined || dashboard?.revenue === ''
    ? null
    : Number(dashboard.revenue);
  const totalRevenue = Number.isFinite(dashboardRevenue)
    ? dashboardRevenue
    : hasOrdersData
      ? revenueFromOrders(displayOrders)
      : null;
  const filteredSupportMessages = supportMessages.filter((message) => (
    messageFilter === 'ALL' || message.status === messageFilter
  ));
  const supportMessagesReady = !isLoadingMessages && !supportMessagesError;

  return (
    <div data-theme={theme} className="admin-container mx-auto max-w-[90rem] px-4 py-8 sm:px-6 sm:py-10 space-y-12">
      {/* Header & Quick Export */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center pb-6 border-b border-[var(--line)]">
        <div>
          <p className="section-kicker">Gestão Kicks Store</p>
          <h1 className="text-3xl font-black text-[var(--text)]">Painel do Administrador</h1>
          {dashboardLoadError ? (
            <AdminLoadError
              className="mt-3"
              title="Resumo administrativo indisponível"
              error={dashboardLoadError}
              onRetry={onRetryDashboard}
            />
          ) : hasOrdersData && totalRevenue !== null ? (
            <p className="text-xs text-[var(--muted)] mt-1">
              Faturamento aprovado: <strong className="text-emerald-500 text-sm">{formatCurrency(totalRevenue)}</strong> ({displayOrders.length} {displayOrders.length === 1 ? 'pedido registrado' : 'pedidos registrados'})
            </p>
          ) : hasOrdersData ? (
            <p role="status" className="text-xs text-[var(--muted)] mt-1">
              Faturamento indisponível ({displayOrders.length} {displayOrders.length === 1 ? 'pedido registrado' : 'pedidos registrados'}).
            </p>
          ) : (
            <p role="status" className="text-xs text-[var(--muted)] mt-1">Carregando faturamento e pedidos…</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => exportOrdersToCsv(displayOrders)}
            disabled={!hasOrdersData || displayOrders.length === 0 || Boolean(dashboardLoadError)}
            className="buy-button px-4 py-2.5 rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-45"
          >
            📊 Baixar Relatório de Vendas (.CSV / Excel)
          </button>
          {typeof onLogout === 'function' && (
            <button
              type="button"
              onClick={onLogout}
              className="px-4 py-2.5 rounded-xl text-xs font-bold border border-[var(--line)] bg-[var(--surface)] text-[var(--text)]"
            >
              Sair
            </button>
          )}
        </div>
      </div>

      <HeroGallerySettings
        settings={heroSettings}
        products={productList || []}
        settingsError={heroSettingsError}
        onSave={onSaveHeroSettings}
        onUpload={onUploadHeroImages}
        onDelete={onDeleteHeroImage}
      />

      {/* JSON File Importer */}
      <ProductFileImporter
        onFillForm={handleFillFormFromImport}
        onDirectSave={handleDirectSaveFromImport}
        isSaving={isSavingProduct}
      />

      {/* Product Form */}
      <section className="admin-section rounded-3xl p-6 sm:p-8 bg-[var(--surface-solid)] border border-[var(--line)]">
        <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <p className="section-kicker">Catálogo</p>
            <h2 className="text-xl font-extrabold text-[var(--text)]">{editingId ? 'Editar Tênis' : 'Cadastrar Novo Modelo'}</h2>
          </div>
          {editingId && (
            <button type="button" onClick={resetProductForm} className="text-xs font-semibold text-[var(--accent)] hover:underline">
              Cancelar Edição
            </button>
          )}
        </div>

        {productFormError && <div className="mb-4 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-500 border border-rose-500/20">{productFormError}</div>}
        {productFormMessage && <div className="mb-4 rounded-xl bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-500 border border-emerald-500/20">{productFormMessage}</div>}

        <form onSubmit={handleProductSubmit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do Modelo:">
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Travis Scott x Air Jordan 1 Low" className={inputClass} required />
            </Field>
            <Field label="Categoria / Modalidade:">
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
                {PRODUCT_CATEGORIES.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.label}</option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Descrição Detalhada:">
            <textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes do material, amortecimento, estilo e história do sneaker..." className={inputClass} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Preço à Vista (R$):">
              <input type="number" step="0.01" min="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="1299.90" className={inputClass} required />
            </Field>
            <Field label="Quantidade Total em Estoque:">
              <input type="number" min="0" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} placeholder="15" className={inputClass} required />
            </Field>
          </div>

          <div>
            <span className="block text-xs font-medium text-[var(--muted)] mb-2">Fotos do Produto (Galeria de 1 a 8 imagens):</span>
            <ProductImagePicker
              entries={imageEntries}
              onChange={setImageEntries}
              onPreparingChange={setIsPreparingProductImages}
              disabled={isSavingProduct}
            />
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={isSavingProduct || isPreparingProductImages}
              className="buy-button px-6 py-3 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40"
            >
              {isSavingProduct ? 'Salvando produto...' : editingId ? 'Atualizar Modelo' : 'Salvar e Publicar na Vitrine'}
            </button>
            {editingId && typeof onDeleteProduct === 'function' && (
              <button
                type="button"
                disabled={isSavingProduct || deletingProductId === editingId}
                onClick={() => {
                  const current = productList?.find((p) => p.id === editingId);
                  handleDeleteSingleProduct(current || { id: editingId, name });
                }}
                className="px-5 py-3 rounded-xl text-xs font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 cursor-pointer disabled:opacity-40 transition-all flex items-center gap-1.5"
              >
                {deletingProductId === editingId ? 'Excluindo...' : '🗑️ Excluir Este Modelo'}
              </button>
            )}
          </div>
        </form>

        {/* Existing Products List */}
        <div className="mt-8 border-t border-[var(--line)] pt-6">
          <h3 className="text-sm font-bold text-[var(--text)] mb-4">
            Modelos cadastrados{!productsLoadError && productList ? ` (${productList.length})` : ''}
          </h3>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {productsLoadError ? (
              <AdminLoadError
                title="Catálogo administrativo indisponível"
                error={productsLoadError}
                onRetry={onRetryProducts}
              />
            ) : !productList ? (
              <p role="status" className="py-5 text-center text-xs text-[var(--muted)]">Carregando produtos cadastrados…</p>
            ) : productList.length === 0 ? (
              <p role="status" className="py-5 text-center text-xs text-[var(--muted)]">Nenhum produto cadastrado.</p>
            ) : productList.map((prod) => (
              <div key={prod.id} className="flex flex-col gap-3 bg-[var(--bg)] p-3 rounded-xl border border-[var(--line)] text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <img src={prod.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover border border-[var(--line)] bg-[var(--surface-solid)]" />
                  <div className="min-w-0">
                    <span className="font-bold text-[var(--text)] block">{prod.name}</span>
                    <span className="text-[11px] text-[var(--muted)]">
                      R$ {Number(prod.price).toFixed(2)} • Estoque: {prod.stockQuantity} un
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {typeof onUpdateStock === 'function' && (
                    <div>
                      <div className="flex items-center gap-2">
                        <label className="sr-only" htmlFor={`stock-${prod.id}`}>Estoque de {prod.name}</label>
                        <input
                          id={`stock-${prod.id}`}
                          type="number"
                          min="0"
                          step="1"
                          value={stockDraftByProduct[prod.id] ?? prod.stockQuantity}
                          onChange={(event) => setStockDraftByProduct((previous) => ({
                            ...previous,
                            [prod.id]: event.target.value,
                          }))}
                          className="w-20 rounded-lg bg-[var(--surface-solid)] px-2 py-1 text-xs text-[var(--text)] border border-[var(--line)]"
                        />
                        <button
                          type="button"
                          disabled={updatingStockId === prod.id}
                          onClick={() => handleStockUpdate(prod)}
                          className="px-3 py-1 rounded-lg bg-[var(--surface)] text-[var(--text)] font-semibold border border-[var(--line)] disabled:opacity-50"
                        >
                          {updatingStockId === prod.id ? 'Salvando...' : 'Atualizar estoque'}
                        </button>
                      </div>
                      {stockErrorByProduct[prod.id] && (
                        <p className="mt-1 text-[10px] text-rose-500">{stockErrorByProduct[prod.id]}</p>
                      )}
                    </div>
                  )}
                  {typeof onUpdateProduct === 'function' && (
                    <button type="button" onClick={() => handleEdit(prod)} className="px-3 py-1 rounded-lg bg-[var(--surface)] text-[var(--text)] font-semibold hover:border-[var(--accent)] border border-[var(--line)]">
                      Editar
                    </button>
                  )}
                  {typeof onDeleteProduct === 'function' && (
                    <button
                      type="button"
                      disabled={deletingProductId === prod.id}
                      onClick={() => handleDeleteSingleProduct(prod)}
                      className="px-3 py-1 rounded-lg text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 font-semibold cursor-pointer disabled:opacity-50 transition-all text-xs flex items-center gap-1"
                      title={`Excluir ${prod.name}`}
                    >
                      {deletingProductId === prod.id ? 'Excluindo...' : '🗑️ Excluir'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {catalogDeletionMessage && (
            <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-800" role="status">
              {catalogDeletionMessage}
            </p>
          )}

          {typeof onDeleteCatalog === 'function' && productList && productList.length > 0 && (
            <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50/70 p-4">
              {!isCatalogDeletionOpen ? (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <strong className="block text-sm text-rose-900">Zona de perigo</strong>
                    <span className="mt-1 block text-xs leading-relaxed text-rose-700">
                      Apaga todos os produtos, fotos, avaliações e alertas. O histórico de pedidos será preservado.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogDeletionError('');
                      setCatalogDeletionMessage('');
                      setIsCatalogDeletionOpen(true);
                    }}
                    className="shrink-0 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-extrabold text-rose-700 hover:bg-rose-100"
                  >
                    Apagar catálogo inteiro
                  </button>
                </div>
              ) : (
                <div role="group" aria-labelledby="catalog-deletion-title">
                  <strong id="catalog-deletion-title" className="block text-sm text-rose-900">
                    Esta ação não pode ser desfeita
                  </strong>
                  <p className="mt-1 text-xs leading-relaxed text-rose-700">
                    Para confirmar a exclusão de {productList.length} {productList.length === 1 ? 'produto' : 'produtos'}, digite <strong>APAGAR CATALOGO</strong>.
                  </p>
                  <label className="mt-3 block text-xs font-bold text-rose-900" htmlFor="catalog-deletion-confirmation">
                    Confirmação
                  </label>
                  <input
                    id="catalog-deletion-confirmation"
                    type="text"
                    autoComplete="off"
                    spellCheck="false"
                    value={catalogDeletionConfirmation}
                    onChange={(event) => setCatalogDeletionConfirmation(event.target.value)}
                    disabled={isDeletingCatalog}
                    placeholder="APAGAR CATALOGO"
                    className="mt-1 w-full rounded-xl border border-rose-300 bg-white px-3 py-2 text-sm font-semibold text-[var(--text)] outline-none focus:ring-2 focus:ring-rose-300 disabled:opacity-60"
                  />
                  {catalogDeletionError && (
                    <p className="mt-2 text-xs font-semibold text-rose-700" role="alert">{catalogDeletionError}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteCatalog}
                      disabled={isDeletingCatalog || catalogDeletionConfirmation !== 'APAGAR CATALOGO'}
                      className="rounded-xl bg-rose-700 px-4 py-2 text-xs font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isDeletingCatalog ? 'Apagando catálogo...' : `Apagar ${productList.length} ${productList.length === 1 ? 'produto' : 'produtos'}`}
                    </button>
                    <button
                      type="button"
                      disabled={isDeletingCatalog}
                      onClick={() => {
                        setCatalogDeletionConfirmation('');
                        setCatalogDeletionError('');
                        setIsCatalogDeletionOpen(false);
                      }}
                      className="rounded-xl border border-[var(--line)] bg-white px-4 py-2 text-xs font-bold text-[var(--text)] disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Footer Settings Editor */}
      <FooterSettingsEditor onFooterUpdated={onFooterUpdated} />

      {/* Stock Alerts (Avise-me quando chegar) */}
      <section className="admin-section rounded-3xl p-6 sm:p-8 bg-[var(--surface-solid)] border border-[var(--line)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="section-kicker">Demanda de Clientes</p>
            <h2 className="text-xl font-extrabold text-[var(--text)]">
              Alertas de produtos esgotados{!isLoadingAlerts && !stockAlertsError ? ` (${stockAlerts.length})` : ''}
            </h2>
          </div>
          <span className="text-xs text-[var(--muted)]">Clientes aguardando produtos esgotados</span>
        </div>

        <div className="space-y-3">
          {isLoadingAlerts ? (
            <p role="status" className="py-4 text-center text-xs text-[var(--muted)]">Carregando alertas de estoque…</p>
          ) : stockAlertsError ? (
            <AdminLoadError
              title="Alertas de estoque indisponíveis"
              error={stockAlertsError}
              onRetry={loadStockAlerts}
            />
          ) : stockAlerts.length === 0 ? (
            <p role="status" className="py-4 text-center text-xs text-[var(--muted)]">Nenhum alerta para produtos esgotados no momento.</p>
          ) : (
            stockAlerts.map((alert) => {
              const productName = alert.productName || 'Produto não informado';
              const variant = [alert.size ? `Tam ${alert.size}` : '', alert.color || ''].filter(Boolean).join(' • ');
              const requestedAt = formatDateOnly(alert.createdAt);
              const hasDetails = Boolean(alert.email || alert.whatsapp || requestedAt);
              const emailSubject = `O ${productName}${alert.size ? ` (Tam ${alert.size})` : ''} voltou à Kicks Store`;
              return (
                <div key={alert.id} className="flex flex-col gap-3 bg-[var(--bg)] p-3.5 rounded-xl border border-[var(--line)] text-xs sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-[var(--text)]">{productName}</span>
                      {variant && (
                        <span className="bg-[var(--surface)] px-2 py-0.5 rounded text-[11px] font-bold text-[var(--accent)] border border-[var(--line)]">
                          {variant}
                        </span>
                      )}
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${alert.status === 'NOTIFIED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                        {alert.status === 'NOTIFIED' ? '✓ Notificado' : '⏳ Aguardando reposição'}
                      </span>
                    </div>
                    {hasDetails && (
                      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-[var(--muted)]">
                        {alert.email && <span>E-mail: <strong>{alert.email}</strong></span>}
                        {alert.whatsapp && <span>WhatsApp: <strong>{alert.whatsapp}</strong></span>}
                        {requestedAt && <span>Solicitado em {requestedAt}</span>}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {alert.email && (
                      <a
                        href={`mailto:${encodeURIComponent(alert.email)}?subject=${encodeURIComponent(emailSubject)}`}
                        className="buy-button px-3 py-1 rounded-lg text-xs font-bold"
                      >
                        ✉ Notificar cliente
                      </a>
                    )}
                    {alert.status === 'PENDING' && (
                      <button
                        type="button"
                        onClick={() => handleMarkAlertNotified(alert.id)}
                        className="px-2.5 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)] font-semibold"
                      >
                        Marcar como feito
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Orders List */}
      <section className="admin-section rounded-3xl p-6 sm:p-8 bg-[var(--surface-solid)] border border-[var(--line)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="section-kicker">Histórico</p>
            <h2 className="text-xl font-extrabold text-[var(--text)]">
              Pedidos &amp; logística{!dashboardLoadError && hasOrdersData ? ` (${displayOrders.length})` : ''}
            </h2>
          </div>
        </div>

        <div className="space-y-4">
          {dashboardLoadError ? (
            <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-600">
              O histórico de pedidos está indisponível porque o resumo administrativo não foi carregado.
            </p>
          ) : !hasOrdersData ? (
            <p role="status" className="py-8 text-center text-xs text-[var(--muted)]">Carregando pedidos…</p>
          ) : displayOrders.length === 0 ? (
            <p role="status" className="py-8 text-center text-xs text-[var(--muted)]">Nenhum pedido registrado.</p>
          ) : (
            displayOrders.map((order) => {
              const meta = paymentStatusMeta(order.status);
              const isRefundable = order.paymentProvider === 'STRIPE'
                && REFUNDABLE_STATUSES.has(order.status)
                && typeof onRefundOrder === 'function';
              const isWhatsappPending = order.paymentProvider === 'WHATSAPP'
                && order.status === 'PENDING_PAYMENT';
              const canConfirmWhatsapp = isWhatsappPending
                && order.canConfirmWhatsapp === true
                && typeof onConfirmWhatsappPayment === 'function';
              const canCancelWhatsapp = isWhatsappPending
                && order.canCancelWhatsapp === true
                && typeof onCancelWhatsappOrder === 'function';
              const orderAddress = formatOrderAddress(order);
              const createdAt = formatDateTime(order.createdAt);

              return (
                <article key={order.id} className="order-card rounded-2xl p-5 bg-[var(--bg)] border border-[var(--line)]">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-[var(--text)] text-sm">Pedido #{order.id}</span>
                        <span className="text-xs text-[var(--muted)]">{createdAt || 'Data indisponível'}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.badgeClass || 'bg-[var(--surface)] text-[var(--text)]'}`}>
                          {meta.label || order.status}
                        </span>
                        <span className="text-[10px] font-semibold bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--line)] text-[var(--muted)]">
                          {paymentMethodLabel(order.paymentMethod)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Cliente: <strong className="text-[var(--text)]">{order.fullName}</strong> {order.cpf && `(CPF: ${maskCpf(order.cpf)})`}
                      </p>
                      {order.email && <p className="mt-1 text-xs text-[var(--muted)]">E-mail: {order.email}</p>}
                      {orderAddress && <p className="mt-1 text-xs text-[var(--muted)]">Entrega: {orderAddress}</p>}
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-black text-[var(--accent)] block">
                        {formatCurrency(order.total)}
                      </span>
                      {Number(order.refundedAmount || 0) > 0 && (
                        <span className="text-[10px] text-[var(--muted)]">Estornado: {formatCurrency(order.refundedAmount)}</span>
                      )}
                    </div>
                  </div>

                  {/* Items list with variant details */}
                  <div className="mt-3 rounded-xl bg-[var(--surface-solid)] p-3 border border-[var(--line)]/50 text-xs space-y-1.5">
                    <span className="font-bold text-[var(--muted)] block text-[11px] uppercase tracking-wide">Itens do Pedido:</span>
                    {(order.items || []).map((item, index) => {
                      const variant = [
                        item.shoeSize ? `Tam: ${item.shoeSize}` : '',
                        item.colorVariant ? `Cor: ${item.colorVariant}` : '',
                      ].filter(Boolean).join(' • ');
                      return (
                        <div key={`${item.productName}-${index}`} className="flex items-center justify-between gap-3 text-[var(--text)]">
                          <span>
                            {item.quantity}x <strong>{item.productName}</strong>
                            {variant && (
                              <span className="text-[var(--accent)] font-semibold ml-1.5">[{variant}]</span>
                            )}
                          </span>
                          <span className="font-bold">{formatCurrency(item.unitPrice)}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions (WhatsApp manual confirm / Refunds) */}
                  {(canConfirmWhatsapp || canCancelWhatsapp) && (
                    <div className="mt-3 flex gap-2">
                      {canConfirmWhatsapp && (
                        <button
                          type="button"
                          disabled={whatsappActionOrderId === order.id}
                          onClick={() => handleWhatsappAction(order.id, onConfirmWhatsappPayment)}
                          className="buy-button px-3.5 py-1.5 rounded-xl text-xs font-bold disabled:opacity-50"
                        >
                          ✓ Confirmar Pagamento WhatsApp
                        </button>
                      )}
                      {canCancelWhatsapp && (
                        <button
                          type="button"
                          disabled={whatsappActionOrderId === order.id}
                          onClick={() => handleWhatsappAction(order.id, onCancelWhatsappOrder)}
                          className="px-3 py-1.5 rounded-xl text-xs text-rose-500 font-semibold border border-rose-500/20 disabled:opacity-50"
                        >
                          Cancelar Pedido
                        </button>
                      )}
                    </div>
                  )}
                  {whatsappErrorByOrder[order.id] && (
                    <p className="mt-1 text-xs text-rose-500">{whatsappErrorByOrder[order.id]}</p>
                  )}

                  {isRefundable && (
                    <div className="mt-3 flex flex-col gap-2 pt-2 border-t border-[var(--line)]/50 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-[11px] text-[var(--muted)]">O estorno será solicitado diretamente ao provedor de pagamento.</p>
                      <button
                        type="button"
                        disabled={refundingOrderId === order.id}
                        onClick={() => handleRefundSubmit(order.id)}
                        className="refund-button px-3.5 py-1.5 rounded-xl text-xs font-semibold text-rose-500 border border-rose-500/30 hover:bg-rose-500/10 disabled:cursor-wait disabled:opacity-50"
                      >
                        {refundingOrderId === order.id ? 'Estornando...' : 'Estornar Pagamento'}
                      </button>
                    </div>
                  )}
                  {refundErrorByOrder[order.id] && (
                    <p className="mt-1 text-xs text-rose-500">{refundErrorByOrder[order.id]}</p>
                  )}
                </article>
              );
            })
          )}
        </div>
      </section>

      {/* Support Messages (SAC / FAQ) */}
      <section className="admin-section rounded-3xl p-6 sm:p-8 bg-[var(--surface-solid)] border border-[var(--line)]">
        <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="section-kicker">Atendimento ao Cliente (SAC)</p>
            <h2 className="text-xl font-extrabold text-[var(--text)]">Mensagens &amp; Dúvidas dos Clientes</h2>
          </div>
          <div className="flex items-center gap-2">
            {['ALL', 'PENDING', 'ANSWERED'].map((filter) => (
              <button
                key={filter}
                type="button"
                disabled={!supportMessagesReady}
                onClick={() => setMessageFilter(filter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${messageFilter === filter ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]' : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'}`}
              >
                {filter === 'ALL'
                  ? supportMessagesReady ? `Todas (${supportMessages.length})` : 'Todas'
                  : filter === 'PENDING'
                    ? supportMessagesReady ? `Pendentes (${supportMessages.filter((message) => message.status === 'PENDING').length})` : 'Pendentes'
                    : supportMessagesReady ? `Respondidas (${supportMessages.filter((message) => message.status === 'ANSWERED').length})` : 'Respondidas'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {isLoadingMessages ? (
            <p role="status" className="py-8 text-center text-xs text-[var(--muted)]">Carregando mensagens do suporte…</p>
          ) : supportMessagesError ? (
            <AdminLoadError
              title="Mensagens do suporte indisponíveis"
              error={supportMessagesError}
              onRetry={loadMessages}
            />
          ) : filteredSupportMessages.length === 0 ? (
            <p className="empty-state py-8 text-center text-xs text-[var(--muted)]">Nenhuma mensagem encontrada neste filtro.</p>
          ) : (
            filteredSupportMessages
              .map((msg) => {
                const isPending = msg.status === 'PENDING';
                return (
                  <article key={msg.id} className="order-card rounded-2xl p-5 bg-[var(--bg)] border border-[var(--line)]">
                    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full ${isPending ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'}`}>
                            {isPending ? '⏳ Pendente' : '✓ Respondida'}
                          </span>
                          <span className="text-xs text-[var(--muted)]">
                            {formatDateTime(msg.createdAt) || 'Data indisponível'}
                          </span>
                        </div>
                        <h3 className="mt-2 text-base font-bold text-[var(--text)]">{msg.subject}</h3>
                        <p className="mt-0.5 text-xs text-[var(--muted)]">
                          De: <strong className="text-[var(--text)]">{msg.fullName}</strong> ({msg.email})
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 sm:pt-0">
                        <a
                          href={`mailto:${encodeURIComponent(msg.email)}?subject=${encodeURIComponent(`Re: ${msg.subject} - Kicks Store`)}`}
                          className="buy-button inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
                        >
                          ✉ Responder por E-mail
                        </a>
                        <button
                          type="button"
                          disabled={updatingMessageId === msg.id}
                          onClick={() => handleToggleMessageStatus(msg)}
                          className="refund-button px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer disabled:opacity-50 border border-[var(--line)] bg-[var(--surface-solid)] text-[var(--text)]"
                        >
                          {updatingMessageId === msg.id ? 'Atualizando...' : isPending ? 'Marcar como respondida' : 'Reabrir como pendente'}
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl bg-[var(--surface-solid)] p-4 border border-[var(--line)] text-xs text-[var(--text)] whitespace-pre-line leading-relaxed">
                      {msg.message}
                    </div>
                  </article>
                );
              })
          )}
        </div>
      </section>
    </div>
  );
}

const inputClass = 'admin-input w-full rounded-xl px-4 py-2.5 text-sm bg-[var(--surface-solid)] border border-[var(--line)] text-[var(--text)] focus:border-[var(--accent)] outline-none';
function Field({ label, children }) {
  return (
    <label className="block flex-1 text-xs font-medium text-[var(--muted)]">
      {label}
      <span className="mt-1.5 block">{children}</span>
    </label>
  );
}

function AdminLoadError({ title, error, onRetry, className = '' }) {
  return (
    <div role="alert" className={`rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-600 ${className}`}>
      <strong className="block font-extrabold">{title}</strong>
      <p className="mt-1">{error}</p>
      {typeof onRetry === 'function' && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 min-h-9 rounded-lg border border-rose-500/30 bg-[var(--surface-solid)] px-3 font-bold text-rose-600"
        >
          Tentar novamente
        </button>
      )}
    </div>
  );
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(value) {
  return validDate(value)?.toLocaleDateString('pt-BR') || '';
}

function formatDateTime(value) {
  return validDate(value)?.toLocaleString('pt-BR') || '';
}
