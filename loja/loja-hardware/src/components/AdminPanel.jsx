import React, { useState } from 'react';

export default function AdminPanel({ currentStoreName, onUpdateStoreName, onAddProduct, onLogout }) {
  // Estados do formulário de produto
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('GPU');
  const [imageUrl, setImageUrl] = useState('');

  // Estado do nome da loja
  const [storeNameInput, setStoreNameInput] = useState(currentStoreName);

  // Submeter novo produto
  const handleProductSubmit = async (e) => {
    e.preventDefault();
    if (!name || !price || !imageUrl) {
      alert('Preencha pelo menos o Nome, Preço e URL da imagem!');
      return;
    }

    if (!imageUrl.startsWith('https://')) {
      alert('A URL da imagem deve usar HTTPS.');
      return;
    }

    const newProduct = {
      name,
      description,
      price: parseFloat(price),
      category,
      imageUrl
    };

    try {
      await onAddProduct(newProduct);
    } catch {
      alert('Nao foi possivel salvar o produto. Verifique sua sessao e tente novamente.');
      return;
    }

    // Limpar campos
    setName('');
    setDescription('');
    setPrice('');
    setImageUrl('');
  };

  // Submeter novo nome da loja
  const handleStoreNameSubmit = (e) => {
    e.preventDefault();
    if (!storeNameInput.trim()) return;
    onUpdateStoreName(storeNameInput.trim());
    alert('Nome da loja atualizado!');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-3xl font-extrabold text-white border-l-4 border-sky-400 pl-3">
          Painel Administrativo
        </h1>
        <button
          type="button"
          onClick={onLogout}
          className="border border-zinc-600 hover:border-red-400 text-zinc-300 hover:text-red-300 font-semibold px-4 py-2 rounded-lg text-sm transition-colors cursor-pointer"
        >
          Sair
        </button>
      </div>

      {/* SEÇÃO 1: Alterar Nome da Loja */}
      <section className="bg-[#121214] p-6 rounded-xl border border-[#27272a]">
        <h2 className="text-lg font-bold text-white mb-4">Configurações da Loja</h2>
        <form onSubmit={handleStoreNameSubmit} className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs text-zinc-400 mb-2">Nome da Loja</label>
            <input
              type="text"
              value={storeNameInput}
              onChange={(e) => setStoreNameInput(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#27272a] rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-sky-400"
            />
          </div>
          <button
            type="submit"
            className="bg-sky-500 hover:bg-sky-400 text-black font-semibold px-5 py-2.5 rounded-lg text-sm transition-colors cursor-pointer"
          >
            Salvar Nome
          </button>
        </form>
      </section>

      {/* SEÇÃO 2: Cadastrar Novo Produto */}
      <section className="bg-[#121214] p-6 rounded-xl border border-[#27272a]">
        <h2 className="text-lg font-bold text-white mb-4">Adicionar Novo Hardware</h2>
        <form onSubmit={handleProductSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-2">Nome do Produto</label>
              <input
                type="text"
                placeholder="Ex: GeForce RTX 4070 Ti"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#27272a] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-2">Categoria</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#27272a] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-sky-400"
              >
                <option value="GPU">GPU (Placa de Vídeo)</option>
                <option value="CPU">CPU (Processador)</option>
                <option value="RAM">Memória RAM</option>
                <option value="SSD">Armazenamento SSD</option>
                <option value="Fonte">Fonte de Alimentação</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-2">Preço (R$)</label>
              <input
                type="number"
                step="0.01"
                placeholder="Ex: 5499.90"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#27272a] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-sky-400"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-2">URL da Imagem</label>
              <input
                type="text"
                placeholder="https://images.unsplash.com/photo-1591488320449-011701bb6704"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#27272a] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-sky-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-2">Descrição Curta</label>
            <textarea
              rows="3"
              placeholder="Especificações do produto..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-[#0a0a0a] border border-[#27272a] rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-sky-400"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-sky-500 hover:bg-sky-400 text-black font-semibold py-3 rounded-lg text-sm transition-colors cursor-pointer shadow-lg shadow-sky-500/20"
          >
            Cadastrar Produto na Loja
          </button>
        </form>
      </section>
    </div>
  );
}
