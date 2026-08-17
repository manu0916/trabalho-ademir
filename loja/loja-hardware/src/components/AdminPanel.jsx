import { useCallback, useEffect, useState } from 'react';
import HeroGallerySettings from './HeroGallerySettings';
import ProductImagePicker from './ProductImagePicker';
import { paymentMethodLabel, paymentStatusMeta } from '../services/paymentStatus';
import { releaseImagePreviewUrls } from '../utils/imagePreparation';
import { PRODUCT_CATEGORIES } from '../utils/catalogCategories';
import {
  fetchAdminSupportMessages,
  updateSupportMessageStatus,
  fetchAdminCoupons,
  createAdminCoupon,
  toggleAdminCoupon,
  deleteAdminCoupon,
  fetchAdminStockAlerts,
  markStockAlertNotified,
} from '../services/api';

const REFUNDABLE_STATUSES = new Set(['PAID', 'PARTIALLY_REFUNDED', 'REFUND_FAILED', 'FULFILLMENT_REVIEW_REQUIRED']);

function formatCurrency(value) {
  return Number(value ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function maskCpf(value) {
  const displayedValue = String(value || '').trim();
  if (displayedValue.startsWith('***.')) return displayedValue;
  const digits = displayedValue.replace(/\D/g, '');
  return digits.length === 11 ? `***.***.***-${digits.slice(-2)}` : '***.***.***-**';
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
    'Telefone/WhatsApp',
    'Status Pagamento',
    'Método Pagamento',
    'Total (R$)',
    'Endereço de Entrega',
    'Itens (Nome | Tamanho | Cor | Qtd | Preço)',
  ];

  const rows = orders.map((order) => {
    const itemsSummary = (order.items || [])
      .map((item) => `${item.productName || item.name} (Tam: ${item.size || item.selectedSize || '-'}, Cor: ${item.color || item.selectedColor || '-'}, Qtd: ${item.quantity}, R$ ${Number(item.price || 0).toFixed(2)})`)
      .join(' ; ');

    const address = order.shippingAddress
      ? `${order.shippingAddress.street || ''}, ${order.shippingAddress.addressNumber || ''} - ${order.shippingAddress.neighborhood || ''}, ${order.shippingAddress.city || ''}/${order.shippingAddress.state || ''} - CEP ${order.shippingAddress.postalCode || ''}`
      : 'Não informado';

    return [
      order.id,
      order.createdAt ? new Date(order.createdAt).toLocaleString('pt-BR') : '',
      `"${(order.customerName || order.customer?.name || '').replace(/"/g, '""')}"`,
      `"${(order.customerCpf || order.customer?.cpf || '').replace(/"/g, '""')}"`,
      `"${(order.customerEmail || order.customer?.email || '').replace(/"/g, '""')}"`,
      `"${(order.customerPhone || order.customerWhatsapp || '').replace(/"/g, '""')}"`,
      order.paymentStatus || order.status || '',
      order.paymentMethod || '',
      Number(order.totalAmount || order.total || 0).toFixed(2),
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
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  orders = [],
  onRefundOrder,
  onApproveWhatsappOrder,
  onCancelWhatsappOrder,
}) {
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('');
  const [category, setCategory] = useState(PRODUCT_CATEGORIES[0]?.id || 'SNKRS');
  const [imageEntries, setImageEntries] = useState([]);
  const [refundReasonByOrder, setRefundReasonByOrder] = useState({});
  const [refundErrorByOrder, setRefundErrorByOrder] = useState({});
  const [refundingOrderId, setRefundingOrderId] = useState(null);
  const [whatsappActionOrderId, setWhatsappActionOrderId] = useState(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isPreparingProductImages, setIsPreparingProductImages] = useState(false);
  const [productFormError, setProductFormError] = useState('');
  const [productFormMessage, setProductFormMessage] = useState('');

  // Support Messages (SAC / FAQ)
  const [supportMessages, setSupportMessages] = useState([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [updatingMessageId, setUpdatingMessageId] = useState(null);
  const [messageFilter, setMessageFilter] = useState('ALL'); // 'ALL' | 'PENDING' | 'ANSWERED'

  // Discount Coupons
  const [coupons, setCoupons] = useState([]);
  const [isLoadingCoupons, setIsLoadingCoupons] = useState(false);
  const [newCouponCode, setNewCouponCode] = useState('');
  const [newCouponDiscountPercent, setNewCouponDiscountPercent] = useState('');
  const [newCouponDiscountAmount, setNewCouponDiscountAmount] = useState('');
  const [newCouponMinOrder, setNewCouponMinOrder] = useState('');
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [isCreatingCoupon, setIsCreatingCoupon] = useState(false);

  // Stock Alerts
  const [stockAlerts, setStockAlerts] = useState([]);
  const [isLoadingAlerts, setIsLoadingAlerts] = useState(false);

  const loadMessages = useCallback(async () => {
    setIsLoadingMessages(true);
    try {
      const list = await fetchAdminSupportMessages();
      if (Array.isArray(list)) setSupportMessages(list);
    } catch {
      // ignore
    } finally {
      setIsLoadingMessages(false);
    }
  }, []);

  const loadCoupons = useCallback(async () => {
    setIsLoadingCoupons(true);
    try {
      const list = await fetchAdminCoupons();
      if (Array.isArray(list)) setCoupons(list);
    } catch {
      // ignore
    } finally {
      setIsLoadingCoupons(false);
    }
  }, []);

  const loadStockAlerts = useCallback(async () => {
    setIsLoadingAlerts(true);
    try {
      const list = await fetchAdminStockAlerts();
      if (Array.isArray(list)) setStockAlerts(list);
    } catch {
      // ignore
    } finally {
      setIsLoadingAlerts(false);
    }
  }, []);

  useEffect(() => {
    loadMessages();
    loadCoupons();
    loadStockAlerts();
  }, [loadMessages, loadCoupons, loadStockAlerts]);

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

  const handleCreateCoupon = async (e) => {
    e.preventDefault();
    setCouponError('');
    setCouponSuccess('');
    if (!newCouponCode.trim()) {
      setCouponError('Informe o código do cupom.');
      return;
    }
    const percent = newCouponDiscountPercent ? Number(newCouponDiscountPercent) : null;
    const amount = newCouponDiscountAmount ? Number(newCouponDiscountAmount) : null;
    if (!percent && !amount) {
      setCouponError('Defina uma porcentagem (%) ou um valor fixo em R$ de desconto.');
      return;
    }

    setIsCreatingCoupon(true);
    try {
      await createAdminCoupon({
        code: newCouponCode.trim().toUpperCase(),
        discountPercent: percent,
        discountAmount: amount,
        minOrderValue: newCouponMinOrder ? Number(newCouponMinOrder) : 0,
      });
      setCouponSuccess(`Cupom ${newCouponCode.toUpperCase()} criado com sucesso!`);
      setNewCouponCode('');
      setNewCouponDiscountPercent('');
      setNewCouponDiscountAmount('');
      setNewCouponMinOrder('');
      loadCoupons();
    } catch (err) {
      setCouponError(err.message || 'Não foi possível criar o cupom.');
    } finally {
      setIsCreatingCoupon(false);
    }
  };

  const handleToggleCoupon = async (id) => {
    try {
      await toggleAdminCoupon(id);
      loadCoupons();
    } catch (err) {
      alert(err.message || 'Erro ao alterar status do cupom.');
    }
  };

  const handleDeleteCoupon = async (id) => {
    if (!window.confirm('Tem certeza que deseja excluir este cupom de desconto?')) return;
    try {
      await deleteAdminCoupon(id);
      loadCoupons();
    } catch (err) {
      alert(err.message || 'Erro ao excluir cupom.');
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

    setIsSavingProduct(true);
    try {
      if (editingId) {
        await onUpdateProduct(editingId, payload, imageEntries);
        setProductFormMessage('Produto atualizado com sucesso.');
      } else {
        await onAddProduct(payload, imageEntries);
        setProductFormMessage('Produto cadastrado com sucesso.');
      }
      resetProductForm();
    } catch (error) {
      setProductFormError(error?.message || 'Não foi possível salvar o produto.');
    } finally {
      setIsSavingProduct(false);
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

  const handleRefundSubmit = async (orderId) => {
    const reason = refundReasonByOrder[orderId] || '';
    setRefundErrorByOrder((prev) => ({ ...prev, [orderId]: null }));
    setRefundingOrderId(orderId);
    try {
      await onRefundOrder(orderId, reason);
      setRefundReasonByOrder((prev) => ({ ...prev, [orderId]: '' }));
    } catch (error) {
      setRefundErrorByOrder((prev) => ({ ...prev, [orderId]: error.message || 'Falha ao processar estorno' }));
    } finally {
      setRefundingOrderId(null);
    }
  };

  const totalRevenue = orders.reduce((sum, o) => {
    const status = o.paymentStatus || o.status;
    return status === 'PAID' || status === 'COMPLETED' ? sum + Number(o.totalAmount || o.total || 0) : sum;
  }, 0);

  return (
    <div className="admin-container mx-auto max-w-[90rem] px-4 py-8 sm:px-6 sm:py-10 space-y-12">
      {/* Header & Quick Export */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center pb-6 border-b border-[var(--line)]">
        <div>
          <p className="section-kicker">Gestão Kicks Store</p>
          <h1 className="text-3xl font-black text-[var(--text)]">Painel do Administrador</h1>
          <p className="text-xs text-[var(--muted)] mt-1">
            Faturamento Aprovado: <strong className="text-emerald-500 text-sm">{formatCurrency(totalRevenue)}</strong> ({orders.length} pedidos registrados)
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => exportOrdersToCsv(orders)}
            className="buy-button px-4 py-2.5 rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
          >
            📊 Baixar Relatório de Vendas (.CSV / Excel)
          </button>
        </div>
      </div>

      <HeroGallerySettings />

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

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSavingProduct || isPreparingProductImages}
              className="buy-button px-6 py-3 rounded-xl text-xs font-bold cursor-pointer disabled:opacity-40"
            >
              {isSavingProduct ? 'Salvando produto...' : editingId ? 'Atualizar Modelo' : 'Salvar e Publicar na Vitrine'}
            </button>
          </div>
        </form>

        {/* Existing Products List */}
        <div className="mt-8 border-t border-[var(--line)] pt-6">
          <h3 className="text-sm font-bold text-[var(--text)] mb-4">Modelos Cadastrados ({products.length})</h3>
          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {products.map((prod) => (
              <div key={prod.id} className="flex items-center justify-between bg-[var(--bg)] p-3 rounded-xl border border-[var(--line)] text-xs">
                <div className="flex items-center gap-3">
                  <img src={prod.imageUrl} alt="" className="h-10 w-10 rounded-lg object-cover border border-[var(--line)]" />
                  <div>
                    <span className="font-bold text-[var(--text)] block">{prod.name}</span>
                    <span className="text-[11px] text-[var(--muted)]">
                      R$ {Number(prod.price).toFixed(2)} • Estoque: {prod.stockQuantity} un
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => handleEdit(prod)} className="px-3 py-1 rounded-lg bg-[var(--surface)] text-[var(--text)] font-semibold hover:border-[var(--accent)] border border-[var(--line)]">
                    Editar
                  </button>
                  <button type="button" onClick={() => onDeleteProduct(prod.id)} className="px-3 py-1 rounded-lg text-rose-500 font-semibold hover:underline">
                    Excluir
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Discount Coupons Management */}
      <section className="admin-section rounded-3xl p-6 sm:p-8 bg-[var(--surface-solid)] border border-[var(--line)]">
        <div className="mb-6">
          <p className="section-kicker">Marketing &amp; Promoções</p>
          <h2 className="text-xl font-extrabold text-[var(--text)]">Gerenciador de Cupons de Desconto</h2>
        </div>

        {couponError && <div className="mb-4 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-500 border border-rose-500/20">{couponError}</div>}
        {couponSuccess && <div className="mb-4 rounded-xl bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-500 border border-emerald-500/20">{couponSuccess}</div>}

        <form onSubmit={handleCreateCoupon} className="grid gap-3 sm:grid-cols-5 items-end bg-[var(--bg)] p-4 rounded-2xl border border-[var(--line)]">
          <Field label="Código do Cupom:">
            <input
              type="text"
              value={newCouponCode}
              onChange={(e) => setNewCouponCode(e.target.value.toUpperCase())}
              placeholder="Ex: KICKS10"
              className={inputClass}
              required
            />
          </Field>
          <Field label="Desconto (%):">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={newCouponDiscountPercent}
              onChange={(e) => setNewCouponDiscountPercent(e.target.value)}
              placeholder="Ex: 10"
              className={inputClass}
            />
          </Field>
          <Field label="Ou Desconto Fixo (R$):">
            <input
              type="number"
              step="0.01"
              min="0"
              value={newCouponDiscountAmount}
              onChange={(e) => setNewCouponDiscountAmount(e.target.value)}
              placeholder="Ex: 50.00"
              className={inputClass}
            />
          </Field>
          <Field label="Pedido Mínimo (R$):">
            <input
              type="number"
              step="0.01"
              min="0"
              value={newCouponMinOrder}
              onChange={(e) => setNewCouponMinOrder(e.target.value)}
              placeholder="Ex: 200.00"
              className={inputClass}
            />
          </Field>
          <div>
            <button
              type="submit"
              disabled={isCreatingCoupon}
              className="buy-button w-full py-2.5 rounded-xl text-xs font-bold disabled:opacity-40"
            >
              {isCreatingCoupon ? 'Criando...' : '+ Criar Cupom'}
            </button>
          </div>
        </form>

        {/* Coupons List */}
        <div className="mt-6 space-y-2">
          {isLoadingCoupons ? (
            <p className="py-4 text-center text-xs text-[var(--muted)]">Carregando cupons...</p>
          ) : coupons.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--muted)]">Nenhum cupom cadastrado ainda.</p>
          ) : (
            coupons.map((c) => (
              <div key={c.id} className="flex items-center justify-between bg-[var(--bg)] p-3 rounded-xl border border-[var(--line)] text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-[var(--accent)] text-sm">{c.code}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${c.active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                      {c.active ? 'Ativo' : 'Desativado'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)] mt-0.5">
                    {c.discountPercent ? `${c.discountPercent}% OFF` : `R$ ${Number(c.discountAmount).toFixed(2)} OFF`}
                    {c.minOrderValue > 0 && ` • Mínimo R$ ${Number(c.minOrderValue).toFixed(2)}`}
                    {` • Utilizado ${c.usedCount || 0} vezes`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleCoupon(c.id)}
                    className="px-3 py-1 rounded-lg text-xs font-semibold border border-[var(--line)] bg-[var(--surface)] text-[var(--text)]"
                  >
                    {c.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteCoupon(c.id)}
                    className="px-2.5 py-1 text-xs text-rose-500 hover:underline font-semibold"
                  >
                    Excluir
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Stock Alerts (Avise-me quando chegar) */}
      <section className="admin-section rounded-3xl p-6 sm:p-8 bg-[var(--surface-solid)] border border-[var(--line)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="section-kicker">Demanda de Clientes</p>
            <h2 className="text-xl font-extrabold text-[var(--text)]">Alertas de Reposição de Estoque ({stockAlerts.length})</h2>
          </div>
          <span className="text-xs text-[var(--muted)]">Clientes aguardando numerações esgotadas</span>
        </div>

        <div className="space-y-3">
          {isLoadingAlerts ? (
            <p className="py-4 text-center text-xs text-[var(--muted)]">Carregando alertas de estoque...</p>
          ) : stockAlerts.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--muted)]">Nenhum cliente aguardando reposição de estoque no momento.</p>
          ) : (
            stockAlerts.map((alert) => (
              <div key={alert.id} className="flex items-center justify-between bg-[var(--bg)] p-3.5 rounded-xl border border-[var(--line)] text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--text)]">{alert.productName}</span>
                    <span className="bg-[var(--surface)] px-2 py-0.5 rounded text-[11px] font-bold text-[var(--accent)] border border-[var(--line)]">
                      Tam {alert.size} • {alert.color}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${alert.status === 'NOTIFIED' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                      {alert.status === 'NOTIFIED' ? '✓ Notificado' : '⏳ Aguardando Reposição'}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--muted)] mt-1">
                    E-mail: <strong>{alert.email}</strong> {alert.whatsapp && `• WhatsApp: ${alert.whatsapp}`} • Solicitado em {new Date(alert.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={`mailto:${encodeURIComponent(alert.email)}?subject=${encodeURIComponent(`O ${alert.productName} (Tam ${alert.size}) Chegou na Kicks Store!`)}`}
                    className="buy-button px-3 py-1 rounded-lg text-xs font-bold"
                  >
                    ✉ Notificar Cliente
                  </a>
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
            ))
          )}
        </div>
      </section>

      {/* Orders List */}
      <section className="admin-section rounded-3xl p-6 sm:p-8 bg-[var(--surface-solid)] border border-[var(--line)]">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="section-kicker">Histórico</p>
            <h2 className="text-xl font-extrabold text-[var(--text)]">Pedidos &amp; Logística ({orders.length})</h2>
          </div>
        </div>

        <div className="space-y-4">
          {orders.length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--muted)]">Nenhum pedido realizado ainda.</p>
          ) : (
            orders.map((order) => {
              const meta = paymentStatusMeta(order.paymentStatus || order.status);
              const isRefundable = REFUNDABLE_STATUSES.has(order.paymentStatus || order.status);
              const isWhatsappPending = order.paymentMethod === 'WHATSAPP' && (order.paymentStatus === 'PENDING' || order.status === 'PENDING');

              return (
                <article key={order.id} className="order-card rounded-2xl p-5 bg-[var(--bg)] border border-[var(--line)]">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-[var(--text)] text-sm">Pedido #{order.id}</span>
                        <span className="text-xs text-[var(--muted)]">{order.createdAt ? new Date(order.createdAt).toLocaleString('pt-BR') : 'Recente'}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${meta.badgeClass || 'bg-[var(--surface)] text-[var(--text)]'}`}>
                          {meta.label || order.paymentStatus || order.status}
                        </span>
                        <span className="text-[10px] font-semibold bg-[var(--surface)] px-2 py-0.5 rounded border border-[var(--line)] text-[var(--muted)]">
                          {paymentMethodLabel(order.paymentMethod)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Cliente: <strong className="text-[var(--text)]">{order.customerName || 'Cliente'}</strong> {order.customerCpf && `(CPF: ${maskCpf(order.customerCpf)})`}
                      </p>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-black text-[var(--accent)] block">
                        {formatCurrency(order.totalAmount || order.total)}
                      </span>
                    </div>
                  </div>

                  {/* Items list with variant details */}
                  <div className="mt-3 rounded-xl bg-[var(--surface-solid)] p-3 border border-[var(--line)]/50 text-xs space-y-1.5">
                    <span className="font-bold text-[var(--muted)] block text-[11px] uppercase tracking-wide">Itens do Pedido:</span>
                    {(order.items || []).map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between text-[var(--text)]">
                        <span>
                          {it.quantity}x <strong>{it.productName || it.name}</strong>
                          <span className="text-[var(--accent)] font-semibold ml-1.5">
                            [Tam: {it.size || it.selectedSize || '40'} • Cor: {it.color || it.selectedColor || 'Original'}]
                          </span>
                        </span>
                        <span className="font-bold">{formatCurrency(it.price)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Actions (WhatsApp manual confirm / Refunds) */}
                  {isWhatsappPending && (
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={whatsappActionOrderId === order.id}
                        onClick={async () => {
                          setWhatsappActionOrderId(order.id);
                          try {
                            await onApproveWhatsappOrder?.(order.id);
                          } finally {
                            setWhatsappActionOrderId(null);
                          }
                        }}
                        className="buy-button px-3.5 py-1.5 rounded-xl text-xs font-bold"
                      >
                        ✓ Confirmar Pagamento WhatsApp
                      </button>
                      <button
                        type="button"
                        disabled={whatsappActionOrderId === order.id}
                        onClick={async () => {
                          setWhatsappActionOrderId(order.id);
                          try {
                            await onCancelWhatsappOrder?.(order.id);
                          } finally {
                            setWhatsappActionOrderId(null);
                          }
                        }}
                        className="px-3 py-1.5 rounded-xl text-xs text-rose-500 font-semibold border border-rose-500/20"
                      >
                        Cancelar Pedido
                      </button>
                    </div>
                  )}

                  {isRefundable && (
                    <div className="mt-3 flex items-center gap-2 pt-2 border-t border-[var(--line)]/50">
                      <input
                        type="text"
                        placeholder="Motivo do estorno (opcional)..."
                        value={refundReasonByOrder[order.id] || ''}
                        onChange={(e) => setRefundReasonByOrder((prev) => ({ ...prev, [order.id]: e.target.value }))}
                        className="flex-1 rounded-xl bg-[var(--surface-solid)] px-3 py-1.5 text-xs text-[var(--text)] border border-[var(--line)]"
                      />
                      <button
                        type="button"
                        disabled={refundingOrderId === order.id}
                        onClick={() => handleRefundSubmit(order.id)}
                        className="refund-button px-3.5 py-1.5 rounded-xl text-xs font-semibold text-rose-500 border border-rose-500/30 hover:bg-rose-500/10"
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
                onClick={() => setMessageFilter(filter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors ${messageFilter === filter ? 'bg-[var(--accent)] text-[var(--accent-ink)] border-[var(--accent)]' : 'border-[var(--line)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]'}`}
              >
                {filter === 'ALL' ? `Todas (${supportMessages.length})` : filter === 'PENDING' ? `Pendentes (${supportMessages.filter((m) => m.status === 'PENDING').length})` : `Respondidas (${supportMessages.filter((m) => m.status === 'ANSWERED').length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {isLoadingMessages ? (
            <p className="py-8 text-center text-xs text-[var(--muted)]">Carregando mensagens do suporte...</p>
          ) : supportMessages.filter((m) => messageFilter === 'ALL' || m.status === messageFilter).length === 0 ? (
            <p className="empty-state py-8 text-center text-xs text-[var(--muted)]">Nenhuma mensagem encontrada neste filtro.</p>
          ) : (
            supportMessages
              .filter((m) => messageFilter === 'ALL' || m.status === messageFilter)
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
                            {msg.createdAt ? new Date(msg.createdAt).toLocaleString('pt-BR') : 'Recente'}
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
