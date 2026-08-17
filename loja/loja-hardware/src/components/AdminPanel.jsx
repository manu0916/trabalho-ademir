import { useState } from 'react';
import HeroGallerySettings from './HeroGallerySettings';
import ProductImagePicker from './ProductImagePicker';
import { paymentMethodLabel, paymentStatusMeta } from '../services/paymentStatus';
import { releaseImagePreviewUrls } from '../utils/imagePreparation';
import { PRODUCT_CATEGORIES } from '../utils/catalogCategories';

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

function refundableBalance(order) {
  return Math.max(0, Number(order?.total ?? 0) - Number(order?.refundedAmount ?? 0));
}

function canRefundOrder(order) {
  const status = String(order?.status || '').toUpperCase();
  const paymentMethod = String(order?.paymentMethod || '').toUpperCase();
  return String(order?.paymentProvider || '').toUpperCase() === 'STRIPE'
    && order?.paymentVerified === true
    && paymentMethod !== 'BOLETO'
    && REFUNDABLE_STATUSES.has(status)
    && refundableBalance(order) > 0;
}

export default function AdminPanel({
  onAddProduct,
  onLogout,
  dashboard,
  onUpdateStock,
  onRefundOrder,
  onConfirmWhatsappPayment,
  onCancelWhatsappOrder,
  theme,
  products,
  heroSettings,
  heroSettingsError,
  onSaveHeroSettings,
  onUploadHeroImages,
  onDeleteHeroImage,
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('0');
  const [category, setCategory] = useState('');
  const [productImages, setProductImages] = useState([]);
  const [stockDrafts, setStockDrafts] = useState({});
  const [updatingProductId, setUpdatingProductId] = useState(null);
  const [refundingOrderId, setRefundingOrderId] = useState(null);
  const [whatsappActionOrderId, setWhatsappActionOrderId] = useState(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);
  const [isPreparingProductImages, setIsPreparingProductImages] = useState(false);
  const [productFormError, setProductFormError] = useState('');
  const [productFormMessage, setProductFormMessage] = useState('');

  const handleProductSubmit = async (event) => {
    event.preventDefault();
    setProductFormError('');
    setProductFormMessage('');
    const normalizedName = name.trim();
    const normalizedDescription = description.trim();
    const normalizedPrice = Number(price);
    const quantity = Number(stockQuantity);
    if (!normalizedName || !Number.isFinite(normalizedPrice) || normalizedPrice <= 0 || stockQuantity === '' || !category) {
      setProductFormError('Preencha nome, categoria, preço e estoque antes de cadastrar o tênis.');
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      setProductFormError('O estoque deve ser um número inteiro igual ou maior que zero.');
      return;
    }
    if (productImages.length === 0) {
      setProductFormError('Selecione pelo menos uma foto para a galeria do tênis.');
      return;
    }
    if (isSavingProduct || isPreparingProductImages) return;
    setIsSavingProduct(true);
    try {
      await onAddProduct(
        {
          name: normalizedName,
          description: normalizedDescription,
          price: normalizedPrice,
          stockQuantity: quantity,
          category,
        },
        productImages.map((image) => image.file),
      );
      releaseImagePreviewUrls(productImages);
      setName('');
      setDescription('');
      setPrice('');
      setStockQuantity('0');
      setCategory('');
      setProductImages([]);
      setProductFormMessage(`Tênis cadastrado em ${category} com a galeria de fotos.`);
    } catch (error) {
      setProductFormError(error.message || 'Não foi possível salvar o produto.');
    } finally {
      setIsSavingProduct(false);
    }
  };

  const handleStockUpdate = async (product) => {
    const quantity = Number(stockDrafts[product.id] ?? product.stockQuantity);
    if (!Number.isInteger(quantity) || quantity < 0) return alert('Informe uma quantidade inteira igual ou maior que zero.');
    setUpdatingProductId(product.id);
    try { await onUpdateStock(product.id, quantity); } catch (error) { alert(error.message || 'Não foi possível atualizar o estoque.'); } finally { setUpdatingProductId(null); }
  };
  const handleRefund = async (order) => {
    const balance = formatCurrency(refundableBalance(order));
    if (!window.confirm(`Confirmar o reembolso do saldo de ${balance} do pedido #${order.id}? A solicitação não pode ser desfeita neste painel.`)) return;
    setRefundingOrderId(order.id);
    try {
      await onRefundOrder(order.id);
    } catch (error) {
      alert(error.message || 'Não foi possível solicitar o reembolso.');
    } finally {
      setRefundingOrderId(null);
    }
  };

  const handleConfirmWhatsappPayment = async (order) => {
    if (!window.confirm(`Confirmar que o pagamento do pedido #${order.id} (${formatCurrency(order.total)}) foi recebido? O estoque será consolidado e o pedido marcado como PAGO.`)) return;
    setWhatsappActionOrderId(order.id);
    try {
      await onConfirmWhatsappPayment(order.id);
    } catch (error) {
      alert(error.message || 'Não foi possível confirmar o pagamento.');
    } finally {
      setWhatsappActionOrderId(null);
    }
  };

  const handleCancelWhatsappOrder = async (order) => {
    if (!window.confirm(`Cancelar o pedido #${order.id} e liberar o estoque reservado? Esta ação não pode ser desfeita.`)) return;
    setWhatsappActionOrderId(order.id);
    try {
      await onCancelWhatsappOrder(order.id);
    } catch (error) {
      alert(error.message || 'Não foi possível cancelar o pedido.');
    } finally {
      setWhatsappActionOrderId(null);
    }
  };
  const stats = [
    ['Produtos vendidos', dashboard?.productsSold ?? 0], ['Contas criadas', dashboard?.accountsCreated ?? 0],
    ['Valor vendido', `R$ ${Number(dashboard?.revenue ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`], ['Produtos cadastrados', dashboard?.registeredProducts ?? 0],
  ];

  return (
    <div className="admin-panel mx-auto max-w-6xl space-y-8 px-4 py-8 sm:px-6">
      <div className="admin-panel-header flex items-end justify-between gap-4"><div><p className="section-kicker">Área restrita · {theme.edition}</p><h1 className="section-title text-3xl">Painel da loja</h1><p className="mt-3 max-w-lg text-sm leading-6 text-[var(--muted)]">Uma visão clara da operação, sem tirar a personalidade da sua marca.</p></div><button type="button" onClick={onLogout} className="logout-button cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold">Sair</button></div>
      <section className="admin-overview"><div className="admin-section-heading"><span>01</span><h2>Resumo da loja</h2></div><div className="admin-stats-grid">{stats.map(([label, value], index) => <div key={label} className="stat-card rounded-2xl p-5"><span className="stat-index">0{index + 1}</span><p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p><p className="stat-value mt-2 text-2xl font-extrabold">{value}</p><p className="mt-1 text-xs text-[var(--muted)]">Atualizado em tempo real</p></div>)}</div></section>

      <HeroGallerySettings
        settings={heroSettings}
        products={products}
        settingsError={heroSettingsError}
        onSave={onSaveHeroSettings}
        onUpload={onUploadHeroImages}
        onDelete={onDeleteHeroImage}
      />

      <section className="admin-card admin-product-card rounded-2xl p-6">
        <div className="mb-5">
          <p className="section-kicker">03 · Novo item</p>
          <h2 className="mt-1 text-2xl font-bold text-[var(--text)]">Adicionar tênis</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">Escolha a modalidade do tênis, adicione a galeria e defina a capa pela ordem das fotos.</p>
        </div>
        <form onSubmit={handleProductSubmit} className="space-y-5" aria-busy={isSavingProduct || isPreparingProductImages}>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Nome do tênis">
              <input required disabled={isSavingProduct} maxLength="120" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Runner Street 01" className={`${inputClass} disabled:cursor-wait disabled:opacity-60`} />
            </Field>
            <Field label="Preço (R$)">
              <input required disabled={isSavingProduct} type="number" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Ex: 489.90" className={`${inputClass} disabled:cursor-wait disabled:opacity-60`} />
            </Field>
            <Field label="Quantidade em estoque">
              <input required disabled={isSavingProduct} type="number" min="0" step="1" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} className={`${inputClass} disabled:cursor-wait disabled:opacity-60`} />
            </Field>
          </div>
          <Field label="Descrição curta">
            <textarea disabled={isSavingProduct} maxLength="2000" rows="3" value={description} onChange={(event) => setDescription(event.target.value)} className={`${inputClass} disabled:cursor-wait disabled:opacity-60`} />
          </Field>

          <fieldset className="admin-category-fieldset" disabled={isSavingProduct} aria-describedby="admin-category-help">
            <legend>Categoria esportiva <span aria-hidden="true">*</span></legend>
            <p id="admin-category-help">Esta divisão organiza o tênis na vitrine da loja.</p>
            <div className="admin-category-grid">
              {PRODUCT_CATEGORIES.map((option) => (
                <label key={option.id} className={`admin-category-option ${category === option.value ? 'is-selected' : ''}`}>
                  <input
                    type="radio"
                    name="product-category"
                    value={option.value}
                    checked={category === option.value}
                    onChange={() => { setCategory(option.value); setProductFormError(''); setProductFormMessage(''); }}
                    required
                  />
                  <span aria-hidden="true">{option.index}</span>
                  <strong>{option.label}</strong>
                  <small>{option.description}</small>
                </label>
              ))}
            </div>
          </fieldset>

          <ProductImagePicker
            images={productImages}
            onChange={(images) => { setProductImages(images); setProductFormError(''); setProductFormMessage(''); }}
            disabled={isSavingProduct}
            onBusyChange={setIsPreparingProductImages}
          />

          {productFormError && <p className="product-form-feedback is-error" role="alert">{productFormError}</p>}
          {productFormMessage && <p className="product-form-feedback" role="status">{productFormMessage}</p>}
          <button type="submit" disabled={isSavingProduct || isPreparingProductImages} className="admin-primary w-full cursor-pointer rounded-xl py-3 text-sm font-semibold disabled:cursor-wait disabled:opacity-60">
            {isPreparingProductImages ? 'Preparando fotos...' : isSavingProduct ? 'Enviando tênis e fotos...' : 'Cadastrar tênis'}
          </button>
        </form>
      </section>

      <section className="admin-card admin-stock-card rounded-2xl p-6"><div className="admin-section-heading"><span>04</span><h2>Controle de estoque</h2></div><p className="mt-2 text-sm text-[var(--muted)]">Ajuste a quantidade disponível. Uma venda confirmada reduz o saldo automaticamente.</p><div className="mt-5 space-y-3">{(dashboard?.inventory ?? []).map((product) => <div key={product.id} className="stock-row flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate font-semibold text-[var(--text)]">{product.name}</p><p className="text-xs text-[var(--muted)]">R$ {Number(product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div><input type="number" min="0" step="1" aria-label={`Estoque de ${product.name}`} value={stockDrafts[product.id] ?? product.stockQuantity} onChange={(event) => setStockDrafts((previous) => ({ ...previous, [product.id]: event.target.value }))} className={`${inputClass} sm:w-28`} /><button type="button" disabled={updatingProductId === product.id} onClick={() => handleStockUpdate(product)} className="stock-save cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50">{updatingProductId === product.id ? 'Salvando...' : 'Salvar'}</button></div>)}{dashboard && dashboard.inventory.length === 0 && <p className="empty-state py-6 text-center text-sm">Ainda não há produtos cadastrados.</p>}</div></section>

      <section className="admin-card admin-orders-card rounded-2xl p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="section-kicker">Pagamentos e expedição</p><h2 className="text-xl font-bold text-[var(--text)]">Pedidos recebidos</h2><p className="mt-1 text-sm text-[var(--muted)]">Acompanhe a confirmação do provedor antes de separar e enviar cada compra.</p></div>
          <span className="orders-count rounded-full px-3 py-1 text-xs font-bold">{dashboard?.orders?.length ?? 0} pedidos</span>
        </div>
        <div className="mt-5 space-y-4">
          {(dashboard?.orders ?? []).map((order) => {
            const status = paymentStatusMeta(order.status);
            const refundedAmount = Math.max(0, Number(order.refundedAmount ?? 0));
            const remainingBalance = refundableBalance(order);
            return (
              <article key={order.id} className="order-card rounded-2xl p-5">
                <div className="flex flex-col justify-between gap-3 sm:flex-row">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-[var(--accent)]">Pedido #{order.id}</p>
                      <span className={`payment-status-badge payment-status-badge-${status.tone}`}>{status.label}</span>
                    </div>
                    <h3 className="mt-2 text-lg font-bold text-[var(--text)]">{order.fullName}</h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">{order.email} · CPF {maskCpf(order.cpf)}</p>
                  </div>
                  <div className="sm:text-right">
                    <strong className="text-lg text-[var(--text)]">{formatCurrency(order.total)}</strong>
                    <p className="mt-1 text-xs text-[var(--muted)]">{paymentMethodLabel(order.paymentMethod)}</p>
                    {refundedAmount > 0 && <p className="mt-1 text-xs text-[var(--muted)]">Reembolsado: {formatCurrency(refundedAmount)} · saldo: {formatCurrency(remainingBalance)}</p>}
                  </div>
                </div>
                <div className="order-details mt-4 grid gap-4 border-t pt-4 md:grid-cols-2">
                  <div><p className="order-label">Endereço de entrega</p><p className="mt-1 text-sm font-semibold text-[var(--text)]">{order.street}, {order.addressNumber} — {order.neighborhood}</p><p className="text-sm text-[var(--muted)]">{order.city}/{order.state} · CEP {order.postalCode?.replace(/(\d{5})(\d{3})/, '$1-$2')}</p></div>
                  <div><p className="order-label">Itens do pedido</p><ul className="mt-1 space-y-1 text-sm text-[var(--muted)]">{(order.items ?? []).map((item) => <li key={`${order.id}-${item.productName}`}>{item.quantity}× {item.productName} <span className="text-[var(--text)]">— R$ {Number(item.unitPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></li>)}</ul></div>
                </div>
                {canRefundOrder(order) && (
                  <div className="order-payment-actions mt-4 border-t pt-4">
                    <button type="button" disabled={refundingOrderId === order.id} onClick={() => handleRefund(order)} className="refund-button cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-50">
                      {refundingOrderId === order.id ? 'Processando reembolso...' : `Reembolsar saldo de ${formatCurrency(remainingBalance)}`}
                    </button>
                    <p>A Stripe receberá a solicitação do saldo capturado restante. O resultado final continuará vindo do webhook assinado.</p>
                  </div>
                )}
                {order.canConfirmWhatsapp && (
                  <div className="order-payment-actions mt-4 border-t pt-4">
                    <p className="mb-3 text-xs text-[var(--muted)]">Pedido aguardando confirmação de pagamento via WhatsApp.</p>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={whatsappActionOrderId === order.id} onClick={() => handleConfirmWhatsappPayment(order)} className="admin-primary cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-50">
                        {whatsappActionOrderId === order.id ? 'Processando...' : '✔ Confirmar pagamento recebido'}
                      </button>
                      {order.canCancelWhatsapp && (
                        <button type="button" disabled={whatsappActionOrderId === order.id} onClick={() => handleCancelWhatsappOrder(order)} className="refund-button cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold disabled:cursor-wait disabled:opacity-50">
                          {whatsappActionOrderId === order.id ? 'Processando...' : '✕ Cancelar e liberar estoque'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </article>
            );
          })}
          {dashboard && dashboard.orders.length === 0 && <p className="empty-state py-6 text-center text-sm">Nenhum pedido registrado ainda.</p>}
        </div>
      </section>
    </div>
  );
}

const inputClass = 'admin-input w-full rounded-xl px-4 py-2.5 text-sm outline-none';
function Field({ label, children }) { return <label className="block flex-1 text-xs font-medium text-[var(--muted)]">{label}<span className="mt-2 block">{children}</span></label>; }
