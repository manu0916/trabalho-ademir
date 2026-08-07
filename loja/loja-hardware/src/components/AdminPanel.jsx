import React, { useState } from 'react';

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
    ['Produtos vendidos', dashboard?.productsSold ?? 0, 'text-sky-300'],
    ['Contas criadas', dashboard?.accountsCreated ?? 0, 'text-violet-300'],
    ['Valor vendido', `R$ ${Number(dashboard?.revenue ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, 'text-emerald-300'],
    ['Produtos cadastrados', dashboard?.registeredProducts ?? 0, 'text-amber-300'],
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold text-white border-l-4 border-sky-400 pl-3">Painel Administrativo</h1>
        <button type="button" onClick={onLogout} className="border border-zinc-600 hover:border-red-400 text-zinc-300 hover:text-red-300 font-semibold px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer">Sair</button>
      </div>

      <section>
        <h2 className="mb-4 text-lg font-bold text-white">Resumo da loja</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map(([label, value, color]) => (
            <div key={label} className="rounded-xl border border-[#27272a] bg-[#121214] p-5">
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
              <p className={`mt-2 text-2xl font-extrabold ${color}`}>{value}</p>
              <p className="mt-1 text-xs text-zinc-500">Pagamentos confirmados</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#121214] p-6 rounded-xl border border-[#27272a]">
        <h2 className="text-lg font-bold text-white mb-4">Configurações da loja</h2>
        <form onSubmit={handleStoreNameSubmit} className="flex gap-4 items-end">
          <div className="flex-1"><label className="block text-xs text-zinc-400 mb-2">Nome da loja</label><input value={storeNameInput} onChange={(event) => setStoreNameInput(event.target.value)} className="w-full bg-[#0a0a0a] border border-[#27272a] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400" /></div>
          <button type="submit" className="bg-sky-500 hover:bg-sky-400 text-black font-semibold px-5 py-2.5 rounded-lg text-sm">Salvar nome</button>
        </form>
      </section>

      <section className="bg-[#121214] p-6 rounded-xl border border-[#27272a]">
        <h2 className="text-lg font-bold text-white mb-4">Adicionar novo hardware</h2>
        <form onSubmit={handleProductSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nome do produto"><input required value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex: GeForce RTX 4070 Ti" className={inputClass} /></Field>
            <Field label="Categoria"><select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}><option value="GPU">GPU (Placa de vídeo)</option><option value="CPU">CPU (Processador)</option><option value="RAM">Memória RAM</option><option value="SSD">Armazenamento SSD</option><option value="Fonte">Fonte de alimentação</option></select></Field>
            <Field label="Preço (R$)"><input required type="number" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="Ex: 5499.90" className={inputClass} /></Field>
            <Field label="Quantidade em estoque"><input required type="number" min="0" step="1" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} className={inputClass} /></Field>
          </div>
          <Field label="URL da imagem"><input required type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="https://..." className={inputClass} /></Field>
          <Field label="Descrição curta"><textarea rows="3" value={description} onChange={(event) => setDescription(event.target.value)} className={inputClass} /></Field>
          <button type="submit" className="w-full bg-sky-500 hover:bg-sky-400 text-black font-semibold py-3 rounded-lg text-sm shadow-lg shadow-sky-500/20">Cadastrar produto na loja</button>
        </form>
      </section>

      <section className="bg-[#121214] p-6 rounded-xl border border-[#27272a]">
        <h2 className="text-lg font-bold text-white">Controle de estoque</h2>
        <p className="mt-1 text-sm text-zinc-400">Ajuste a quantidade disponível. Uma venda confirmada pelo gateway reduz o saldo automaticamente.</p>
        <div className="mt-5 space-y-3">
          {(dashboard?.inventory ?? []).map((product) => (
            <div key={product.id} className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-black/20 p-4 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1"><p className="truncate font-semibold text-white">{product.name}</p><p className="text-xs text-zinc-500">{product.category} · R$ {Number(product.price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></div>
              <input type="number" min="0" step="1" aria-label={`Estoque de ${product.name}`} value={stockDrafts[product.id] ?? product.stockQuantity} onChange={(event) => setStockDrafts((previous) => ({ ...previous, [product.id]: event.target.value }))} className="w-full rounded-lg border border-zinc-700 bg-[#0a0a0a] px-3 py-2 text-sm text-white outline-none focus:border-sky-400 sm:w-28" />
              <button type="button" disabled={updatingProductId === product.id} onClick={() => handleStockUpdate(product)} className="rounded-lg border border-sky-400/50 px-4 py-2 text-sm font-semibold text-sky-300 hover:bg-sky-400/10 disabled:opacity-50">{updatingProductId === product.id ? 'Salvando...' : 'Salvar'}</button>
            </div>
          ))}
          {dashboard && dashboard.inventory.length === 0 && <p className="py-6 text-center text-sm text-zinc-500">Ainda não há produtos cadastrados.</p>}
        </div>
      </section>
    </div>
  );
}

const inputClass = 'w-full bg-[#0a0a0a] border border-[#27272a] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-sky-400';
function Field({ label, children }) { return <label className="block text-xs text-zinc-400 mb-2">{label}{children}</label>; }
