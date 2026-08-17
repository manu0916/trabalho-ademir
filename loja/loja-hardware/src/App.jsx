import { useCallback, useEffect, useMemo, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import Navbar from './components/Navbar';
import ProductGrid from './components/ProductGrid';
import CartDrawer from './components/CartDrawer';
import CheckoutDialog from './components/CheckoutDialog';
import CustomerAccessModal from './components/CustomerAccessModal';
import CustomerAccountModal from './components/CustomerAccountModal';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import StoreHero from './components/StoreHero';
import BrandFooter from './components/BrandFooter';
import PaymentStatusPage from './components/PaymentStatusPage';
import { STORE_THEME } from './themes';
import {
  fetchProducts,
  fetchHeroSettings,
  getCustomerSession,
  logoutCustomer,
  getAdminSession,
  loginAdmin,
  logoutAdmin,
  saveProduct,
  fetchAdminDashboard,
  refundAdminOrder,
  confirmWhatsappPayment,
  cancelWhatsappOrder,
  saveHeroSettings,
  uploadHeroImage,
  deleteHeroImage,
  updateProductStock,
} from './services/api';
import {
  forgetPendingCheckout,
  pendingCheckoutMatchesOrder,
  readPendingCheckout,
  readStoredCart,
  storeCart,
  subtractPurchasedItems,
} from './services/paymentStorage';
import { normalizeCatalogText } from './utils/catalogCategories';

const PAYMENT_ROUTES = {
  '/pagamento/sucesso': 'success',
  '/pagamento/cancelado': 'cancelled',
  '/pagamento/pendente': 'pending',
  '/pagamento/falhou': 'failed',
};

const DEFAULT_HERO_SETTINGS = {
  mode: 'PRODUCTS',
  intervalSeconds: 5,
  manualImages: [],
};

function currentPaymentRoute() {
  const pathname = window.location.pathname.replace(/\/$/, '') || '/';
  return PAYMENT_ROUTES[pathname] || null;
}

function isAdminAuthenticationError(error) {
  return error?.status === 401 || error?.status === 403;
}

export default function App() {
  const paymentRouteKind = currentPaymentRoute();
  const theme = STORE_THEME;
  const storeName = STORE_THEME.name;
  const [currentView, setCurrentView] = useState('shop');
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
  const [customerSession, setCustomerSession] = useState(undefined);
  const [productsError, setProductsError] = useState('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [heroSettings, setHeroSettings] = useState(DEFAULT_HERO_SETTINGS);
  const [heroSettingsError, setHeroSettingsError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dashboard, setDashboard] = useState(null);

  useEffect(() => { storeCart(cart); }, [cart]);
  useEffect(() => {
    document.title = paymentRouteKind ? `Status do pagamento — ${storeName}` : `${storeName} — ${theme.category}`;
    document.documentElement.style.colorScheme = 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.themeColor);
  }, [paymentRouteKind, storeName, theme.category, theme.themeColor]);

  useEffect(() => {
    if (!paymentRouteKind && new URLSearchParams(window.location.search).get('carrinho') === '1') {
      setIsCartOpen(true);
    }
  }, [paymentRouteKind]);

  useEffect(() => {
    let isActive = true;

    fetchProducts()
      .then((data) => {
        if (isActive) setProducts(data);
      })
      .catch((error) => {
        if (isActive) setProductsError(error.message || 'Não foi possível carregar os produtos.');
      })
      .finally(() => {
        if (isActive) setIsLoadingProducts(false);
      });
    fetchHeroSettings()
      .then((settings) => {
        if (isActive) setHeroSettings(normalizeHeroSettings(settings));
      })
      .catch((error) => {
        if (isActive) setHeroSettingsError(error.message || 'Não foi possível carregar as imagens de destaque.');
      });
    getAdminSession()
      .then((session) => {
        if (isActive) setAdminSession(session);
      })
      .catch(() => {
        if (isActive) setAdminSession(null);
      });
    getCustomerSession()
      .then((session) => {
        if (isActive) setCustomerSession(session);
      })
      .catch(() => {
        if (isActive) setCustomerSession(null);
      });

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if ((!resumeCheckoutAfterAuthentication && !resumeAccountAfterAuthentication) || customerSession === undefined) return;

    if (customerSession) {
      setIsCustomerAccessOpen(false);
      if (resumeAccountAfterAuthentication) {
        setResumeAccountAfterAuthentication(false);
        setIsCustomerAccountOpen(true);
        return;
      }
      setResumeCheckoutAfterAuthentication(false);
      setIsCheckoutOpen(true);
      return;
    }

    setIsCustomerAccessOpen(true);
  }, [customerSession, resumeAccountAfterAuthentication, resumeCheckoutAfterAuthentication]);

  useEffect(() => {
    if (paymentRouteKind && customerSession === null) setIsCustomerAccessOpen(true);
    if (customerSession && !resumeCheckoutAfterAuthentication) setIsCustomerAccessOpen(false);
  }, [customerSession, paymentRouteKind, resumeCheckoutAfterAuthentication]);

  useEffect(() => {
    if (!adminSession || currentView !== 'admin') return;
    let isActive = true;
    fetchAdminDashboard()
      .then((nextDashboard) => {
        if (isActive) setDashboard(nextDashboard);
      })
      .catch((error) => {
        if (!isActive) return;
        setDashboard(null);
        if (isAdminAuthenticationError(error)) setAdminSession(null);
      });

    return () => {
      isActive = false;
    };
  }, [adminSession, currentView]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = normalizeCatalogText(searchQuery);
    if (!normalizedQuery) return products;

    return products.filter((product) =>
      [product.name, product.category, product.description]
        .filter(Boolean)
        .some((value) => normalizeCatalogText(value).includes(normalizedQuery)),
    );
  }, [products, searchQuery]);

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
          order.id === Number(orderId) || String(order.id) === String(orderId)
            ? { ...order, ...refundDetails, status: refundStatus || order.status }
            : order
        )),
      }));
      return refund;
    } catch (error) {
      if (isAdminAuthenticationError(error)) setAdminSession(null);
      throw error;
    }
  };

  const handleConfirmWhatsappPayment = async (orderId) => {
    try {
      const updated = await confirmWhatsappPayment(orderId);
      const updatedDetails = updated && typeof updated === 'object' ? updated : {};
      setDashboard((previous) => previous && ({
        ...previous,
        orders: (previous.orders ?? []).map((order) =>
          order.id === Number(orderId) || String(order.id) === String(orderId)
            ? { ...order, ...updatedDetails, canConfirmWhatsapp: false }
            : order
        ),
      }));
      return updated;
    } catch (error) {
      if (isAdminAuthenticationError(error)) setAdminSession(null);
      throw error;
    }
  };

  const handleCancelWhatsappOrder = async (orderId) => {
    try {
      const updated = await cancelWhatsappOrder(orderId);
      const updatedDetails = updated && typeof updated === 'object' ? updated : {};
      setDashboard((previous) => previous && ({
        ...previous,
        orders: (previous.orders ?? []).map((order) =>
          order.id === Number(orderId) || String(order.id) === String(orderId)
            ? { ...order, ...updatedDetails, canConfirmWhatsapp: false, canCancelWhatsapp: false }
            : order
        ),
      }));
      return updated;
    } catch (error) {
      if (isAdminAuthenticationError(error)) setAdminSession(null);
      throw error;
    }
  };

  const handleAdminLogin = async (credentials) => {
    const session = await loginAdmin(credentials);
    setAdminSession(session);
  };

  const handleAddToCart = (product) => {
    const selectedSize = product.selectedSize || '40';
    const selectedColor = product.selectedColor || 'Original Edition';
    const cartKey = `${product.id}-${selectedSize}-${selectedColor}`;

    setCart((previous) => {
      const existingProduct = previous.find((item) => (item.cartKey ? item.cartKey === cartKey : item.id === product.id));
      if (!existingProduct) {
        return [...previous, { ...product, cartKey, selectedSize, selectedColor, quantity: 1 }];
      }

      if (existingProduct.quantity >= product.stockQuantity) return previous;

      return previous.map((item) => (
        (item.cartKey === cartKey || (!item.cartKey && item.id === product.id))
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    });
  };

  const handleRemoveFromCart = (cartKeyOrId) => {
    setCart((previous) => previous.filter((item) => (item.cartKey ? item.cartKey !== cartKeyOrId : item.id !== cartKeyOrId)));
  };

  const handleLogout = async () => {
    try {
      await logoutAdmin();
    } finally {
      setAdminSession(null);
      setCurrentView('shop');
    }
  };

  const handleCheckout = () => {
    setIsCartOpen(false);
    setCheckoutDraft(null);
    if (customerSession) {
      setIsCheckoutOpen(true);
      return;
    }

    setResumeCheckoutAfterAuthentication(true);
    if (customerSession === null) setIsCustomerAccessOpen(true);
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
    if (!customerSession) return;
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
    try {
      await logoutCustomer();
    } finally {
      setCustomerSession(null);
      setIsCustomerAccessOpen(true);
    }
  }, []);

  const handleCustomerLogout = useCallback(async () => {
    try {
      await logoutCustomer();
    } finally {
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

  if (paymentRouteKind) {
    return (
      <MotionConfig reducedMotion="user">
        <div className="app-shell min-h-screen" data-theme={theme.id}>
          <a href="#main-content" className="skip-link">Pular para o conteúdo</a>
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
            <CustomerAccessModal
              isOpen
              onAuthenticated={handleCustomerAuthenticated}
              storeName={storeName}
              initialMode="login"
            />
          )}
        </div>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="app-shell min-h-screen" data-theme={theme.id}>
      <a href="#main-content" className="skip-link">Pular para o conteúdo</a>
      <Navbar
        storeName={storeName}
        cartCount={cart.reduce((total, item) => total + item.quantity, 0)}
        onOpenCart={() => setIsCartOpen(true)}
        currentView={currentView}
        onViewChange={setCurrentView}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        customerSession={customerSession}
        onCustomerAccess={handleOpenCustomerAccess}
        onCustomerAccount={handleOpenCustomerAccount}
        onCustomerLogout={handleCustomerLogout}
      />

      <main id="main-content" className={currentView === 'shop' ? 'shop-main' : 'admin-main py-6'}>
        {currentView === 'shop' ? (
          <>
            <StoreHero
              theme={theme}
              products={products}
              heroSettings={heroSettings}
              onExplore={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
            />
            {isLoadingProducts ? (
              <section className="store-state mx-auto max-w-7xl px-5 py-20 sm:px-8" aria-live="polite">
                <p className="section-kicker">Preparando a curadoria</p>
                <div className="store-state-grid mt-7" aria-hidden="true">
                  {[0, 1, 2].map((item) => <span key={item} className="store-state-card" />)}
                </div>
                <span className="sr-only">Carregando produtos...</span>
              </section>
            ) : productsError ? (
              <section className="store-state mx-auto max-w-7xl px-5 py-20 text-center sm:px-8" role="alert">
                <p className="section-kicker">A vitrine fez uma pausa</p>
                <p className="mt-3 text-sm text-rose-500">{productsError}</p>
              </section>
            ) : (
              <ProductGrid
                products={filteredProducts}
                onAddToCart={handleAddToCart}
                theme={theme}
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery('')}
              />
            )}
            <BrandFooter storeName={storeName} theme={theme} />
          </>
        ) : adminSession === undefined ? (
          <p className="py-12 text-center text-sm text-zinc-400">Verificando acesso...</p>
        ) : adminSession ? (
          <AdminPanel
            theme={theme}
            products={products}
            heroSettings={heroSettings}
            heroSettingsError={heroSettingsError}
            onSaveHeroSettings={handleSaveHeroSettings}
            onUploadHeroImages={handleUploadHeroImages}
            onDeleteHeroImage={handleDeleteHeroImage}
            onAddProduct={handleAddProduct}
            dashboard={dashboard}
            onUpdateStock={handleUpdateStock}
            onRefundOrder={handleRefundOrder}
            onConfirmWhatsappPayment={handleConfirmWhatsappPayment}
            onCancelWhatsappOrder={handleCancelWhatsappOrder}
            onLogout={handleLogout}
          />
        ) : (
          <AdminLogin onAuthenticated={handleAdminLogin} storeName={storeName} theme={theme} />
        )}
      </main>

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cartItems={cart}
        onRemoveItem={handleRemoveFromCart}
        onCheckout={handleCheckout}
      />

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
          onAuthenticationRequired={handleCustomerAccountAuthenticationRequired}
          initialDraft={customerAccountDraft}
          onDraftChange={setCustomerAccountDraft}
        />
      )}

      {isCheckoutOpen && (
        <CheckoutDialog
          isOpen={isCheckoutOpen}
          onClose={handleCloseCheckout}
          cartItems={cart}
          onAuthenticationRequired={handleCheckoutAuthenticationRequired}
          onManageAccount={handleManageAccountFromCheckout}
          initialDraft={checkoutDraft}
          onDraftChange={setCheckoutDraft}
        />
      )}
    </div>
    </MotionConfig>
  );
}

function normalizeHeroSettings(settings) {
  const mode = settings?.mode === 'MANUAL' ? 'MANUAL' : 'PRODUCTS';
  const intervalSeconds = Number(settings?.intervalSeconds);
  return {
    mode,
    intervalSeconds: Number.isInteger(intervalSeconds) && intervalSeconds >= 3 && intervalSeconds <= 30 ? intervalSeconds : 5,
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
