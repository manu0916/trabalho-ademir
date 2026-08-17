import { useEffect, useRef, useState } from 'react';
import { IMAGE_FILE_ACCEPT, prepareImageUpload, releaseImagePreviewUrls } from '../utils/imagePreparation';

const MAX_PRODUCT_IMAGES = 8;

export default function ProductImagePicker({ images, onChange, disabled, onBusyChange }) {
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparingLabel, setPreparingLabel] = useState('');
  const [selectionError, setSelectionError] = useState('');
  const inputRef = useRef(null);
  const isMountedRef = useRef(true);
  const latestImagesRef = useRef(images);
  latestImagesRef.current = images;

  useEffect(() => () => {
    isMountedRef.current = false;
    releaseImagePreviewUrls(latestImagesRef.current);
  }, []);

  const setBusy = (busy) => {
    setIsPreparing(busy);
    onBusyChange?.(busy);
  };

  const handleFiles = async (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = '';
    setSelectionError('');
    if (selectedFiles.length === 0) return;

    const remainingSlots = MAX_PRODUCT_IMAGES - images.length;
    if (remainingSlots < 1) {
      setSelectionError(`A galeria aceita até ${MAX_PRODUCT_IMAGES} fotos.`);
      return;
    }
    if (selectedFiles.length > remainingSlots) {
      setSelectionError(`Você pode adicionar mais ${remainingSlots} foto${remainingSlots === 1 ? '' : 's'} nesta galeria.`);
      return;
    }

    const preparedImages = [];
    setBusy(true);
    try {
      for (const [index, sourceFile] of selectedFiles.entries()) {
        if (isMountedRef.current) {
          setPreparingLabel(`Preparando foto ${index + 1} de ${selectedFiles.length}…`);
        }
        const file = await prepareImageUpload(sourceFile);
        if (!isMountedRef.current) {
          releaseImagePreviewUrls(preparedImages);
          return;
        }
        preparedImages.push({
          id: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${index}-${file.name}`,
          file,
          originalName: sourceFile.name,
          previewUrl: URL.createObjectURL(file),
        });
      }
      if (isMountedRef.current) onChange([...images, ...preparedImages]);
    } catch (error) {
      releaseImagePreviewUrls(preparedImages);
      if (isMountedRef.current) {
        setSelectionError(error.message || 'Não foi possível preparar as fotos selecionadas.');
      }
    } finally {
      if (isMountedRef.current) {
        setPreparingLabel('');
        setBusy(false);
      }
    }
  };

  const removeImage = (imageId) => {
    const removed = images.find((image) => image.id === imageId);
    if (removed?.previewUrl) URL.revokeObjectURL(removed.previewUrl);
    onChange(images.filter((image) => image.id !== imageId));
    setSelectionError('');
  };

  const moveImage = (index, direction) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= images.length) return;
    const reordered = [...images];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    onChange(reordered);
  };

  const isDisabled = disabled || isPreparing;

  return (
    <fieldset className="product-gallery-fieldset" disabled={disabled} aria-describedby="product-gallery-help product-gallery-status">
      <legend className="product-gallery-legend">Fotos do tênis <span aria-hidden="true">*</span></legend>
      <div className="product-gallery-heading">
        <p id="product-gallery-help">Selecione de 1 a {MAX_PRODUCT_IMAGES} arquivos JPG, PNG ou WebP. A primeira foto será a capa.</p>
        <span className="product-gallery-count" aria-label={`${images.length} de ${MAX_PRODUCT_IMAGES} fotos selecionadas`}>{images.length}/{MAX_PRODUCT_IMAGES}</span>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={IMAGE_FILE_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-label="Selecionar fotos do tênis"
        onChange={handleFiles}
      />

      {images.length === 0 ? (
        <button type="button" className="product-gallery-empty" disabled={isDisabled} onClick={() => inputRef.current?.click()}>
          <span aria-hidden="true">＋</span>
          <strong>{isPreparing ? 'Otimizando fotos…' : 'Selecionar fotos ou abrir galeria'}</strong>
          <small>Você poderá conferir e ordenar antes de cadastrar.</small>
        </button>
      ) : (
        <>
          <div className="product-gallery-grid">
            {images.map((image, index) => (
              <article className="product-gallery-item" key={image.id}>
                <div className="product-gallery-preview">
                  <img src={image.previewUrl} alt={`Prévia ${index + 1}: ${image.originalName}`} />
                  <span>{index === 0 ? 'Capa' : `Foto ${index + 1}`}</span>
                </div>
                <p title={image.originalName}>{image.originalName}</p>
                <div className="product-gallery-actions">
                  <button type="button" disabled={isDisabled || index === 0} onClick={() => moveImage(index, -1)} aria-label={`Mover ${image.originalName} para antes`}>←</button>
                  <button type="button" disabled={isDisabled || index === images.length - 1} onClick={() => moveImage(index, 1)} aria-label={`Mover ${image.originalName} para depois`}>→</button>
                  <button type="button" disabled={isDisabled} onClick={() => removeImage(image.id)} className="is-danger" aria-label={`Remover ${image.originalName}`}>Remover</button>
                </div>
              </article>
            ))}
          </div>
          <button type="button" className="product-gallery-add" disabled={isDisabled || images.length >= MAX_PRODUCT_IMAGES} onClick={() => inputRef.current?.click()}>
            {isPreparing ? 'Otimizando fotos…' : '＋ Adicionar mais fotos'}
          </button>
        </>
      )}

      <div id="product-gallery-status" className="product-gallery-status" aria-live="polite">
        {preparingLabel && <p>{preparingLabel}</p>}
        {selectionError && <p className="is-error" role="alert">{selectionError}</p>}
      </div>
    </fieldset>
  );
}
