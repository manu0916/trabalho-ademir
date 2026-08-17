export const ALL_CATEGORIES_ID = 'ALL';

export const PRODUCT_CATEGORIES = Object.freeze([
  {
    id: 'BASQUETE',
    value: 'Basquete',
    label: 'Basquete',
    index: '01',
    description: 'Salto, apoio e amortecimento',
  },
  {
    id: 'VOLEI',
    value: 'Vôlei',
    label: 'Vôlei',
    index: '02',
    description: 'Leveza e estabilidade de quadra',
  },
  {
    id: 'HANDBALL',
    value: 'Handball',
    label: 'Handball',
    index: '03',
    description: 'Tração para mudanças rápidas',
  },
  {
    id: 'FUTSAL',
    value: 'Futsal',
    label: 'Futsal',
    index: '04',
    description: 'Controle e contato com a bola',
  },
  {
    id: 'FUTEBOL',
    value: 'Futebol',
    label: 'Futebol',
    index: '05',
    description: 'Performance para o campo',
  },
]);

export const CATALOG_CATEGORIES = Object.freeze([
  {
    id: ALL_CATEGORIES_ID,
    label: 'Todos',
    index: '00',
    description: 'Catálogo completo',
  },
  ...PRODUCT_CATEGORIES,
]);

export function normalizeCatalogText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

export function getCategoryId(value) {
  const normalized = normalizeCatalogText(value);
  if (normalized === 'basquete' || normalized === 'basketball') return 'BASQUETE';
  if (normalized === 'volei' || normalized === 'volleyball') return 'VOLEI';
  if (normalized === 'handball' || normalized === 'handebol') return 'HANDBALL';
  if (normalized === 'futsal') return 'FUTSAL';
  if (normalized === 'futebol' || normalized === 'football' || normalized === 'soccer') return 'FUTEBOL';
  return null;
}

export function getCategoryLabel(value, fallback = 'Tênis') {
  const category = PRODUCT_CATEGORIES.find((item) => item.id === getCategoryId(value));
  const originalValue = String(value ?? '').trim();
  return category?.label || originalValue || fallback;
}
