import { useState, useRef } from 'react';
import { getCategoryId, PRODUCT_CATEGORIES } from '../utils/catalogCategories';
import { prepareRawOrDataUrlImage, releaseImagePreviewUrls } from '../utils/imagePreparation';
import { extractExtensionProducts, getExtensionImageCandidates } from '../utils/extensionProductImport';
import { playUiSound } from '../utils/soundEffects';

async function prepareImagesFromProduct(productItem) {
  const images = getExtensionImageCandidates(productItem, { maxImages: 24 });
  if (images.length === 0) {
    throw new Error('nenhuma foto foi encontrada no produto exportado');
  }
  const entries = [];
  const errors = [];
  for (const [index, image] of images.entries()) {
    if (entries.length >= 8) break;
    try {
      const file = await prepareRawOrDataUrlImage(image.source, image.name);
      const imageId = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`;
      entries.push({
        key: `import-${imageId}`,
        id: imageId,
        kind: 'new',
        file,
        originalName: file.name,
        previewUrl: URL.createObjectURL(file),
      });
    } catch (error) {
      errors.push(`foto ${index + 1}: ${error?.message || 'formato inválido'}`);
    }
  }

  if (entries.length === 0) {
    const details = errors.slice(0, 2).join(' ');
    throw new Error(`nenhuma foto pôde ser importada. ${details}`.trim());
  }
  return { entries, errors };
}

function releaseImportedItems(items, preservedEntries = null) {
  for (const item of items || []) {
    if (item.imageEntries !== preservedEntries) releaseImagePreviewUrls(item.imageEntries);
  }
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
    if (isProcessingFile || batchProgress) return;
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
    if (isProcessingFile || batchProgress) return;
    setImportError('');
    setImportSuccess('');
    releaseImportedItems(parsedData?.items);
    setParsedData(null);

    if (!file.name.toLowerCase().endsWith('.json')) {
      setImportError('Por favor, selecione um arquivo no formato .JSON gerado pela extensão Kicks Store.');
      return;
    }

    setIsProcessingFile(true);

    const preparedItems = [];
    try {
      const text = await file.text();
      let json;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error('O arquivo selecionado não contém um formato JSON válido.');
      }

      const productsList = extractExtensionProducts(json);
      const skippedProducts = [];
      const imageWarnings = [];

      for (const [productIndex, raw] of productsList.entries()) {
        const displayName = String(raw.name || '').trim() || `Produto ${productIndex + 1}`;
        try {
          const normalizedPrice = Number(raw.price);
          if (!String(raw.name || '').trim()) throw new Error('o nome está vazio');
          if (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0) throw new Error('o preço é inválido');

          const matchedCategory = getCategoryId(raw.category) || PRODUCT_CATEGORIES[0]?.id || 'BASQUETE';
          const preparedImages = await prepareImagesFromProduct(raw);
          const parsedStock = Number(raw.stockQuantity);

          preparedItems.push({
            name: displayName,
            price: normalizedPrice,
            stockQuantity: Number.isFinite(parsedStock) && parsedStock >= 0 ? Math.trunc(parsedStock) : 10,
            category: matchedCategory,
            description: String(raw.description || '').trim(),
            sourceStore: raw.sourceStore || '',
            sourceUrl: raw.sourceUrl || '',
            colorName: String(raw.colorName || '').trim(),
            colorSourceName: String(raw.colorSourceName || '').trim(),
            imageEntries: preparedImages.entries,
            coverUrl: preparedImages.entries[0].previewUrl,
          });
          if (preparedImages.errors.length > 0) {
            imageWarnings.push(`${displayName}: ${preparedImages.errors.length} foto(s) ignorada(s)`);
          }
        } catch (error) {
          skippedProducts.push(`${displayName}: ${error?.message || 'dados inválidos'}`);
        }
      }

      if (preparedItems.length === 0) {
        throw new Error(`Nenhum produto pôde ser importado. ${skippedProducts.slice(0, 3).join(' ')}`.trim());
      }
      setParsedData({
        type: preparedItems.length > 1 ? 'batch' : 'single',
        items: preparedItems,
        fileName: file.name,
      });

      playUiSound('success');
      setImportSuccess(`Arquivo "${file.name}" importado: ${preparedItems.length} produto(s), com todas as fotos prontas em WebP.`);
      const warnings = [...skippedProducts, ...imageWarnings];
      if (warnings.length > 0) {
        setImportError(`Importação parcial: ${warnings.slice(0, 3).join(' ')}`);
      }
    } catch (err) {
      releaseImportedItems(preparedItems);
      playUiSound('pop');
      setImportError(err.message || 'Falha ao processar o arquivo de importação.');
    } finally {
      setIsProcessingFile(false);
    }
  };

  const removeImageFromItem = (itemIndex, imageKey) => {
    if (!parsedData?.items[itemIndex]) return;
    const updatedItems = [...parsedData.items];
    const targetItem = updatedItems[itemIndex];
    const removed = targetItem.imageEntries.find(e => e.key === imageKey);
    if (removed?.previewUrl) {
      try { URL.revokeObjectURL(removed.previewUrl); } catch { /* ignore */ }
    }
    targetItem.imageEntries = targetItem.imageEntries.filter(e => e.key !== imageKey);
    targetItem.coverUrl = targetItem.imageEntries[0]?.previewUrl || '';
    setParsedData({ ...parsedData, items: updatedItems });
    playUiSound('click');
  };

  const setCoverImageForItem = (itemIndex, previewUrl) => {
    if (!parsedData?.items[itemIndex]) return;
    const updatedItems = [...parsedData.items];
    const targetItem = updatedItems[itemIndex];
    const foundIndex = targetItem.imageEntries.findIndex(e => e.previewUrl === previewUrl);
    if (foundIndex > 0) {
      const [moved] = targetItem.imageEntries.splice(foundIndex, 1);
      targetItem.imageEntries.unshift(moved);
    }
    targetItem.coverUrl = previewUrl;
    setParsedData({ ...parsedData, items: updatedItems });
    playUiSound('click');
  };

  const handleApplyToForm = (item) => {
    if (!item) return;
    playUiSound('click');
    onFillForm({
      name: item.name,
      price: item.price,
      stockQuantity: item.stockQuantity,
      category: item.category,
      description: item.description,
      imageEntries: item.imageEntries,
    });
    releaseImportedItems(parsedData?.items, item.imageEntries);
    setParsedData(null);
    setImportSuccess(`Dados de "${item.name}" preenchidos no formulário abaixo! Confira e clique em "Salvar e Publicar".`);
  };

  const handleSaveDirectly = async (item) => {
    if (!item) return;
    setImportError('');
    setImportSuccess('');

    try {
      const files = item.imageEntries.map(e => e.file).filter(Boolean);
      if (files.length === 0) {
        throw new Error('Nenhuma foto válida restante para o cadastro. Adicione fotos ou importe outro arquivo.');
      }

      await onDirectSave({
        name: item.name,
        price: item.price,
        stockQuantity: item.stockQuantity,
        category: item.category,
        description: item.description,
      }, files);

      releaseImportedItems(parsedData?.items);
      playUiSound('success');
      setImportSuccess(`🎉 "${item.name}" cadastrado com sucesso no catálogo e publicado na vitrine!`);
      setParsedData(null);
    } catch (err) {
      playUiSound('pop');
      setImportError(err.message || 'Erro ao salvar o produto diretamente.');
    }
  };

  const handleSaveAllBatch = async () => {
    if (!parsedData || parsedData.items.length === 0) return;
    setImportError('');
    setImportSuccess('');

    const total = parsedData.items.length;
    const failedItems = [];
    const failureMessages = [];

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
          releaseImagePreviewUrls(item.imageEntries);
        } else {
          throw new Error('nenhuma foto WebP válida');
        }
      } catch (err) {
        failedItems.push(item);
        failureMessages.push(`${item.name}: ${err?.message || 'falha ao salvar'}`);
      }
    }

    setBatchProgress(null);
    const successCount = total - failedItems.length;
    if (successCount > 0) {
      playUiSound('success');
      setImportSuccess(`🎉 ${successCount} de ${total} tênis foram adicionados ao catálogo em WebP.`);
    }
    if (failedItems.length > 0) {
      playUiSound('pop');
      setImportError(`Não foi possível salvar ${failedItems.length} item(ns). ${failureMessages.slice(0, 2).join(' ')}`);
      setParsedData({
        ...parsedData,
        type: failedItems.length > 1 ? 'batch' : 'single',
        items: failedItems,
      });
    } else {
      setParsedData(null);
    }
  };

  const resetImporter = () => {
    releaseImportedItems(parsedData?.items);
    setParsedData(null);
    setImportError('');
    setImportSuccess('');
    playUiSound('click');
  };

  return (
    <div className="product-file-importer rounded-3xl p-6 sm:p-7 bg-white border-2 border-dashed border-[#FFB400]/60 hover:border-[#FFB400] transition-all shadow-[0_2px_16px_rgba(180,120,0,0.06)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <span className="section-kicker flex items-center gap-1 text-[#FFB400]">
            <span>📦</span> Importação Automática
          </span>
          <h3 className="text-lg font-extrabold text-[#1C1714]">Importar Tênis via Arquivo (.JSON da Extensão)</h3>
          <p className="text-xs text-[#7A6E65] mt-0.5">
            Arraste ou selecione o JSON 1.0/1.1/1.2 da extensão. Na versão 1.2, cada cor traduzida vira uma divisão separada do tênis, com suas próprias fotos.
          </p>
        </div>

        {parsedData && (
          <button
            type="button"
            onClick={resetImporter}
            className="text-xs font-semibold text-[#7A6E65] hover:text-[#FF6B47] underline self-start sm:self-auto cursor-pointer"
          >
            Limpar / Importar Outro
          </button>
        )}
      </div>

      {importError && (
        <div className="mb-4 rounded-xl bg-rose-500/10 p-3.5 text-xs font-semibold text-rose-600 border border-rose-500/30 flex items-center gap-2">
          <span>❌</span>
          <span>{importError}</span>
        </div>
      )}

      {importSuccess && (
        <div className="mb-4 rounded-xl bg-emerald-500/10 p-3.5 text-xs font-semibold text-emerald-600 border border-emerald-500/30 flex items-center gap-2">
          <span>✓</span>
          <span>{importSuccess}</span>
        </div>
      )}

      {batchProgress && (
        <div className="mb-4 rounded-xl bg-amber-500/10 p-4 border border-amber-500/30 text-xs">
          <div className="flex items-center justify-between font-bold text-amber-700 mb-1">
            <span>Importando Lote ({batchProgress.current} de {batchProgress.total})…</span>
            <span>{Math.round((batchProgress.current / batchProgress.total) * 100)}%</span>
          </div>
          <p className="text-[#1C1714] text-[11px] truncate">Salvando agora: <b>{batchProgress.currentName}</b></p>
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        disabled={isProcessingFile || Boolean(batchProgress)}
        className="sr-only"
        onChange={handleFileInputChange}
      />

      {!parsedData ? (
        /* Dropzone View */
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => {
            if (!isProcessingFile && !batchProgress) fileInputRef.current?.click();
          }}
          className={`rounded-2xl p-8 text-center transition-all flex flex-col items-center justify-center ${
            isProcessingFile ? 'cursor-wait opacity-70 ' : 'cursor-pointer '
          }${
            isDragging
              ? 'bg-[#FFF8E8] border-2 border-[#FFB400] scale-[0.99]'
              : 'bg-[#FFFDF5] border border-black/[0.08] hover:bg-[#FFF8E8]'
          }`}
        >
          <div className="text-4xl mb-2">📥</div>
          <p className="text-sm font-bold text-[#1C1714]">
            {isProcessingFile ? 'Convertendo e otimizando fotos do arquivo…' : isDragging ? 'Solte o arquivo JSON aqui!' : 'Clique ou Arraste o arquivo .JSON aqui'}
          </p>
          <p className="text-xs text-[#7A6E65] mt-1 max-w-md">
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
                <div className="bg-[#FFFDF5] rounded-2xl p-5 border border-black/[0.08] shadow-sm">
                  <div className="flex flex-col md:flex-row gap-5 items-start">
                    {/* Cover & Gallery Thumbnails */}
                    <div className="w-full md:w-56 flex-shrink-0">
                      {item.coverUrl ? (
                        <div className="relative group w-full h-40 rounded-xl border border-black/[0.08] shadow-sm bg-white overflow-hidden p-2 flex items-center justify-center">
                          <img
                            src={item.coverUrl}
                            alt={item.name}
                            className="max-h-full max-w-full object-contain"
                          />
                          <span className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-[9px] font-mono px-1.5 py-0.5 rounded">
                            Capa Principal
                          </span>
                        </div>
                      ) : (
                        <div className="w-full h-40 rounded-xl bg-white border border-black/[0.08] flex items-center justify-center text-3xl">👟</div>
                      )}

                      {/* Small gallery strip with remove button */}
                      {item.imageEntries.length > 0 && (
                        <div className="mt-2.5">
                          <div className="text-[10px] font-mono text-[#9A8F85] uppercase mb-1 flex justify-between">
                            <span>Fotos ({item.imageEntries.length}/8):</span>
                            <span className="text-[#FF6B47]">Clique no X para remover</span>
                          </div>
                          <div className="flex gap-1.5 overflow-x-auto pb-1">
                            {item.imageEntries.map((img) => {
                              const isCover = img.previewUrl === item.coverUrl;
                              return (
                                <div
                                  key={img.key}
                                  className={`relative group/thumb w-12 h-12 rounded-lg bg-white border flex-shrink-0 p-0.5 cursor-pointer ${
                                    isCover ? 'border-2 border-[#FFB400] shadow-sm' : 'border-black/[0.1] hover:border-[#FFB400]/60'
                                  }`}
                                  onClick={() => setCoverImageForItem(0, img.previewUrl)}
                                  title="Clique para definir como foto de capa"
                                >
                                  <img
                                    src={img.previewUrl}
                                    alt=""
                                    className="w-full h-full object-contain"
                                  />
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeImageFromItem(0, img.key);
                                    }}
                                    className="absolute -top-1.5 -right-1.5 bg-[#FF6B47] text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center shadow hover:scale-110 cursor-pointer"
                                    title="Remover esta foto"
                                  >
                                    ✕
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Details */}
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-[#FFF0C8] text-[#B8840A] font-bold text-xs px-2.5 py-0.5 rounded-full border border-[#FFB400]/30 font-mono-tech">
                          {item.category}
                        </span>
                        {item.sourceStore && (
                          <span className="text-[10px] bg-white text-[#7A6E65] px-2 py-0.5 rounded border border-black/[0.08] font-mono-tech">
                            Origem: {item.sourceStore}
                          </span>
                        )}
                        {item.colorName && (
                          <span className="text-[10px] bg-[#EAF8FF] text-[#217CA3] px-2 py-0.5 rounded border border-[#69C8FF]/40 font-mono-tech">
                            Cor: {item.colorName}
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-extrabold text-[#1C1714]">{item.name}</h4>

                      <div className="flex items-center gap-4 text-xs font-mono-tech">
                        <span className="text-emerald-600 font-bold text-sm">
                          {Number(item.price).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                        </span>
                        <span className="text-[#9A8F85]">•</span>
                        <span className="text-[#7A6E65]">Estoque inicial: <b>{item.stockQuantity} un</b></span>
                      </div>

                      {item.description && (
                        <p className="text-xs text-[#7A6E65] line-clamp-2 italic">
                          "{item.description}"
                        </p>
                      )}

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2.5 pt-3">
                        <button
                          type="button"
                          onClick={() => handleApplyToForm(item)}
                          className="btn-brutalist !py-2.5 !px-4 !text-xs cursor-pointer flex items-center gap-1.5 shadow-md"
                        >
                          <span>✨</span> Preencher no Formulário de Edição
                        </button>

                        <button
                          type="button"
                          disabled={isSaving || item.imageEntries.length === 0}
                          onClick={() => handleSaveDirectly(item)}
                          className="px-4 py-2.5 rounded-md text-xs font-bold font-mono-tech uppercase bg-white text-[#1C1714] border border-black/[0.12] hover:border-[#FFB400] hover:bg-[#FFF8E8] cursor-pointer disabled:opacity-50 transition-all"
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
            <div className="bg-[#FFFDF5] rounded-2xl p-5 border border-black/[0.08] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-black/[0.08] pb-3">
                <div>
                  <h4 className="font-extrabold text-sm text-[#1C1714]">
                    📦 Lote com {parsedData.items.length} modelos de tênis
                  </h4>
                  <span className="text-xs text-[#7A6E65]">
                    Todos os itens foram convertidos e otimizados prontos para publicação.
                  </span>
                </div>

                <button
                  type="button"
                  disabled={isSaving || Boolean(batchProgress)}
                  onClick={handleSaveAllBatch}
                  className="btn-brutalist !py-2 !px-4 !text-xs cursor-pointer shadow-md self-start sm:self-auto"
                >
                  <span>⚡</span> Publicar Todos ({parsedData.items.length}) no Catálogo
                </button>
              </div>

              <div className="grid gap-3 max-h-80 overflow-y-auto pr-1">
                {parsedData.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white border border-black/[0.08] text-xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {item.coverUrl ? (
                        <img
                          src={item.coverUrl}
                          alt=""
                          className="w-10 h-10 rounded-lg object-contain bg-[#FFF8E8] border border-black/[0.08] flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-[#FFF8E8] flex items-center justify-center text-sm">👟</div>
                      )}
                      <div className="min-w-0">
                        <span className="font-bold text-[#1C1714] truncate block">{item.name}</span>
                        <div className="flex items-center gap-2 text-[11px] text-[#7A6E65] font-mono-tech">
                          <span>{item.category}</span>
                          <span>•</span>
                          <span className="text-emerald-600 font-bold">R$ {Number(item.price).toFixed(2)}</span>
                          <span>•</span>
                          <span>{item.imageEntries.length} fotos</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleApplyToForm(item)}
                      className="px-2.5 py-1 text-[11px] font-mono-tech font-bold bg-[#FFF8E8] text-[#1C1714] border border-black/[0.1] rounded hover:border-[#FFB400] cursor-pointer flex-shrink-0"
                    >
                      Editar →
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
