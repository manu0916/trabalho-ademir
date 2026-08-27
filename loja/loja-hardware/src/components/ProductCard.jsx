import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Heart, ImageOff, ShoppingBag } from 'lucide-react';
import { getCategoryLabel } from '../utils/catalogCategories';
import { getProductImages } from '../utils/productImages';

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

function isUsableImageUrl(value) {
  const url = String(value || '').trim();
  return Boolean(url) && (/^https:\/\//i.test(url) || /^\/(?!\/)/.test(url) || /^data:image\//i.test(url));
}

function uniqueProductImages(product) {
  const seen = new Set();
  return getProductImages(product).filter((image) => {
    if (!isUsableImageUrl(image.imageUrl) || seen.has(image.imageUrl)) return false;
    seen.add(image.imageUrl);
    return true;
  });
}

export default function ProductCard({
  product,
  onOpenProduct,
  onOpen,
  onAddToCart,
  isWishlisted = false,
  onToggleWishlist,
  className = '',
}) {
  const images = useMemo(() => uniqueProductImages(product), [product]);
  const [failedImageUrls, setFailedImageUrls] = useState(() => new Set());

  useEffect(() => {
    setFailedImageUrls(new Set());
  }, [product?.id]);

  if (!product) return null;

  const visibleImages = images.filter((image) => !failedImageUrls.has(image.imageUrl));
  const primaryImage = visibleImages[0];
  const secondaryImage = visibleImages[1];
  const stockQuantity = Number(product.stockQuantity);
  const isAvailable = Number.isFinite(stockQuantity) && stockQuantity > 0;
  const hasPrice = product.price !== null && product.price !== undefined && String(product.price).trim() !== '';
  const numericPrice = hasPrice ? Number(product.price) : Number.NaN;
  const rawCategory = String(product.category || '').trim();
  const category = rawCategory ? getCategoryLabel(rawCategory, rawCategory) : '';
  const hasProductRoute = product.id !== null
    && product.id !== undefined
    && String(product.id).trim() !== '';
  const productHref = hasProductRoute ? `/produto/${encodeURIComponent(String(product.id))}` : '';

  const markImageAsFailed = (imageUrl) => {
    setFailedImageUrls((current) => {
      const next = new Set(current);
      next.add(imageUrl);
      return next;
    });
  };

  const productOpenHandler = onOpenProduct || onOpen;
  const openProduct = (event) => {
    if (
      !productOpenHandler
      || event.defaultPrevented
      || event.button !== 0
      || event.metaKey
      || event.ctrlKey
      || event.shiftKey
      || event.altKey
    ) return;

    event.preventDefault();
    productOpenHandler(product);
  };

  return (
    <article className={`happy-product-card ${className}`.trim()}>
      <div className={`happy-product-card__media ${secondaryImage ? 'has-secondary-image' : ''}`.trim()}>
        {productHref ? (
          <a
            className="happy-product-card__image-button"
            href={productHref}
            onClick={openProduct}
            aria-label={`Ver detalhes de ${product.name}`}
          >
            <ProductImages
              product={product}
              primaryImage={primaryImage}
              secondaryImage={secondaryImage}
              onImageError={markImageAsFailed}
            />
          </a>
        ) : (
          <div className="happy-product-card__image-button" aria-hidden={!primaryImage}>
            <ProductImages
              product={product}
              primaryImage={primaryImage}
              secondaryImage={secondaryImage}
              onImageError={markImageAsFailed}
            />
          </div>
        )}

        {onToggleWishlist && (
          <button
            type="button"
            className={`happy-product-card__favorite ${isWishlisted ? 'is-active' : ''}`}
            onClick={() => onToggleWishlist(product.id)}
            aria-label={isWishlisted ? `Remover ${product.name} dos favoritos` : `Adicionar ${product.name} aos favoritos`}
            aria-pressed={isWishlisted}
          >
            <Heart aria-hidden="true" />
          </button>
        )}

        <span className={`happy-product-card__availability ${isAvailable ? 'is-available' : 'is-unavailable'}`}>
          {isAvailable ? 'Em estoque' : 'Indisponível'}
        </span>
      </div>

      <div className="happy-product-card__content">
        {category && <p className="happy-product-card__category">{category}</p>}
        {productHref ? (
          <h3 className="happy-product-card__title">
            <a href={productHref} onClick={openProduct}>
              <span>{product.name}</span>
              <ArrowUpRight aria-hidden="true" />
            </a>
          </h3>
        ) : (
          <h3 className="happy-product-card__title">{product.name}</h3>
        )}

        <div className="happy-product-card__footer">
          <p className="happy-product-card__price">
            {Number.isFinite(numericPrice) ? currencyFormatter.format(numericPrice) : 'Preço indisponível'}
          </p>

          {isAvailable && onAddToCart && (
            <button
              type="button"
              className="happy-product-card__quick-add"
              onClick={() => onAddToCart(product)}
              aria-label={`Adicionar ${product.name} à sacola`}
            >
              <ShoppingBag aria-hidden="true" />
              <span>Adicionar</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function ProductImages({ product, primaryImage, secondaryImage, onImageError }) {
  if (!primaryImage) {
    return (
      <span className="happy-product-card__image-empty" role="img" aria-label={`Imagem de ${product.name} indisponível`}>
        <ImageOff aria-hidden="true" />
        <span>Imagem em preparação</span>
      </span>
    );
  }

  return (
    <>
      <img
        className="happy-product-card__image happy-product-card__image--primary"
        src={primaryImage.imageUrl}
        alt={primaryImage.altText || product.name}
        loading="lazy"
        decoding="async"
        onError={() => onImageError(primaryImage.imageUrl)}
      />
      {secondaryImage && (
        <img
          className="happy-product-card__image happy-product-card__image--secondary"
          src={secondaryImage.imageUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          onError={() => onImageError(secondaryImage.imageUrl)}
        />
      )}
    </>
  );
}
