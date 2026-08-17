export function getProductImages(product) {
  const gallery = Array.isArray(product?.images)
    ? product.images
      .filter((image) => image && typeof image.imageUrl === 'string' && image.imageUrl.trim())
      .map((image, index) => ({
        id: image.id ?? null,
        imageUrl: image.imageUrl.trim(),
        altText: typeof image.altText === 'string' ? image.altText.trim() : '',
        sortOrder: Number.isInteger(image.sortOrder) ? image.sortOrder : index,
      }))
      .sort((left, right) => left.sortOrder - right.sortOrder)
    : [];

  if (gallery.length > 0) {
    return gallery.map((image, index) => ({
      ...image,
      key: image.id ? `stored-${image.id}` : `stored-${index}-${image.imageUrl}`,
    }));
  }

  const legacyImageUrl = typeof product?.imageUrl === 'string' ? product.imageUrl.trim() : '';
  return legacyImageUrl
    ? [{ id: null, imageUrl: legacyImageUrl, altText: '', sortOrder: 0, key: `legacy-${legacyImageUrl}` }]
    : [];
}
