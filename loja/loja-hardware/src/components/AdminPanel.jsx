import { useState } from 'react';
import { STORE_THEMES } from '../themes';

export default function AdminPanel({ currentStoreName, onUpdateStoreName, onAddProduct, onLogout, dashboard, onUpdateStock, theme, themeId, onThemeChange }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('0');
  const [imageUrl, setImageUrl] = useState('');
  const [storeNameInput, setStoreNameInput] = useState(currentStoreName);
  const [stockDrafts, setStockDrafts] = useState({});
  const [updatingProductId, setUpdatingProductId] = useState(null);

  const handleProductSubmit = async (event) => {
    event.preventDefault();
    if (!name || !price || !imageUrl || stockQuantity === '') return alert('Preencha nome, preço, estoque e URL da imagem.');
    if (!imageUrl.startsWith('https://')) return alert('A URL da imagem deve usar HTTPS.');
    const quantity = Number(stockQuantity);
    if (!Number.isInteger(quantity) || quantity < 0) return alert('O estoque deve ser um número inteiro igual ou maior que zero.');
    try {
      await onAddProduct({ name, description, price: parseFloat(price), stockQuantity: quantity, category: theme.category, imageUrl });
      setName(''); setDescription(''); setPrice(''); setStockQuantity('0'); setImageUrl('');
    } catch (error) { alert(error.message || 'Não foi possível salvar o produto.'); }
  };

  const handleStoreNameSubmit = (event) => { event.preventDefault(); if (storeNameInput.trim()) onUpdateStoreName(storeNameInput.trim()); };
  const handleStockUpdate = async (product) => {
    const quantity = Number(stockDrafts[product.id] ?? product.stockQuantity);
    if (!Number.isInteger(quantity) || quantity < 0) return alert('Informe uma quantidade inteira igual ou maior que zero.');
    setUpdatingProductId(product.id);
    try { await onUpdateStock(product.id, quantity); } catch (error) { alert(error.message || 'Não foi possível atualizar o estoque.'); } finally { setUpdatingProductId(null); }
  };
  const stats = [
    ['Produtos vendidos', dashboard?.productsSold ?? 0], ['Contas criadas', dashboard?.accountsCreated ?? 0],
    ['Valor vendido', `R$ ${Number(dashboard?.revenue ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`], ['Produtos cadastrados', dashboard?.registeredProducts ?? 0],
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 py-8">
      <div className="flex items-center justify-between gap-4"><div><p className="section-kicker">Área restrita</p><h1 className="section-title text-3xl">Painel da loja</h1></div><button type="button" onClick={onLogout} className="logout-button cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold">Sair</button></div>
      <section><h2 className="mb-4 text-lg font-bold text-[var(--text)]">Resumo da loja</h2><div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">{stats.map(([label, value]) => <div key={label} className="stat-card rounded-2xl p-5"><p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p><p className="stat-value mt-2 text-2xl font-extrabold">{value}</p><p className="mt-1 text-xs text-[var(--muted)]">Atualizado em tempo real</p></div>)}</div></section>

      <section className="admin-card rounded-2xl p-6">
        <p className="section-kicker">Identidade visual</p><h2 className="mb-2 text-xl font-bold text-[var(--text)]">Escolha o tema da sua loja</h2><p className="mb-5 text-sm text-[var(--muted)]">O tema muda cores, imagens, textos e o clima da vitrine sem afetar os produtos cadastrados.</p>
        <div className="grid gap-3 md:grid-cols-3">{Object.values(STORE_THEMES).map((item) => <button key={item.id} type="button" onClick={() => onThemeChange(item.id)} className={`theme-choice theme-choice-${item.id} ${themeId === item.id ? 'is-active' : ''}`}><span>{item.id === 'hardware' ? '✦' : item.id === 'sneakers' ? '◒' : '◉'}</span><strong>{item.name}</strong><small>{item.category}</small></button>)}</div>
      </section>

      <section className="admin-card rounded-2xl p-6"><h2 className="mb-4 text-lg font-bold text-[var(--text)]">Nome da loja</h2><form onSubmit={handleStoreNameSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end"><Field label="Nome exibido"><input value={storeNameInput} onChange={(event) => setStoreNameInput(event.target.value)} className={inputClass} /></Field><button type="submit" className="admin-primary cursor-pointer rounded-xl px-5 py-2.5 text-sm font-semibold">Salvar nome</button></form></section>

      <section className="admin-card rounded-2xl p-6"><div className="mb-4"><p className="section-kicker">Novo item</p><h2 className="text-lg font-bold text-[var(--text)]">Adicionar produto</h2><p className="mt-1 text-sm text-[var(--muted)]">O produto será incluído automaticamente na coleção {theme.category}. Sem precisar escolher tipo de produto.</p></div><form onSubmit={handleProductSubmit} className="space-y-4"><div className="grid grid-cols-1 gap-4 md:grid-cols-2"><Field label="Nome do produto"><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: Produto especial" className={inputClass} /></Field><Field label="Preço (R$)"><input required type="number" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Ex: 89.90" className={inputClass} /></Field><Field label="Quantidade em estoque"><input required type="number" min="0" step="1" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} className={inputClass} /></Field><Field label="URL da imagem"><input required type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." className={inputClass} /></Field></div><Field label="Descrição curta"><textarea rows="3" value={description} onChange={(event) => setDescription(event.target.value)} className={inputClass} /></Field><button type="submit" className="admin-primary w-full cursor-pointer rounded-xl py-3 text-sm font-semibold">Cadastrar produto</button></form></section>

      <section className="admin-card rounded-2xl p-6"><h2 className="text-lg font-bold text-[var(--text)]">Controle de estoque</h2><p className="mt-1 text-sm text-[var(--muted)]">Ajuste a quantidade disponível. Uma venda confirmada reduz o saldo automaticamente.</p><div className="mt-5 space-y-3">{(dashboard?.inventory ?? []).map((product) => <div key={product.id} className="stock-row flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="truncate font-semibold text-[var(--text)]">{product.name}</p><p className="text-xs text-[var(--muted)]">R$ {Number(product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div><input type="number" min="0" step="1" aria-label={`Estoque de ${product.name}`} value={stockDrafts[product.id] ?? product.stockQuantity} onChange={(event) => setStockDrafts((previous) => ({ ...previous, [product.id]: event.target.value }))} className={`${inputClass} sm:w-28`} /><button type="button" disabled={updatingProductId === product.id} onClick={() => handleStockUpdate(product)} className="stock-save cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-50">{updatingProductId === product.id ? 'Salvando...' : 'Salvar'}</button></div>)}{dashboard && dashboard.inventory.length === 0 && <p className="empty-state py-6 text-center text-sm">Ainda não há produtos cadastrados.</p>}</div></section>

      <section className="admin-card rounded-2xl p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="section-kicker">Expedição</p><h2 className="text-xl font-bold text-[var(--text)]">Pedidos recebidos</h2><p className="mt-1 text-sm text-[var(--muted)]">Dados completos para separar e enviar cada compra.</p></div><span className="orders-count rounded-full px-3 py-1 text-xs font-bold">{dashboard?.orders?.length ?? 0} pedidos</span></div><div className="mt-5 space-y-4">{(dashboard?.orders ?? []).map((order) => <article key={order.id} className="order-card rounded-2xl p-5"><div className="flex flex-col justify-between gap-3 sm:flex-row"><div><p className="text-xs font-bold uppercase tracking-wide text-[var(--accent)]">Pedido #{order.id} · {order.status === 'PAID' ? 'Pagamento aprovado' : 'Aguardando pagamento'}</p><h3 className="mt-1 text-lg font-bold text-[var(--text)]">{order.fullName}</h3><p className="mt-1 text-sm text-[var(--muted)]">{order.email} · CPF {order.cpf}</p></div><div className="sm:text-right"><strong className="text-lg text-[var(--text)]">R$ {Number(order.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong><p className="mt-1 text-xs text-[var(--muted)]">{order.paymentMethod.replace('_', ' ')}</p></div></div><div className="order-details mt-4 grid gap-4 border-t pt-4 md:grid-cols-2"><div><p className="order-label">Endereço de entrega</p><p className="mt-1 text-sm font-semibold text-[var(--text)]">{order.street}, {order.addressNumber} — {order.neighborhood}</p><p className="text-sm text-[var(--muted)]">{order.city}/{order.state} · CEP {order.postalCode?.replace(/(\d{5})(\d{3})/, '$1-$2')}</p></div><div><p className="order-label">Itens do pedido</p><ul className="mt-1 space-y-1 text-sm text-[var(--muted)]">{order.items.map((item) => <li key={`${order.id}-${item.productName}`}>{item.quantity}× {item.productName} <span className="text-[var(--text)]">— R$ {Number(item.unitPrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></li>)}</ul></div></div></article>)}{dashboard && dashboard.orders.length === 0 && <p className="empty-state py-6 text-center text-sm">Nenhum pedido registrado ainda.</p>}</div></section>
    </div>
  );
}

const inputClass = 'admin-input w-full rounded-xl px-4 py-2.5 text-sm outline-none';
function Field({ label, children }) { return <label className="block flex-1 text-xs font-medium text-[var(--muted)]">{label}<span className="mt-2 block">{children}</span></label>; }
