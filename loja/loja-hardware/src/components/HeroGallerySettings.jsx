import { useEffect, useMemo, useRef, useState } from 'react';
import { IMAGE_FILE_ACCEPT, prepareImageUpload } from '../utils/imagePreparation';
import { getProductImages } from '../utils/productImages';

const MODE_MANUAL = 'MANUAL';
const MODE_PRODUCTS = 'PRODUCTS';
const MAX_IMAGES = 8;
const MAX_ALT_TEXT_LENGTH = 160;
const INTERVAL_OPTIONS = Array.from({ length: 28 }, (_, index) => index + 3);

export default function HeroGallerySettings({
  settings,
  products,
  settingsError,
  onSave,
  onUpload,
  onDelete,
}) {
  const [mode, setMode] = useState(settings.mode);
  const [intervalSeconds, setIntervalSeconds] = useState(settings.intervalSeconds);
  const [manualImages, setManualImages] = useState(settings.manualImages);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    setMode(settings.mode);
    setIntervalSeconds(settings.intervalSeconds);
    setManualImages(settings.manualImages);
  }, [settings]);

  const eligibleProducts = useMemo(() => (
    products.filter((product) => product.stockQuantity > 0 && getProductImages(product).length > 0).slice(0, 12)
  ), [products]);

  const publishedSignature = settingsSignature(settings);
  const draftSignature = settingsSignature({ mode, intervalSeconds, manualImages });
  const hasUnsavedChanges = publishedSignature !== draftSignature;
  const isMutating = isSaving || isUploading || deletingImageId !== null;

  const openFilePicker = () => {
    const isFirstManualUpload = mode === MODE_MANUAL
      && manualImages.length === 0
      && settings.manualImages.length === 0;
    if (hasUnsavedChanges && !isFirstManualUpload) {
      setMessage('');
      setError('Salve as alterações atuais antes de adicionar outras fotos.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleSave = async () => {
    setMessage('');
    setError('');
    if (mode === MODE_MANUAL && manualImages.length === 0) {
      setError('Adicione pelo menos uma foto antes de ativar o modo manual.');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await onSave({
        mode,
        intervalSeconds: Number(intervalSeconds),
        manualImages: manualImages.map((image) => ({ id: image.id, altText: image.altText?.trim() || '' })),
      });
      setMode(saved.mode);
      setIntervalSeconds(saved.intervalSeconds);
      setManualImages(saved.manualImages);
      setMessage('Destaque atualizado.');
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível salvar o destaque.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFiles = async (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = '';
    setMessage('');
    setError('');
    if (selectedFiles.length === 0) return;

    const remainingSlots = MAX_IMAGES - manualImages.length;
    if (remainingSlots < 1) {
      setError(`Você pode manter até ${MAX_IMAGES} fotos manuais.`);
      return;
    }
    if (selectedFiles.length > remainingSlots) {
      setError(`Escolha no máximo ${remainingSlots} foto${remainingSlots === 1 ? '' : 's'} agora.`);
      return;
    }

    setIsUploading(true);
    try {
      const preparedFiles = [];
      for (const file of selectedFiles) {
        preparedFiles.push({
          file: await prepareImageUpload(file),
          altText: altTextFromFilename(file.name),
        });
      }
      const saved = await onUpload(preparedFiles);
      setManualImages(saved.manualImages);
      setMessage(saved.mode === MODE_MANUAL
        ? `${preparedFiles.length} foto${preparedFiles.length === 1 ? ' adicionada e já exibida' : 's adicionadas e já exibidas'} no destaque.`
        : `${preparedFiles.length} foto${preparedFiles.length === 1 ? ' adicionada' : 's adicionadas'}. Selecione “Minhas fotos” e salve para usá-la no destaque.`);
    } catch (uploadError) {
      setError(uploadError.message || 'Não foi possível enviar as fotos.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (imageId) => {
    setMessage('');
    setError('');
    if (hasUnsavedChanges) {
      setError('Salve as alterações atuais antes de remover uma foto.');
      return;
    }
    const previousMode = mode;
    setDeletingImageId(imageId);
    try {
      const saved = await onDelete(imageId);
      setMode(saved.mode);
      setManualImages(saved.manualImages);
      setMessage(previousMode === MODE_MANUAL && saved.mode === MODE_PRODUCTS
        ? 'A última foto foi removida; o modo Tênis da loja foi ativado.'
        : 'Foto removida do destaque.');
    } catch (requestError) {
      setError(requestError.message || 'Não foi possível remover a foto.');
    } finally {
      setDeletingImageId(null);
    }
  };

  const moveImage = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= manualImages.length) return;
    setManualImages((current) => {
      const reordered = [...current];
      [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
      return reordered;
    });
    setMessage('');
  };

  const updateAltText = (imageId, altText) => {
    setManualImages((current) => current.map((image) => (
      image.id === imageId ? { ...image, altText } : image
    )));
    setMessage('');
  };

  return (
    <section className="admin-card hero-settings-card rounded-2xl p-6">
      <div className="admin-section-heading"><span>02</span><h2>Destaque da página inicial</h2></div>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">Escolha quem controla a foto grande da capa. O texto e o visual da Kicks Store continuam iguais.</p>

      <fieldset className="hero-mode-grid mt-6">
        <legend className="sr-only">Modo das imagens de destaque</legend>
        <label className={`hero-mode-option ${mode === MODE_MANUAL ? 'is-selected' : ''}`}>
          <input type="radio" name="hero-mode" value={MODE_MANUAL} checked={mode === MODE_MANUAL} disabled={isMutating} onChange={() => { setMode(MODE_MANUAL); setMessage(''); }} />
          <span className="hero-mode-icon" aria-hidden="true">▣</span>
          <span><strong>Minhas fotos</strong><small>Eu envio, ordeno e escolho as imagens.</small></span>
        </label>
        <label className={`hero-mode-option ${mode === MODE_PRODUCTS ? 'is-selected' : ''}`}>
          <input type="radio" name="hero-mode" value={MODE_PRODUCTS} checked={mode === MODE_PRODUCTS} disabled={isMutating} onChange={() => { setMode(MODE_PRODUCTS); setMessage(''); }} />
          <span className="hero-mode-icon" aria-hidden="true">↻</span>
          <span><strong>Tênis da loja</strong><small>As fotos dos produtos mudam automaticamente.</small></span>
        </label>
      </fieldset>

      {mode === MODE_PRODUCTS && (
        <div className="hero-auto-settings mt-5">
          <label className="text-xs font-semibold text-[var(--muted)]" htmlFor="hero-interval">Trocar imagem a cada</label>
          <select id="hero-interval" value={intervalSeconds} disabled={isMutating} onChange={(event) => { setIntervalSeconds(Number(event.target.value)); setMessage(''); }} className={`${inputClass} mt-2 max-w-xs disabled:cursor-wait disabled:opacity-60`}>
            {INTERVAL_OPTIONS.map((seconds) => <option key={seconds} value={seconds}>{seconds} segundos</option>)}
          </select>
          <p>{eligibleProducts.length > 0 ? `${eligibleProducts.length} tênis com estoque entrarão no ciclo automático.` : 'Cadastre um tênis com foto e estoque para iniciar o ciclo. Enquanto isso, a capa usa a imagem padrão.'}</p>
        </div>
      )}

      <div className="hero-manual-heading mt-7">
        <div><h3>Fotos enviadas</h3><p>JPG, PNG ou WebP. Até {MAX_IMAGES} fotos; o sistema otimiza arquivos grandes antes do envio.</p></div>
        <button type="button" disabled={isMutating || manualImages.length >= MAX_IMAGES} onClick={openFilePicker} className="admin-primary hero-upload-button cursor-pointer rounded-xl px-5 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">{isUploading ? 'Enviando...' : 'Adicionar fotos'}</button>
        <input ref={fileInputRef} type="file" multiple accept={IMAGE_FILE_ACCEPT} tabIndex={-1} onChange={handleFiles} className="sr-only" />
      </div>

      {manualImages.length > 0 ? (
        <div className="hero-manual-grid mt-4">
          {manualImages.map((image, index) => (
            <article key={image.id} className="hero-manual-item">
              <div className="hero-manual-preview">
                <img src={image.imageUrl} alt="" loading="lazy" />
                <span>{index === 0 ? 'Primeira' : String(index + 1).padStart(2, '0')}</span>
              </div>
              <label>Descrição da imagem<input value={image.altText || ''} disabled={isMutating} onChange={(event) => updateAltText(image.id, event.target.value)} maxLength={MAX_ALT_TEXT_LENGTH} placeholder="Ex: Tênis branco visto de lado" className={`${inputClass} mt-2 disabled:cursor-wait disabled:opacity-60`} /></label>
              <div className="hero-manual-actions">
                <button type="button" onClick={() => moveImage(index, -1)} disabled={isMutating || index === 0} aria-label={`Mover foto ${index + 1} para trás`}>←</button>
                <button type="button" onClick={() => moveImage(index, 1)} disabled={isMutating || index === manualImages.length - 1} aria-label={`Mover foto ${index + 1} para frente`}>→</button>
                <button type="button" onClick={() => handleDelete(image.id)} disabled={isMutating} className="is-danger">{deletingImageId === image.id ? 'Removendo...' : 'Remover'}</button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <button type="button" disabled={isMutating} onClick={openFilePicker} className="hero-upload-empty mt-4 disabled:cursor-wait disabled:opacity-60">
          <span aria-hidden="true">＋</span><strong>{isUploading ? 'Preparando a foto...' : 'Adicione a primeira foto'}</strong><small>Ela ficará disponível no modo manual.</small>
        </button>
      )}

      {(error || settingsError) && <p className="hero-settings-feedback is-error mt-4" role="alert">{error || settingsError}</p>}
      {message && <p className="hero-settings-feedback mt-4" role="status">{message}</p>}

      <div className="hero-settings-footer mt-6">
        <span>{hasUnsavedChanges ? 'Alterações ainda não publicadas' : 'Configuração publicada'}</span>
        <button type="button" onClick={handleSave} disabled={isMutating || !hasUnsavedChanges || (mode === MODE_MANUAL && manualImages.length === 0)} className="admin-primary cursor-pointer rounded-xl px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50">{isSaving ? 'Salvando...' : 'Salvar destaque'}</button>
      </div>
    </section>
  );
}

const inputClass = 'admin-input w-full rounded-xl px-4 py-2.5 text-sm outline-none';

function settingsSignature(settings) {
  return JSON.stringify({
    mode: settings.mode,
    intervalSeconds: Number(settings.intervalSeconds),
    manualImages: (settings.manualImages || []).map((image) => ({ id: image.id, altText: image.altText || '' })),
  });
}

function altTextFromFilename(filename) {
  const readableName = filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim();
  return readableName ? `Tênis ${readableName}`.slice(0, MAX_ALT_TEXT_LENGTH) : 'Tênis em destaque na Kicks Store';
}
