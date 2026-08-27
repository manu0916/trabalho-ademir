import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Navbar from './components/Navbar';
import ProductGrid from './components/ProductGrid';
import StorefrontHome from './components/StorefrontHome';
import BrandFooter from './components/BrandFooter';
import NotFoundPage from './components/NotFoundPage';
import Toast from './components/ui/Toast';
import { PageLoading } from './components/ui/LoadingState';
import { STORE_THEME } from './themes';
import {
  cancelWhatsappOrder,
  confirmWhatsappPayment,
  deleteCatalog,
  deleteHeroImage,
  deleteProduct,
  fetchAdminDashboard,
  fetchFooterSettings,
  fetchHeroSettings,
  fetchProducts,
  getAdminSession,
  getCustomerSession,
  loginAdmin,
  logoutAdmin,
  logoutCustomer,
  refundAdminOrder,
  saveHeroSettings,
  saveProduct,
  updateProductStock,
  uploadHeroImage,
} from './services/api';
import {
  forgetPendingCheckout,
  pendingCheckoutMatchesOrder,
  readPendingCheckout,
  readStoredCart,
  storeCart,
  subtractPurchasedItems,
} from './services/paymentStorage';

const CartDrawer = lazy(() => import('./components/CartDrawer'));
const SearchOverlay = lazy(() => import('./components/SearchOverlay'));
const WishlistDrawer = lazy(() => import('./components/WishlistDrawer'));
const CheckoutDialog = lazy(() => import('./components/CheckoutDialog'));
const CustomerAccessModal = lazy(() => import('./components/CustomerAccessModal'));
const CustomerAccountModal = lazy(() => import('./components/CustomerAccountModal'));
const AdminPanel = lazy(() => import('./components/AdminPanel'));
const AdminLogin = lazy(() => import('./components/AdminLogin'));
const PaymentStatusPage = lazy(() => import('./components/PaymentStatusPage'));
const ProductPage = lazy(() => import('./components/ProductPage'));

const PAYMENT_ROUTES = {
  '/pagamento/sucesso': 'success',
  '/pagamento/cancelado': 'cancelled',
  '/pagamento/pendente': 'pending',
  '/pagamento/falhou': 'failed',
};

const ADMIN_ROUTE_PATH = '/gestao-kicks';

const DEFAULT_HERO_SETTINGS = {
  mode: 'PRODUCTS',
  intervalSeconds: 6,
  manualImages: [],
};

const ROUTE_PATHS = {
  home: '/',
  catalog: '/sneakers',
  new: '/novidades',
  offers: '/ofertas',
};

function normalizedPathname() {
  const path = window.location.pathname.replace(/\/+$/, '');
  return path || '/';
}

function currentPaymentRoute() {
  return PAYMENT_ROUTES[normalizedPathname()] || null;
}

function readStoreRoute() {
  const pathname = normalizedPathname();
  if (pathname === '/') return { kind: 'home' };
  if (pathname === '/sneakers' || pathname === '/catalogo') return { kind: 'catalog' };
  if (pathname === '/novidades') return { kind: 'new' };
  if (pathname === '/ofertas') return { kind: 'offers' };
  if (pathname === ADMIN_ROUTE_PATH) return { kind: 'admin' };
  const productMatch = pathname.match(/^\/produto\/([^/]+)$/);
  if (productMatch) {
    try {
      return { kind: 'product', productId: decodeURIComponent(productMatch[1]) };
    } catch {
      return { kind: 'not-found' };
    }
  }
  return { kind: 'not-found' };
}

function isAdminAuthenticationError(error) {
  return error?.status === 401 || error?.status === 403;
}

function normalizeHeroSettings(settings) {
  const mode = settings?.mode === 'MANUAL' ? 'MANUAL' : 'PRODUCTS';
  const intervalSeconds = Number(settings?.intervalSeconds);
  return {
    mode,
    intervalSeconds: Number.isInteger(intervalSeconds) && intervalSeconds >= 3 && intervalSeconds <= 30 ? intervalSeconds : 6,
    manualImages: Array.isArray(settings?.manualImages)
      ? settings.manualImages
        .filter((image) => image?.id && typeof image.imageUrl === 'string')
        .map((image, index) => ({
          id: image.id,
          imageUrl: image.imageUrl,
          altText: typeof image.altText === 'string' ? image.altText : '',
          sortOrder: Number.isInteger(image.sortOrder) ? image.sortOrder : index,
        }))
      : [],
  };
}

function ensureMeta(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement(attributes.tag || 'meta');
    document.head.appendChild(element);
  }
  Object.entries(attributes).forEach(([key, value]) => {
    if (key !== 'tag') element.setAttribute(key, value);
  });
  return element;
}

export default function App() {
  const paymentRouteKind = currentPaymentRoute();
  const theme = STORE_THEME;
  const storeName = theme.name;
  const [route, setRoute] = useState(readStoreRoute);
  const [cart, setCart] = useState(readStoredCart);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isCustomerAccessOpen, setIsCustomerAccessOpen] = useState(false);
  const [isCustomerAccountOpen, setIsCustomerAccountOpen] = useState(false);
  const [resumeCheckoutAfterAuthentication, setResumeCheckoutAfterAuthentication] = useState(false);
  const [resumeAccountAfterAuthentication, setResumeAccountAfterAuthentication] = useState(false);
  const [resumeCheckoutAfterAccount, setResumeCheckoutAfterAccount] = useState(false);
  const [checkoutDraft, setCheckoutDraft] = useState(null);
  const [customerAccountDraft, setCustomerAccountDraft] = useState(null);
  const [products, setProducts] = useState([]);
  const [adminSession, setAdminSession] = useState(undefined);
  const [adminSessionError, setAdminSessionError] = useState('');
  const [customerSession, setCustomerSession] = useState(undefined);
  const [productsError, setProductsError] = useState('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [heroSettings, setHeroSettings] = useState(DEFAULT_HERO_SETTINGS);
  const [heroSettingsError, setHeroSettingsError] = useState('');
  const [searchQuery, setSearchQuery] = useState(() => new URLSearchParams(window.location.search).get('busca') || '');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [dashboardError, setDashboardError] = useState('');
  const [footerSettings, setFooterSettings] = useState(null);
  const [toast, setToast] = useState(null);
  const [wishlistIds, setWishlistIds] = useState(() => {
    try {
      const stored = localStorage.getItem('kicks_store_wishlist');
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];
      return [...new Set(parsed.filter((id) => typeof id === 'string' || typeof id === 'number'))].slice(0, 200);
    } catch {
      return [];
    }
  });
  const [isWishlistOpen, setIsWishlistOpen] = useState(false);

  const currentProduct = useMemo(() => (
    route.kind === 'product'
      ? products.find((product) => String(product.id) === String(route.productId)) || null
      : null
  ), [products, route]);

  const relatedProducts = useMemo(() => {
    if (!currentProduct) return [];
    const sameCategory = products.filter((product) => product.id !== currentProduct.id && product.category === currentProduct.category);
    const others = products.filter((product) => product.id !== currentProduct.id && product.category !== currentProduct.category);
    return [...sameCategory, ...others].slice(0, 3);
  }, [currentProduct, products]);

  const navigationCategories = useMemo(() => (
    [...new Set(products.map((product) => String(product?.category || '').trim()).filter(Boolean))].slice(0, 4)
  ), [products]);

  const showToast = useCallback((nextToast) => {
    setToast({ id: Date.now(), ...nextToast });
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const navigate = useCallback((path, { replace = false } = {}) => {
    const currentLocation = `${normalizedPathname()}${window.location.search}`;
    if (currentLocation !== path) {
      window.history[replace ? 'replaceState' : 'pushState']({}, '', path);
    }
    setRoute(readStoreRoute());
    const destination = new URL(path, window.location.origin);
    setSearchQuery(destination.searchParams.get('busca') || '');
    setIsSearchOpen(false);
    window.scrollTo({ top: 0, behavior: 'auto' });
    window.requestAnimationFrame(() => {
      document.getElementById('main-content')?.focus({ preventScroll: true });
    });
  }, []);

  const handleNavigate = useCallback((target, options = {}) => {
    const query = String(options.query || '').trim();
    setSearchQuery(query);
    const basePath = ROUTE_PATHS[target] || ROUTE_PATHS.catalog;
    navigate(query ? `${basePath}?busca=${encodeURIComponent(query)}` : basePath);
  }, [navigate]);

  const handleOpenProduct = useCallback((product) => {
    if (!product?.id) return;
    navigate(`/produto/${encodeURIComponent(product.id)}`);
  }, [navigate]);

  useEffect(() => {
    const handlePopState = () => {
      setRoute(readStoreRoute());
      setSearchQuery(new URLSearchParams(window.location.search).get('busca') || '');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => { storeCart(cart); }, [cart]);

  useEffect(() => {
    const routeTitle = route.kind === 'product' && currentProduct
      ? `${currentProduct.name} — ${storeName}`
      : route.kind === 'catalog' ? `Sneakers — ${storeName}`
        : route.kind === 'new' ? `Novidades — ${storeName}`
          : route.kind === 'offers' ? `Ofertas — ${storeName}`
            : route.kind === 'admin' ? `Painel — ${storeName}`
              : route.kind === 'not-found' ? `Página não encontrada — ${storeName}`
                : `Calce a felicidade — ${storeName}`;
    const description = route.kind === 'product' && currentProduct?.description
      ? currentProduct.description.slice(0, 155)
      : 'Sneakers para viver o seu ritmo. Explore a Kicks Store e calce a felicidade.';
    const effectiveTitle = paymentRouteKind ? `Status do pedido — ${storeName}` : routeTitle;
    const noIndex = Boolean(paymentRouteKind) || route.kind === 'admin' || route.kind === 'not-found';
    document.title = effectiveTitle;
    document.documentElement.style.colorScheme = 'light';
    document.documentElement.classList.remove('dark');
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#FFF9EC');
    document.querySelector('meta[name="description"]')?.setAttribute('content', description);
    ensureMeta('meta[name="robots"]', { name: 'robots', content: noIndex ? 'noindex, nofollow' : 'index, follow' });
    ensureMeta('meta[property="og:title"]', { property: 'og:title', content: effectiveTitle });
    ensureMeta('meta[property="og:description"]', { property: 'og:description', content: description });
    ensureMeta('meta[property="og:url"]', { property: 'og:url', content: `${window.location.origin}${window.location.pathname}` });
    ensureMeta('meta[property="og:image"]', { property: 'og:image', content: `${window.location.origin}/og-kicks.jpg` });
    ensureMeta('meta[property="og:type"]', { property: 'og:type', content: route.kind === 'product' ? 'product' : 'website' });
    ensureMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' });
    ensureMeta('link[rel="canonical"]', { tag: 'link', rel: 'canonical', href: `${window.location.origin}${window.location.pathname}` });
  }, [currentProduct, paymentRouteKind, route.kind, storeName]);

  useEffect(() => {
    if (!paymentRouteKind && new URLSearchParams(window.location.search).get('carrinho') === '1') setIsCartOpen(true);
  }, [paymentRouteKind]);

  useEffect(() => {
    let isActive = true;

    if (paymentRouteKind) {
      setIsLoadingProducts(false);
      getCustomerSession()
        .then((session) => { if (isActive) setCustomerSession(session); })
        .catch(() => { if (isActive) setCustomerSession(null); });
      return () => { isActive = false; };
    }

    if (route.kind === 'admin') {
      setIsLoadingProducts(false);
      setCustomerSession(undefined);
      return () => { isActive = false; };
    }

    setIsLoadingProducts(true);
    fetchProducts()
      .then((data) => {
        if (!isActive) return;
        setProducts(Array.isArray(data) ? data : []);
        setProductsError('');
      })
      .catch((error) => {
        if (!isActive) return;
        setProducts([]);
        setProductsError(error.message || 'A conexão com o catálogo falhou.');
      })
      .finally(() => { if (isActive) setIsLoadingProducts(false); });

    fetchHeroSettings()
      .then((settings) => { if (isActive) setHeroSettings(normalizeHeroSettings(settings)); })
      .catch((error) => { if (isActive) setHeroSettingsError(error.message || 'Não foi possível carregar o destaque.'); });

    fetchFooterSettings()
      .then((settings) => { if (isActive && settings) setFooterSettings(settings); })
      .catch(() => { if (isActive) setFooterSettings(null); });

    getCustomerSession()
      .then((session) => { if (isActive) setCustomerSession(session); })
      .catch(() => { if (isActive) setCustomerSession(null); });

    return () => { isActive = false; };
  }, [paymentRouteKind, route.kind]);

  useEffect(() => {
    if (route.kind !== 'admin') {
      setAdminSession(undefined);
      setAdminSessionError('');
      return undefined;
    }

    let isActive = true;
    let retryTimer;

    const verifySession = (attempt = 0) => {
      getAdminSession()
        .then((session) => {
          if (!isActive) return;
          setAdminSession(session);
          setAdminSessionError('');
        })
        .catch((error) => {
          if (!isActive) return;
          const message = error.message || 'O servidor da loja est\u00e1 iniciando. Aguarde alguns segundos.';
          setAdminSessionError(message);
          if (attempt < 2) {
            retryTimer = window.setTimeout(() => verifySession(attempt + 1), 3_000);
          } else {
            setAdminSession(null);
          }
        });
    };

    setAdminSession(undefined);
    setAdminSessionError('');
    verifySession();

    return () => {
      isActive = false;
      window.clearTimeout(retryTimer);
    };
  }, [route.kind]);

  useEffect(() => {
    if ((!resumeCheckoutAfterAuthentication && !resumeAccountAfterAuthentication) || customerSession === undefined) return;
    if (customerSession) {
      setIsCustomerAccessOpen(false);
      if (resumeAccountAfterAuthentication) {
        setResumeAccountAfterAuthentication(false);
        setIsCustomerAccountOpen(true);
      } else {
        setResumeCheckoutAfterAuthentication(false);
        setIsCheckoutOpen(true);
      }
      return;
    }
    setIsCustomerAccessOpen(true);
  }, [customerSession, resumeAccountAfterAuthentication, resumeCheckoutAfterAuthentication]);

  useEffect(() => {
    if (paymentRouteKind && customerSession === null) setIsCustomerAccessOpen(true);
    if (customerSession && !resumeCheckoutAfterAuthentication) setIsCustomerAccessOpen(false);
  }, [customerSession, paymentRouteKind, resumeCheckoutAfterAuthentication]);

  useEffect(() => {
    if (!adminSession || route.kind !== 'admin') return undefined;
    let isActive = true;
    setDashboardError('');
    setIsLoadingProducts(true);
    fetchAdminDashboard()
      .then((nextDashboard) => {
        if (!isActive) return;
        setDashboard(nextDashboard);
        setDashboardError('');
      })
      .catch((error) => {
        if (!isActive) return;
        setDashboard(null);
        setDashboardError(error.message || 'Não foi possível carregar os dados administrativos.');
        if (isAdminAuthenticationError(error)) setAdminSession(null);
      });

    fetchProducts()
      .then((data) => {
        if (!isActive) return;
        setProducts(Array.isArray(data) ? data : []);
        setProductsError('');
      })
      .catch((error) => {
        if (!isActive) return;
        setProductsError(error.message || 'N\u00e3o foi poss\u00edvel carregar o cat\u00e1logo administrativo.');
        if (isAdminAuthenticationError(error)) setAdminSession(null);
      })
      .finally(() => { if (isActive) setIsLoadingProducts(false); });

    fetchHeroSettings()
      .then((settings) => {
        if (!isActive) return;
        setHeroSettings(normalizeHeroSettings(settings));
        setHeroSettingsError('');
      })
      .catch((error) => {
        if (!isActive) return;
        setHeroSettingsError(error.message || 'N\u00e3o foi poss\u00edvel carregar o destaque.');
        if (isAdminAuthenticationError(error)) setAdminSession(null);
      });

    return () => { isActive = false; };
  }, [adminSession, route.kind]);

  const handleToggleWishlist = useCallback((productId) => {
    setWishlistIds((previous) => {
      const exists = previous.includes(productId);
      const next = exists ? previous.filter((id) => id !== productId) : [...previous, productId];
      try { localStorage.setItem('kicks_store_wishlist', JSON.stringify(next)); } catch { /* Storage can be unavailable. */ }
      const productName = products.find((product) => product.id === productId)?.name;
      showToast(exists
        ? { tone: 'favorite', title: 'Favorito removido', message: productName || 'Sua lista foi atualizada.' }
        : { tone: 'favorite', title: 'Rolou match!', message: productName ? `${productName} foi salvo nos favoritos.` : 'Par salvo nos favoritos.' });
      return next;
    });
  }, [products, showToast]);

  const handleAddProduct = async (newProduct, imageFiles) => {
    try {
      const saved = await saveProduct(newProduct, imageFiles);
      setProducts((previous) => [saved, ...previous]);
      setDashboard((previous) => previous && ({
        ...previous,
        registeredProducts: previous.registeredProducts + 1,
        inventory: [saved, ...previous.inventory],
      }));
      return saved;
    } catch (error) {
      if (isAdminAuthenticationError(error)) setAdminSession(null);
      throw error;
    }
  };

  const handleDeleteProduct = async (productId) => {
    try {
      await deleteProduct(productId);
      setProducts((previous) => previous.filter((product) => product.id !== productId));
      setDashboard((previous) => previous && ({
        ...previous,
        registeredProducts: Math.max(0, (previous.registeredProducts || 1) - 1),
        inventory: previous.inventory ? previous.inventory.filter((p) => p.id !== productId) : [],
      }));
      showToast({ tone: 'default', title: 'Produto excluído', message: 'O item foi removido com sucesso do catálogo.' });
    } catch (error) {
      if (isAdminAuthenticationError(error)) setAdminSession(null);
      throw error;
    }
  };

  const handleDeleteCatalog = async (confirmation) => {
    try {
      const result = await deleteCatalog(confirmation);
      setProducts([]);
      setProductsError('');
      setDashboard((previous) => previous && ({
        ...previous,
        registeredProducts: 0,
        inventory: [],
      }));
      return result;
    } catch (error) {
      if (isAdminAuthenticationError(error)) setAdminSession(null);
      throw error;
    }
  };

  const handleSaveHeroSettings = async (settings) => {
    try {
      const saved = normalizeHeroSettings(await saveHeroSettings(settings));
      setHeroSettings(saved);
      setHeroSettingsError('');
      return saved;
    } catch (error) {
      if (isAdminAuthenticationError(error)) setAdminSession(null);
      throw error;
    }
  };

  const handleUploadHeroImages = async (images) => {
    let saved = heroSettings;
    try {
      for (const image of images) {
        saved = normalizeHeroSettings(await uploadHeroImage(image.file, image.altText));
        setHeroSettings(saved);
      }
      setHeroSettingsError('');
      return saved;
    } catch (error) {
      if (isAdminAuthenticationError(error)) setAdminSession(null);
      throw error;
    }
  };

  const handleDeleteHeroImage = async (imageId) => {
    try {
      const saved = normalizeHeroSettings(await deleteHeroImage(imageId));
      setHeroSettings(saved);
      setHeroSettingsError('');
      return saved;
    } catch (error) {
      if (isAdminAuthenticationError(error)) setAdminSession(null);
      throw error;
    }
  };

  const handleUpdateStock = async (productId, stockQuantity) => {
    try {
      const saved = await updateProductStock(productId, stockQuantity);
      setProducts((previous) => previous.map((product) => product.id === saved.id ? saved : product));
      setDashboard((previous) => previous && ({
        ...previous,
        inventory: previous.inventory.map((product) => product.id === saved.id ? saved : product),
      }));
    } catch (error) {
      if (isAdminAuthenticationError(error)) setAdminSession(null);
      throw error;
    }
  };

  const handleRefundOrder = async (orderId) => {
    try {
      const refund = await refundAdminOrder(orderId);
      const refundDetails = refund && typeof refund === 'object' ? refund : {};
      const refundStatus = typeof refund === 'string' ? refund : refund?.status;
      setDashboard((previous) => previous && ({
        ...previous,
        orders: (previous.orders ?? []).map((order) => (
          String(order.id) === String(orderId) ? { ...order, ...refundDetails, status: refundStatus || order.status } : order
        )),
      }));
      await refreshAdminSnapshot();
      return refund;
    } catch (error) {
      if (isAdminAuthenticationError(error)) setAdminSession(null);
      throw error;
    }
  };

  const updateDashboardOrder = (orderId, updated, flags = {}) => {
    const updatedDetails = updated && typeof updated === 'object' ? updated : {};
    setDashboard((previous) => previous && ({
      ...previous,
      orders: (previous.orders ?? []).map((order) => (
        String(order.id) === String(orderId) ? { ...order, ...updatedDetails, ...flags } : order
      )),
    }));
    return updated;
  };

  const refreshAdminSnapshot = async () => {
    const [dashboardResult, productsResult] = await Promise.allSettled([
      fetchAdminDashboard(),
      fetchProducts(),
    ]);

    if (dashboardResult.status === 'fulfilled') {
      setDashboard(dashboardResult.value);
      setDashboardError('');
    } else {
      setDashboardError(dashboardResult.reason?.message || 'A ação foi concluída, mas os indicadores não puderam ser atualizados.');
      if (isAdminAuthenticationError(dashboardResult.reason)) setAdminSession(null);
    }

    if (productsResult.status === 'fulfilled') {
      setProducts(Array.isArray(productsResult.value) ? productsResult.value : []);
      setProductsError('');
    } else {
      setProductsError(productsResult.reason?.message || 'A ação foi concluída, mas o estoque exibido pode estar desatualizado.');
      if (isAdminAuthenticationError(productsResult.reason)) setAdminSession(null);
    }
  };

  const handleConfirmWhatsappPayment = async (orderId) => {
    try {
      const updated = updateDashboardOrder(orderId, await confirmWhatsappPayment(orderId), { canConfirmWhatsapp: false });
      await refreshAdminSnapshot();
      return updated;
    } catch (error) {
      if (isAdminAuthenticationError(error)) setAdminSession(null);
      throw error;
    }
  };

  const handleCancelWhatsappOrder = async (orderId) => {
    try {
      const updated = updateDashboardOrder(orderId, await cancelWhatsappOrder(orderId), { canConfirmWhatsapp: false, canCancelWhatsapp: false });
      await refreshAdminSnapshot();
      return updated;
    } catch (error) {
      if (isAdminAuthenticationError(error)) setAdminSession(null);
      throw error;
    }
  };

  const handleAdminLogin = async (credentials) => {
    const session = await loginAdmin(credentials);
    setAdminSessionError('');
    setAdminSession(session);
    return session;
  };

  const handleAddToCart = useCallback((product, customSize = null, customColor = null) => {
    const stock = Number(product?.stockQuantity || 0);
    if (!product?.id || stock <= 0) {
      showToast({ tone: 'default', title: 'Este par está descansando', message: 'O estoque está zerado no momento.' });
      return;
    }
    const selectedSize = customSize || product.selectedSize || null;
    const selectedColor = customColor || product.selectedColor || null;
    const cartKey = `${product.id}-${selectedSize || ''}-${selectedColor || ''}`;
    const targetImage = product.images?.[0]?.imageUrl || product.imageUrl;
    const existingProduct = cart.find((item) => (item.cartKey ? item.cartKey === cartKey : item.id === product.id));

    if (existingProduct && Number(existingProduct.quantity) >= stock) {
      showToast({ tone: 'default', title: 'Você já levou todo o estoque', message: 'Não há mais unidades disponíveis deste cadastro.' });
      setIsCartOpen(true);
      return;
    }

    setCart((previous) => {
      const previousProduct = previous.find((item) => (item.cartKey ? item.cartKey === cartKey : item.id === product.id));
      if (!previousProduct) return [...previous, { ...product, imageUrl: targetImage, cartKey, selectedSize, selectedColor, quantity: 1 }];
      return previous.map((item) => (
        item.cartKey === cartKey || (!item.cartKey && item.id === product.id)
          ? { ...item, quantity: Math.min(Number(item.quantity || 0) + 1, stock) }
          : item
      ));
    });

    showToast({ tone: 'cart', title: 'Boa escolha!', message: `${product.name} entrou na sacola.` });
    setIsCartOpen(true);
  }, [cart, showToast]);

  const handleRemoveFromCart = useCallback((cartKeyOrId) => {
    setCart((previous) => previous.filter((item) => (item.cartKey ? item.cartKey !== cartKeyOrId : item.id !== cartKeyOrId)));
    showToast({ tone: 'default', title: 'Sacola atualizada', message: 'O item foi removido.' });
  }, [showToast]);

  const handleChangeQuantity = useCallback((cartKeyOrId, nextQuantity) => {
    if (nextQuantity <= 0) {
      handleRemoveFromCart(cartKeyOrId);
      return;
    }
    setCart((previous) => previous.map((item) => {
      const matches = item.cartKey ? item.cartKey === cartKeyOrId : item.id === cartKeyOrId;
      if (!matches) return item;
      const currentQuantity = Math.max(1, Number(item.quantity || 1));
      const stock = Number(item.stockQuantity);
      const maximum = Number.isFinite(stock) && stock > 0 ? stock : currentQuantity;
      return { ...item, quantity: Math.max(1, Math.min(nextQuantity, maximum)) };
    }));
  }, [handleRemoveFromCart]);

  const handleLogout = async () => {
    try { await logoutAdmin(); } finally { setAdminSession(null); navigate('/'); }
  };

  const handleCheckout = () => {
    setIsCartOpen(false);
    setCheckoutDraft(null);
    if (customerSession) setIsCheckoutOpen(true);
    else {
      setResumeCheckoutAfterAuthentication(true);
      if (customerSession === null) setIsCustomerAccessOpen(true);
    }
  };

  const handleCustomerAuthenticated = useCallback((session) => {
    setCustomerSession(session);
    setIsCustomerAccessOpen(false);
  }, []);

  const handleOpenCustomerAccess = useCallback(() => {
    setResumeCheckoutAfterAuthentication(false);
    setResumeAccountAfterAuthentication(false);
    setIsCustomerAccessOpen(true);
  }, []);

  const handleOpenCustomerAccount = useCallback(() => {
    if (!customerSession) {
      setIsCustomerAccessOpen(true);
      return;
    }
    setResumeCheckoutAfterAccount(false);
    setCustomerAccountDraft(null);
    setIsCustomerAccountOpen(true);
  }, [customerSession]);

  const handleCloseCustomerAccount = useCallback(() => {
    setIsCustomerAccountOpen(false);
    setCustomerAccountDraft(null);
    if (resumeCheckoutAfterAccount) {
      setResumeCheckoutAfterAccount(false);
      setIsCheckoutOpen(true);
    }
  }, [resumeCheckoutAfterAccount]);

  const handleCustomerAccountAuthenticationRequired = useCallback((draft) => {
    if (draft) setCustomerAccountDraft(draft);
    setIsCustomerAccountOpen(false);
    setCustomerSession(null);
    setResumeAccountAfterAuthentication(true);
    setIsCustomerAccessOpen(true);
  }, []);

  const handleCustomerAccessClose = useCallback(() => {
    const shouldReturnToCart = resumeCheckoutAfterAuthentication || resumeCheckoutAfterAccount;
    setIsCustomerAccessOpen(false);
    setCheckoutDraft(null);
    setCustomerAccountDraft(null);
    setResumeCheckoutAfterAuthentication(false);
    setResumeAccountAfterAuthentication(false);
    setResumeCheckoutAfterAccount(false);
    if (shouldReturnToCart) setIsCartOpen(true);
  }, [resumeCheckoutAfterAccount, resumeCheckoutAfterAuthentication]);

  const handleCheckoutAuthenticationRequired = useCallback((draft) => {
    if (draft) setCheckoutDraft(draft);
    setCustomerSession(null);
    setIsCheckoutOpen(false);
    setResumeCheckoutAfterAuthentication(true);
    setIsCustomerAccessOpen(true);
  }, []);

  const handleCloseCheckout = useCallback(() => {
    setIsCheckoutOpen(false);
    setCheckoutDraft(null);
  }, []);

  const handleManageAccountFromCheckout = useCallback(() => {
    setIsCheckoutOpen(false);
    setResumeCheckoutAfterAccount(true);
    setCustomerAccountDraft(null);
    setIsCustomerAccountOpen(true);
  }, []);

  const handlePaymentConfirmed = useCallback((payment) => {
    if (payment?.paymentVerified !== true) return false;
    const pendingCheckout = readPendingCheckout();
    if (!pendingCheckoutMatchesOrder(payment.orderId, pendingCheckout)) return false;
    setCart((currentCart) => subtractPurchasedItems(currentCart, pendingCheckout.items));
    forgetPendingCheckout(payment.orderId);
    return true;
  }, []);

  const handlePaymentTerminated = useCallback((orderId) => forgetPendingCheckout(orderId), []);
  const handleCustomerAuthenticationRequired = useCallback(() => {
    setCustomerSession(null);
    setIsCustomerAccessOpen(true);
  }, []);

  const handleSwitchCustomer = useCallback(async () => {
    try { await logoutCustomer(); } finally { setCustomerSession(null); setIsCustomerAccessOpen(true); }
  }, []);

  const handleCustomerLogout = useCallback(async () => {
    try { await logoutCustomer(); } finally {
      setCustomerSession(null);
      setIsCustomerAccountOpen(false);
      setCheckoutDraft(null);
      setCustomerAccountDraft(null);
      setResumeAccountAfterAuthentication(false);
      setResumeCheckoutAfterAccount(false);
      setIsCustomerAccessOpen(false);
      setResumeCheckoutAfterAuthentication(false);
    }
  }, []);

  const suspenseFallback = <PageLoading />;

  if (paymentRouteKind) {
    return (
      <div className="app-shell payment-shell">
        <Suspense fallback={suspenseFallback}>
          <PaymentStatusPage
            routeKind={paymentRouteKind}
            storeName={storeName}
            customerSession={customerSession}
            onAuthenticationRequired={handleCustomerAuthenticationRequired}
            onSwitchAccount={handleSwitchCustomer}
            onPaymentConfirmed={handlePaymentConfirmed}
            onPaymentTerminated={handlePaymentTerminated}
          />
          {isCustomerAccessOpen && (
            <CustomerAccessModal isOpen onAuthenticated={handleCustomerAuthenticated} storeName={storeName} initialMode="login" />
          )}
        </Suspense>
      </div>
    );
  }

  const isAdmin = route.kind === 'admin';
  const storefrontContent = (() => {
    if (route.kind === 'home') {
      return (
        <StorefrontHome
          products={products}
          isLoading={isLoadingProducts}
          error={productsError}
          heroSettings={heroSettings}
          onExplore={() => navigate('/sneakers')}
          onOpenProduct={handleOpenProduct}
          onAddToCart={handleAddToCart}
          wishlistIds={wishlistIds}
          onToggleWishlist={handleToggleWishlist}
          onOpenAccount={customerSession ? handleOpenCustomerAccount : handleOpenCustomerAccess}
          customerSession={customerSession}
          onRetry={() => window.location.reload()}
        />
      );
    }
    if (['catalog', 'new', 'offers'].includes(route.kind)) {
      return (
        <main id="main-content" className="catalog-page" tabIndex={-1}>
          <ProductGrid
            products={products}
            onAddToCart={handleAddToCart}
            searchQuery={searchQuery}
            onClearSearch={() => setSearchQuery('')}
            wishlistIds={wishlistIds}
            onToggleWishlist={handleToggleWishlist}
            onOpenProduct={handleOpenProduct}
            isLoading={isLoadingProducts}
            error={productsError}
            mode={route.kind}
          />
        </main>
      );
    }
    if (route.kind === 'product') {
      if (!isLoadingProducts && !productsError && !currentProduct) return <NotFoundPage onHome={() => navigate('/')} />;
      return (
        <Suspense fallback={suspenseFallback}>
          <ProductPage
            product={currentProduct}
            relatedProducts={relatedProducts}
            isLoading={isLoadingProducts}
            error={productsError}
            onBack={() => navigate('/sneakers')}
            onAddToCart={handleAddToCart}
            onOpenProduct={handleOpenProduct}
            isWishlisted={Boolean(currentProduct && wishlistIds.includes(currentProduct.id))}
            wishlistIds={wishlistIds}
            onToggleWishlist={handleToggleWishlist}
            customerSession={customerSession}
            onOpenLogin={handleOpenCustomerAccess}
            onRetry={() => window.location.reload()}
          />
        </Suspense>
      );
    }
    return <NotFoundPage onHome={() => navigate('/')} />;
  })();

  return (
    <div className="app-shell">
      <Navbar
        storeName={storeName}
        cartCount={cart.reduce((total, item) => total + Number(item.quantity || 0), 0)}
        onOpenCart={() => setIsCartOpen(true)}
        currentView={isAdmin ? 'admin' : 'shop'}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        customerSession={customerSession}
        onCustomerAccess={handleOpenCustomerAccess}
        onCustomerAccount={handleOpenCustomerAccount}
        onCustomerLogout={handleCustomerLogout}
        wishlistCount={wishlistIds.length}
        onOpenWishlist={() => setIsWishlistOpen(true)}
        onOpenSearch={() => setIsSearchOpen(true)}
        onNavigate={handleNavigate}
        onOpenProduct={handleOpenProduct}
        categories={navigationCategories}
        products={products}
        activeTarget={route.kind}
      />

      {isAdmin ? (
        <main id="main-content" className="admin-main" tabIndex={-1}>
          <Suspense fallback={suspenseFallback}>
            {adminSession === undefined ? <PageLoading label={adminSessionError || 'Verificando acesso ao painel...'} /> : adminSession ? (
              <AdminPanel
                theme={theme}
                products={products}
                heroSettings={heroSettings}
                heroSettingsError={heroSettingsError}
                onSaveHeroSettings={handleSaveHeroSettings}
                onUploadHeroImages={handleUploadHeroImages}
                onDeleteHeroImage={handleDeleteHeroImage}
                onAddProduct={handleAddProduct}
                onDeleteProduct={handleDeleteProduct}
                onDeleteCatalog={handleDeleteCatalog}
                dashboard={dashboard}
                dashboardError={dashboardError}
                productsError={productsError}
                onRetryDashboard={refreshAdminSnapshot}
                onRetryProducts={refreshAdminSnapshot}
                onUpdateStock={handleUpdateStock}
                onRefundOrder={handleRefundOrder}
                onConfirmWhatsappPayment={handleConfirmWhatsappPayment}
                onCancelWhatsappOrder={handleCancelWhatsappOrder}
                onLogout={handleLogout}
                onFooterUpdated={setFooterSettings}
              />
            ) : <AdminLogin onAuthenticated={handleAdminLogin} serviceMessage={adminSessionError} storeName={storeName} theme={theme} />}
          </Suspense>
        </main>
      ) : storefrontContent}

      {!isAdmin && route.kind !== 'not-found' && (
        <BrandFooter
          storeName={storeName}
          footerSettings={footerSettings}
          onNavigate={handleNavigate}
          onOpenAccount={customerSession ? handleOpenCustomerAccount : handleOpenCustomerAccess}
        />
      )}

      {isSearchOpen && (
        <Suspense fallback={null}>
          <SearchOverlay
            isOpen
            onClose={() => setIsSearchOpen(false)}
            products={products}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            onSelectProduct={handleOpenProduct}
            onViewCatalog={() => navigate('/sneakers')}
          />
        </Suspense>
      )}

      <Suspense fallback={null}>
        {isCartOpen && (
          <CartDrawer
            isOpen
            onClose={() => setIsCartOpen(false)}
            onExplore={() => {
              setIsCartOpen(false);
              navigate('/sneakers');
            }}
            cartItems={cart}
            onRemoveItem={handleRemoveFromCart}
            onChangeQuantity={handleChangeQuantity}
            onCheckout={handleCheckout}
          />
        )}

        {isWishlistOpen && (
          <WishlistDrawer
            isOpen
            onClose={() => setIsWishlistOpen(false)}
            onExplore={() => {
              setIsWishlistOpen(false);
              navigate('/sneakers');
            }}
            wishlistIds={wishlistIds}
            products={products}
            onToggleWishlist={handleToggleWishlist}
            onOpenProductDetail={(product) => {
              setIsWishlistOpen(false);
              handleOpenProduct(product);
            }}
          />
        )}

        {isCustomerAccessOpen && (
          <CustomerAccessModal
            isOpen
            onAuthenticated={handleCustomerAuthenticated}
            onClose={handleCustomerAccessClose}
            storeName={storeName}
            initialMode="login"
            checkoutRequired={resumeCheckoutAfterAuthentication || resumeCheckoutAfterAccount}
          />
        )}

        {isCustomerAccountOpen && customerSession && (
          <CustomerAccountModal
            isOpen
            onClose={handleCloseCustomerAccount}
            onLogout={handleCustomerLogout}
            onAuthenticationRequired={handleCustomerAccountAuthenticationRequired}
            initialDraft={customerAccountDraft}
            onDraftChange={setCustomerAccountDraft}
          />
        )}

        {isCheckoutOpen && (
          <CheckoutDialog
            isOpen
            onClose={handleCloseCheckout}
            cartItems={cart}
            onAuthenticationRequired={handleCheckoutAuthenticationRequired}
            onManageAccount={handleManageAccountFromCheckout}
            initialDraft={checkoutDraft}
            onDraftChange={setCheckoutDraft}
          />
        )}
      </Suspense>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
