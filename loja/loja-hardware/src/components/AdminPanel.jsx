import { useState } from 'react';

const inputClass = 'w-full outline-none transition-all';
const inputStyle = {
  background: 'rgba(8, 8, 16, 0.7)',
  border: '1px solid rgba(99, 102, 241, 0.2)',
  borderRadius: '10px',
  padding: '10px 14px',
  fontSize: '0.875rem',
  color: 'var(--text-main)',
  fontFamily: "'Outfit', sans-serif",
  transition: 'border-color 0.2s, box-shadow 0.2s',
};

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const focusHandlers = {
  onFocus: (e) => {
    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.6)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99,102,241,0.12)';
  },
  onBlur: (e) => {
    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.2)';
    e.currentTarget.style.boxShadow = 'none';
  },
};

const sectionStyle = {
  background: 'rgba(13, 13, 24, 0.8)',
  border: '1px solid rgba(99, 102, 241, 0.12)',
  borderRadius: '16px',
  padding: '24px',
};

export default function AdminPanel({ currentStoreName, onUpdateStoreName, onAddProduct, onLogout, dashboard, onUpdateStock }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stockQuantity, setStockQuantity] = useState('0');
  const [category, setCategory] = useState('GPU');
  const [imageUrl, setImageUrl] = useState('');
  const [storeNameInput, setStoreNameInput] = useState(currentStoreName);
  const [stockDrafts, setStockDrafts] = useState({});
  const [updatingProductId, setUpdatingProductId] = useState(null);

  const handleProductSubmit = async (event) => {
    event.preventDefault();
    if (!name || !price || !imageUrl || stockQuantity === '') {
      alert('Preencha Nome, preço, estoque e URL da imagem.');
      return;
    }
    if (!imageUrl.startsWith('https://')) {
      alert('A URL da imagem deve usar HTTPS.');
      return;
    }
    const quantity = Number(stockQuantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      alert('O estoque deve ser um número inteiro igual ou maior que zero.');
      return;
    }
    try {
      await onAddProduct({ name, description, price: parseFloat(price), stockQuantity: quantity, category, imageUrl });
      setName(''); setDescription(''); setPrice(''); setStockQuantity('0'); setImageUrl('');
    } catch (error) {
      alert(error.message || 'Não foi possível salvar o produto.');
    }
  };

  const handleStoreNameSubmit = (event) => {
    event.preventDefault();
    if (!storeNameInput.trim()) return;
    onUpdateStoreName(storeNameInput.trim());
  };

  const handleStockUpdate = async (product) => {
    const quantity = Number(stockDrafts[product.id] ?? product.stockQuantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      alert('Informe uma quantidade inteira igual ou maior que zero.');
      return;
    }
    setUpdatingProductId(product.id);
    try {
      await onUpdateStock(product.id, quantity);
    } catch (error) {
      alert(error.message || 'Não foi possível atualizar o estoque.');
    } finally {
      setUpdatingProductId(null);
    }
  };

  const stats = [
    {
      label: 'Produtos vendidos',
      value: dashboard?.productsSold ?? 0,
      color: '#818cf8',
      glow: 'rgba(99,102,241,0.3)',
      bg: 'rgba(99,102,241,0.08)',
      border: 'rgba(99,102,241,0.2)',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    },
    {
      label: 'Contas criadas',
      value: dashboard?.accountsCreated ?? 0,
      color: '#c084fc',
      glow: 'rgba(192,132,252,0.3)',
      bg: 'rgba(192,132,252,0.08)',
      border: 'rgba(192,132,252,0.2)',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
        </svg>
      ),
    },
    {
      label: 'Valor vendido',
      value: `R$ ${Number(dashboard?.revenue ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
      color: '#34d399',
      glow: 'rgba(52,211,153,0.3)',
      bg: 'rgba(52,211,153,0.08)',
      border: 'rgba(52,211,153,0.2)',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Produtos cadastrados',
      value: dashboard?.registeredProducts ?? 0,
      color: '#fbbf24',
      glow: 'rgba(251,191,36,0.3)',
      bg: 'rgba(251,191,36,0.08)',
      border: 'rgba(251,191,36,0.2)',
      icon: (
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.2em] uppercase mb-1" style={{ color: '#818cf8' }}>
            Painel Admin
          </p>
          <h1
            className="text-3xl font-black text-white"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Dashboard
          </h1>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all cursor-pointer"
          style={{
            background: 'rgba(248,113,113,0.05)',
            border: '1px solid rgba(248,113,113,0.2)',
            color: '#f87171',
            fontFamily: "'Outfit', sans-serif",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(248,113,113,0.12)';
            e.currentTarget.style.borderColor = 'rgba(248,113,113,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(248,113,113,0.05)';
            e.currentTarget.style.borderColor = 'rgba(248,113,113,0.2)';
          }}
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sair
        </button>
      </div>

      {/* Stats */}
      <section>
        <h2 className="mb-4 text-base font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
          Resumo da loja
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(({ label, value, color, glow, bg, border, icon }) => (
            <div
              key={label}
              className="rounded-2xl p-5 transition-all duration-300"
              style={{
                background: bg,
                border: `1px solid ${border}`,
                boxShadow: 'none',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = `0 8px 32px ${glow}`; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <div style={{ color }}>{icon}</div>
              </div>
              <p
                className="text-2xl font-black"
                style={{ color, fontFamily: typeof value === 'string' && value.includes('R$') ? "'JetBrains Mono', monospace" : "'Outfit', sans-serif" }}
              >
                {value}
              </p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-dim)' }}>Pagamentos confirmados</p>
            </div>
          ))}
        </div>
      </section>

      {/* Store settings */}
      <section style={sectionStyle}>
        <h2 className="text-base font-bold text-white mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
          ⚙️ Configurações da loja
        </h2>
        <form onSubmit={handleStoreNameSubmit} className="flex gap-3 items-end">
          <div className="flex-1">
            <Field label="Nome da loja">
              <input
                value={storeNameInput}
                onChange={(event) => setStoreNameInput(event.target.value)}
                style={inputStyle}
                className={inputClass}
                {...focusHandlers}
              />
            </Field>
          </div>
          <button
            type="submit"
            className="flex-shrink-0 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
              boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
              fontFamily: "'Outfit', sans-serif",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.55)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.35)'; }}
          >
            Salvar
          </button>
        </form>
      </section>

      {/* Add product */}
      <section style={sectionStyle}>
        <h2 className="text-base font-bold text-white mb-5" style={{ fontFamily: "'Outfit', sans-serif" }}>
          📦 Adicionar novo hardware
        </h2>
        <form onSubmit={handleProductSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome do produto">
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ex: GeForce RTX 4070 Ti"
                style={inputStyle}
                className={inputClass}
                {...focusHandlers}
              />
            </Field>
            <Field label="Categoria">
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                style={{ ...inputStyle, cursor: 'pointer' }}
                className={inputClass}
                {...focusHandlers}
              >
                <option value="GPU">GPU — Placa de vídeo</option>
                <option value="CPU">CPU — Processador</option>
                <option value="RAM">Memória RAM</option>
                <option value="SSD">Armazenamento SSD</option>
                <option value="Fonte">Fonte de alimentação</option>
              </select>
            </Field>
            <Field label="Preço (R$)">
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                placeholder="Ex: 5499.90"
                style={inputStyle}
                className={inputClass}
                {...focusHandlers}
              />
            </Field>
            <Field label="Quantidade em estoque">
              <input
                required
                type="number"
                min="0"
                step="1"
                value={stockQuantity}
                onChange={(event) => setStockQuantity(event.target.value)}
                style={inputStyle}
                className={inputClass}
                {...focusHandlers}
              />
            </Field>
          </div>
          <Field label="URL da imagem (https://)">
            <input
              required
              type="url"
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
              placeholder="https://..."
              style={inputStyle}
              className={inputClass}
              {...focusHandlers}
            />
          </Field>
          <Field label="Descrição curta">
            <textarea
              rows="3"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              style={{ ...inputStyle, resize: 'vertical' }}
              className={inputClass}
              {...focusHandlers}
            />
          </Field>
          <button
            type="submit"
            className="w-full py-3.5 text-sm font-bold rounded-xl transition-all"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              color: '#fff',
              boxShadow: '0 6px 24px rgba(99,102,241,0.35)',
              fontFamily: "'Outfit', sans-serif",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #818cf8, #6366f1)';
              e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.55)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)';
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(99,102,241,0.35)';
            }}
          >
            + Cadastrar produto na loja
          </button>
        </form>
      </section>

      {/* Stock control */}
      <section style={sectionStyle}>
        <h2 className="text-base font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
          📊 Controle de estoque
        </h2>
        <p className="mt-1 text-sm mb-5" style={{ color: 'var(--text-dim)' }}>
          Ajuste a quantidade disponível. Vendas confirmadas reduzem o saldo automaticamente.
        </p>
        <div className="space-y-3">
          {(dashboard?.inventory ?? []).map((product) => (
            <div
              key={product.id}
              className="flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-center transition-all"
              style={{
                background: 'rgba(8,8,16,0.5)',
                border: '1px solid rgba(99,102,241,0.1)',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.1)'; }}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white text-sm" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  {product.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>
                  {product.category} ·{' '}
                  <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                    R$ {Number(product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </p>
              </div>
              <input
                type="number"
                min="0"
                step="1"
                aria-label={`Estoque de ${product.name}`}
                value={stockDrafts[product.id] ?? product.stockQuantity}
                onChange={(event) => setStockDrafts((previous) => ({ ...previous, [product.id]: event.target.value }))}
                style={{ ...inputStyle, width: '7rem', textAlign: 'center' }}
              />
              <button
                type="button"
                disabled={updatingProductId === product.id}
                onClick={() => handleStockUpdate(product)}
                className="rounded-xl px-4 py-2 text-sm font-bold transition-all cursor-pointer"
                style={{
                  background: 'rgba(99,102,241,0.1)',
                  border: '1px solid rgba(99,102,241,0.25)',
                  color: '#818cf8',
                  fontFamily: "'Outfit', sans-serif",
                  opacity: updatingProductId === product.id ? 0.5 : 1,
                }}
                onMouseEnter={(e) => {
                  if (updatingProductId !== product.id) {
                    e.currentTarget.style.background = 'rgba(99,102,241,0.2)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(99,102,241,0.1)';
                  e.currentTarget.style.boxShadow = 'none';
                }}
              >
                {updatingProductId === product.id ? '⏳ Salvando...' : '💾 Salvar'}
              </button>
            </div>
          ))}
          {dashboard && dashboard.inventory.length === 0 && (
            <p className="py-8 text-center text-sm" style={{ color: 'var(--text-dim)' }}>
              Ainda não há produtos cadastrados.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
