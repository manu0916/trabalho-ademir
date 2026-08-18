import { useState, useRef } from 'react';
import { getCategoryId, PRODUCT_CATEGORIES } from '../utils/catalogCategories';

function dataUrlToFile(dataUrl, filename = 'foto.jpg') {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  try {
    const arr = dataUrl.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, { type: mime });
  } catch {
    return null;
  }
}

async function prepareImagesFromProduct(productItem) {
  const images = Array.isArray(productItem.images) ? productItem.images : [];
  const entries = [];

  for (let i = 0; i < images.length; i++) {
    const img = images[i];
    const dataUrl = typeof img === 'string' ? img : (img.dataUrl || img.url);
    const fileName = (typeof img === 'object' && img.name) ? img.name : `foto-${i + 1}.jpg`;

    let file = null;
    let previewUrl = '';

    if (dataUrl && dataUrl.startsWith('data:')) {
      file = dataUrlToFile(dataUrl, fileName);
      if (file) {
        previewUrl = URL.createObjectURL(file);
      }
    } else if (dataUrl && dataUrl.startsWith('http')) {
      try {
        const res = await fetch(dataUrl);
        if (res.ok) {
          const blob = await res.blob();
          file = new File([blob], fileName, { type: blob.type || 'image/jpeg' });
          previewUrl = URL.createObjectURL(file);
        }
      } catch {
        previewUrl = dataUrl; // fallback to URL
      }
    }

    if (file) {
      entries.push({
        key: `import-${Date.now()}-${i}`,
        id: `import-${Date.now()}-${i}`,
        kind: 'new',
        file,
        originalName: fileName,
        previewUrl: previewUrl || URL.createObjectURL(file),
      });
    } else if (previewUrl) {
      entries.push({
        key: `import-url-${Date.now()}-${i}`,
        id: `import-url-${Date.now()}-${i}`,
        kind: 'url',
        imageUrl: previewUrl,
        originalName: fileName,
        previewUrl,
      });
    }
  }

  return entries;
}

export default function ProductFileImporter({ onFillForm, onDirectSave, isSaving }) {
  const [isDragging, setIsDragging] = useState(false);
  const [importError, setImportError] = useState('');
  const [importSuccess, setImportSuccess] = useState('');
  const [parsedData, setParsedData] = useState(null); // { type: 'single' | 'batch', items: [...] }
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [batchProgress, setBatchProgress] = useState(null); // { current, total, currentName }
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer?.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileInputChange = (e) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
    e.target.value = '';
  };

  const processFile = async (file) => {
    setImportError('');
    setImportSuccess('');
    setParsedData(null);

    if (!file.name.toLowerCase().endsWith('.json')) {
      setImportError('Por favor, selecione um arquivo no formato .JSON gerado pela extensão Kicks Store.');
      return;
    }

    setIsProcessingFile(true);

    try {
      const text = await file.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error('O arquivo selecionado não contém um formato JSON válido.');
      }

      // Identify structure
      let productsList = [];

      if (json.format === 'kicks-store-product' && json.product) {
        productsList = [json.product];
      } else if (json.format === 'kicks-store-catalog' && Array.isArray(json.items)) {
        productsList = json.items;
      } else if (Array.isArray(json)) {
        productsList = json;
      } else if (json.name && (json.price !== undefined)) {
        productsList = [json];
      } else if (json.product && json.product.name) {
        productsList = [json.product];
      } else {
        throw new Error('Formato de dados do tênis não reconhecido. Certifique-se de usar o arquivo exportado pela extensão Kicks Store.');
      }

      if (productsList.length === 0) {
        throw new Error('Nenhum produto encontrado dentro do arquivo.');
      }

      // Process and normalize products
      const processedItems = [];
      for (const raw of productsList) {
        const catId = getCategoryId(raw.category) || 'BASQUETE';
        const matchedCategory = PRODUCT_CATEGORIES.find(c => c.id === catId)?.value || raw.category || 'Basquete';

        const imageEntries = await prepareImagesFromProduct(raw);

        processedItems.push({
          name: String(raw.name || '').trim(),
          price: Number(raw.price) || 0,
          stockQuantity: Number(raw.stockQuantity) || 10,
          category: matchedCategory,
          description: String(raw.description || '').trim(),
          sourceStore: raw.sourceStore || '',
          sourceUrl: raw.sourceUrl || '',
          imageEntries,
          coverUrl: imageEntries[0]?.previewUrl || (typeof raw.coverImageUrl === 'string' ? raw.coverImageUrl : '')
        });
      }

      setParsedData({
        type: processedItems.length > 1 ? 'batch' : 'single',
        items: processedItems,
        fileName: file.name
      });

      setImportSuccess(`Arquivo "${file.name}" carregado com sucesso! Encontrado(s) ${processedItems.length} modelo(s) pronto(s) para importação.`);

    } catch (err) {
      setImportError(err.message || 'Falha ao processar o arquivo de importação.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleApplyToForm = (item) => {
    if (!item) return;
    onFillForm({
      name: item.name,
      price: item.price,
      stockQuantity: item.stockQuantity,
      category: item.category,
      description: item.description,
      imageEntries: item.imageEntries,
    });
    setImportSuccess(`Dados de "${item.name}" preenchidos no formulário abaixo! Confira e clique em "Salvar e Publicar".`);
  };

  const handleSaveDirectly = async (item) => {
    if (!item) return;
    setImportError('');
    setImportSuccess('');

    try {
      const files = item.imageEntries.map(e => e.file).filter(Boolean);
      if (files.length === 0) {
        throw new Error('Nenhuma foto válida encontrada para o cadastro.');
      }

      await onDirectSave({
        name: item.name,
        price: item.price,
        stockQuantity: item.stockQuantity,
        category: item.category,
        description: item.description,
      }, files);

      setImportSuccess(`🎉 "${item.name}" cadastrado com sucesso no catálogo e publicado na vitrine!`);
      setParsedData(null);
    } catch (err) {
      setImportError(err.message || 'Erro ao salvar o produto diretamente.');
    }
  };

  const handleSaveAllBatch = async () => {
    if (!parsedData || parsedData.items.length === 0) return;
    setImportError('');
    setImportSuccess('');

    const total = parsedData.items.length;
    let successCount = 0;

    for (let i = 0; i < total; i++) {
      const item = parsedData.items[i];
      setBatchProgress({ current: i + 1, total, currentName: item.name });

      try {
        const files = item.imageEntries.map(e => e.file).filter(Boolean);
        if (files.length > 0) {
          await onDirectSave({
            name: item.name,
            price: item.price,
            stockQuantity: item.stockQuantity,
            category: item.category,
            description: item.description,
          }, files);
          successCount++;
        }
      } catch (err) {
        console.error(`Erro ao importar ${item.name}:`, err);
      }
    }

    setBatchProgress(null);
    setImportSuccess(`🎉 Lote importado com sucesso! ${successCount} de ${total} tênis foram adicionados ao catálogo.`);
    setParsedData(null);
  };

  const resetImporter = () => {
    setParsedData(null);
    setImportError('');
    setImportSuccess('');
  };

  return (
    <div className="product-file-importer rounded-3xl p-6 sm:p-7 bg-[var(--surface-solid)] border-2 border-dashed border-[var(--accent)]/40 hover:border-[var(--accent)] transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <span className="section-kicker flex items-center gap-1 text-[var(--accent)]">
            <span>📦</span> Importação Automática
          </span>
          <h3 className="text-lg font-extrabold text-[var(--text)]">Importar Tênis via Arquivo (.JSON da Extensão)</h3>
          <p className="text-xs text-[var(--muted)] mt-0.5">
            Arraste ou selecione o arquivo baixado pela extensão <b>Kicks Store Importer</b> para puxar todas as fotos e dados instantaneamente.
          </p>
        </div>

        {parsedData && (
          <button
            type="button"
            onClick={resetImporter}
            className="text-xs font-semibold text-[var(--muted)] hover:text-rose-500 underline self-start sm:self-auto"
          >
            Limpar / Importar Outro
          </button>
        )}
      </div>

      {importError && (
        <div className="mb-4 rounded-xl bg-rose-500/10 p-3 text-xs font-semibold text-rose-500 border border-rose-500/20">
          ❌ {importError}
        </div>
      )}

      {importSuccess && (
        <div className="mb-4 rounded-xl bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-500 border border-emerald-500/20">
          {importSuccess}
        </div>
      )}

      {batchProgress && (
        <div className="mb-4 rounded-xl bg-amber-500/10 p-4 border border-amber-500/20 text-xs">
          <div className="flex items-center justify-between font-bold text-amber-500 mb-1">
            <span>Importando Lote ({batchProgress.current} de {batchProgress.total})…</span>
            <span>{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
          </div>
          <p className="text-[var(--text)] text-[11px] truncate">Salvando agora: <b>{batchProgress.currentName}</b></p>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="sr-only"
        onChange={handleFileInputChange}
      />

      {!parsedData ? (
        /* Dropzone View */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-2xl p-8 text-center transition-all flex flex-col items-center justify-center ${
            isDragging
              ? 'bg-[var(--accent)]/10 border-2 border-[var(--accent)] scale-[0.99]'
              : 'bg-[var(--bg)] border border-[var(--line)] hover:bg-[var(--surface)]'
          }`}
        >
          <div className="text-4xl mb-2">📥</div>
          <p className="text-sm font-bold text-[var(--text)]">
            {isProcessingFile ? 'Lendo e decodificando fotos do arquivo…' : isDragging ? 'Solte o arquivo JSON aqui!' : 'Clique ou Arraste o arquivo .JSON aqui'}
          </p>
          <p className="text-xs text-[var(--muted)] mt-1 max-w-md">
            Compatível com arquivos individuais (<code>kicks-*.json</code>) ou lotes de catálogo exportados pela extensão.
          </p>
        </div>
      ) : (
        /* Parsed Preview View */
        <div className="space-y-4">
          {parsedData.type === 'single' ? (
            /* Single Sneaker Preview */
            (() => {
              const item = parsedData.items[0];
              return (
                <div className="bg-[var(--bg)] rounded-2xl p-5 border border-[var(--line)]">
                  <div className="flex flex-col md:flex-row gap-5 items-start">
                    {/* Cover & Gallery Thumbnails */}
                    <div className="w-full md:w-48 flex-shrink-0">
                      {item.coverUrl ? (
                        <img
                          src={item.coverUrl}
                          alt={item.name}
                          className="w-full h-36 object-cover rounded-xl border border-[var(--line)] shadow-sm bg-[var(--surface)]"
                        />
                      ) : (
                        <div className="w-full h-36 rounded-xl bg-[var(--surface)] flex items-center justify-center text-2xl">👟</div>
                      )}

                      {/* Small gallery strip */}
                      {item.imageEntries.length > 1 && (
                        <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1">
                          {item.imageEntries.map((img, idx) => (
                            <img
                              key={img.key || idx}
                              src={img.previewUrl}
                              alt=""
                              className="w-9 h-9 rounded-lg object-cover border border-[var(--line)] flex-shrink-0"
                            />
                          ))}
                        </div>
                      )}
                      <span className="text-[10px] text-[var(--muted)] block mt-1 text-center font-medium">
                        {item.imageEntries.length} foto(s) incluída(s)
                      </span>
                    </div>

                    {/* Details */}
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-[var(--accent)]/10 text-[var(--accent)] font-bold text-xs px-2.5 py-0.5 rounded-full border border-[var(--accent)]/20">
                          {item.category}
                        </span>
                        {item.sourceStore && (
                          <span className="text-[10px] bg-[var(--surface)] text-[var(--muted)] px-2 py-0.5 rounded border border-[var(--line)]">
                            Origem: {item.sourceStore}
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-extrabold text-[var(--text)]">{item.name}</h4>

                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-emerald-500 font-bold text-sm">
                          {Number(item.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        <span className="text-[var(--muted)]">•</span>
                        <span className="text-[var(--muted)]">Estoque inicial: <b>{item.stockQuantity} un</b></span>
                      </div>

                      {item.description && (
                        <p className="text-xs text-[var(--muted)] line-clamp-2 italic">
                          "{item.description}"
                        </p>
                      )}

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2.5 pt-3">
                        <button
                          type="button"
                          onClick={() => handleApplyToForm(item)}
                          className="buy-button px-4 py-2 rounded-xl text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5"
                        >
                          <span>✨</span> Preencher no Formulário de Edição
                        </button>

                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleSaveDirectly(item)}
                          className="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--surface)] text-[var(--text)] border border-[var(--line)] hover:border-[var(--accent)] cursor-pointer disabled:opacity-50"
                        >
                          <span>⚡</span> Salvar Direto no Catálogo
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()
          ) : (
            /* Batch Sneakers Preview */
            <div className="bg-[var(--bg)] rounded-2xl p-5 border border-[var(--line)] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--line)] pb-3">
                <div>
                  <h4 className="font-extrabold text-sm text-[var(--text)]">
                    📦 Lote com {parsedData.items.length} modelos de tênis
                  </h4>
                  <span className="text-xs text-[var(--muted)]">
                    Todos os itens possuem fotos e especificações prontas para publicação.
                  </span>
                </div>

                <button
                  type="button"
                  disabled={Boolean(batchProgress) || isSaving}
                  onClick={handleSaveAllBatch}
                  className="buy-button px-5 py-2.5 rounded-xl text-xs font-bold shadow-md cursor-pointer disabled:opacity-50 flex items-center gap-1.5 self-start sm:self-auto"
                >
                  <span>⚡</span> Importar Todos ({parsedData.items.length}) para a Loja
                </button>
              </div>

              {/* Items List */}
              <div className="grid gap-2.5 max-h-64 overflow-y-auto pr-1">
                {parsedData.items.map((it, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between bg-[var(--surface)] p-2.5 rounded-xl border border-[var(--line)] text-xs"
                  >
                    <div className="flex items-center gap-3 overflow-hidden">
                      {it.coverUrl ? (
                        <img src={it.coverUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-[var(--line)] flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[var(--bg)] flex items-center justify-center text-sm">👟</div>
                      )}
                      <div className="overflow-hidden">
                        <span className="font-bold text-[var(--text)] block truncate">{it.name}</span>
                        <span className="text-[11px] text-[var(--muted)]">
                          {Number(it.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} • {it.category} • {it.imageEntries.length} fotos
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApplyToForm(it)}
                      className="px-2.5 py-1 rounded-lg bg-[var(--bg)] text-[var(--accent)] font-semibold border border-[var(--line)] hover:border-[var(--accent)] flex-shrink-0 text-[11px]"
                    >
                      Preencher no Form
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
