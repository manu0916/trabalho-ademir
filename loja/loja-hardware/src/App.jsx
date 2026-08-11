import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import Navbar from './components/Navbar';
import ProductGrid from './components/ProductGrid';
import CartDrawer from './components/CartDrawer';
import CheckoutDialog from './components/CheckoutDialog';
import CustomerAccessModal from './components/CustomerAccessModal';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import StoreHero from './components/StoreHero';
import BrandFooter from './components/BrandFooter';
import PaymentStatusPage from './components/PaymentStatusPage';
import { STORE_THEMES } from './themes';
import {
  fetchProducts,
  getCustomerSession,
  logoutCustomer,
  getAdminSession,
  loginAdmin,
  logoutAdmin,
  saveProduct,
  fetchAdminDashboard,
  refundAdminOrder,
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

const PAYMENT_ROUTES = {
  '/pagamento/sucesso': 'success',
  '/pagamento/cancelado': 'cancelled',
  '/pagamento/pendente': 'pending',
  '/pagamento/falhou': 'failed',
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
  const [themeId, setThemeId] = useState(() => localStorage.getItem('store-theme') || 'hardware');
  const [storeName, setStoreName] = useState(() => localStorage.getItem('store-name') || STORE_THEMES.hardware.name);
  const [currentView, setCurrentView] = useState('shop');
  const [cart, setCart] = useState(readStoredCart);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [adminSession, setAdminSession] = useState(undefined);
  const [customerSession, setCustomerSession] = useState(undefined);
  const [productsError, setProductsError] = useState('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [themeTransition, setThemeTransition] = useState(null);
  const themeTransitionTimer = useRef(null);
  const theme = STORE_THEMES[themeId] || STORE_THEMES.hardware;

  useEffect(() => { localStorage.setItem('store-theme', theme.id); }, [theme.id]);
  useEffect(() => { storeCart(cart); }, [cart]);
  useEffect(() => () => window.clearTimeout(themeTransitionTimer.current), []);
  useEffect(() => {
    document.title = paymentRouteKind ? `Status do pagamento — ${storeName}` : `${storeName} — ${theme.category}`;
    document.documentElement.style.colorScheme = theme.id === 'hardware' ? 'dark' : 'light';
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.themeColor);
  }, [paymentRouteKind, storeName, theme.category, theme.id, theme.themeColor]);

  useEffect(() => {
    if (!paymentRouteKind && new URLSearchParams(window.location.search).get('carrinho') === '1') {
      setIsCartOpen(true);
    }
  }, [paymentRouteKind]);

  const handleThemeChange = (nextThemeId) => {
    const nextTheme = STORE_THEMES[nextThemeId];
    if (!nextTheme) return;
    const previousTheme = STORE_THEMES[themeId];
    setThemeTransition(nextThemeId);
    window.clearTimeout(themeTransitionTimer.current);
    themeTransitionTimer.current = window.setTimeout(() => setThemeTransition(null), 760);
    setThemeId(nextThemeId);
    setStoreName((currentName) => {
      const nextName = currentName === previousTheme.name ? nextTheme.name : currentName;
      localStorage.setItem('store-name', nextName);
      return nextName;
    });
  };

  const handleStoreNameChange = (nextName) => {
    setStoreName(nextName);
    localStorage.setItem('store-name', nextName);
  };

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
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('pt-BR');
    if (!normalizedQuery) return products;

    return products.filter((product) =>
      [product.name, product.category, product.description]
        .filter(Boolean)
        .some((value) => value.toLocaleLowerCase('pt-BR').includes(normalizedQuery)),
    );
  }, [products, searchQuery]);

  const handleAddProduct = async (newProduct) => {
    try {
      const saved = await saveProduct(newProduct);
      setProducts((previous) => [saved, ...previous]);
      setDashboard((previous) => previous && ({
        ...previous,
        registeredProducts: previous.registeredProducts + 1,
        inventory: [saved, ...previous.inventory],
      }));
      alert('Produto salvo com sucesso no banco de dados.');
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

  const handleAdminLogin = async (credentials) => {
    const session = await loginAdmin(credentials);
    setAdminSession(session);
  };

  const handleAddToCart = (product) => {
    setCart((previous) => {
      const existingProduct = previous.find((item) => item.id === product.id);
      if (!existingProduct) return [...previous, { ...product, quantity: 1 }];

      if (existingProduct.quantity >= product.stockQuantity) return previous;

      return previous.map((item) => (
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    });
  };

  const handleRemoveFromCart = (productId) => {
    setCart((previous) => previous.filter((item) => item.id !== productId));
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
    setIsCheckoutOpen(true);
  };

  const handlePaymentConfirmed = useCallback((payment) => {
    if (payment?.paymentVerified !== true) return false;
    const pendingCheckout = readPendingCheckout();
    if (!pendingCheckoutMatchesOrder(payment.orderId, pendingCheckout)) return false;

    setCart((currentCart) => subtractPurchasedItems(currentCart, pendingCheckout.items));
    forgetPendingCheckout(payment.orderId);
    return true;
  }, []);

  const handlePaymentTerminated = useCallback((orderId) => forgetPendingCheckout(orderId), []);
  const handleCustomerAuthenticationRequired = useCallback(() => setCustomerSession(null), []);
  const handleSwitchCustomer = useCallback(async () => {
    try {
      await logoutCustomer();
    } finally {
      setCustomerSession(null);
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
          <CustomerAccessModal
            isOpen={customerSession === null}
            onAuthenticated={setCustomerSession}
            storeName={storeName}
            initialMode="login"
          />
        </div>
      </MotionConfig>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="app-shell min-h-screen" data-theme={theme.id}>
      <a href="#main-content" className="skip-link">Pular para o conteúdo</a>
      <AnimatePresence>
        {themeTransition && (
          <motion.div
            key={themeTransition}
            aria-hidden="true"
            className="theme-sweep"
            initial={{ opacity: 0, clipPath: 'circle(0% at 50% 50%)' }}
            animate={{ opacity: 1, clipPath: 'circle(82% at 50% 50%)' }}
            exit={{ opacity: 0, transition: { duration: 0.28 } }}
            transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
      </AnimatePresence>
      <Navbar
        storeName={storeName}
        cartCount={cart.reduce((total, item) => total + item.quantity, 0)}
        onOpenCart={() => setIsCartOpen(true)}
        currentView={currentView}
        onViewChange={setCurrentView}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main id="main-content" className={currentView === 'shop' ? 'shop-main' : 'admin-main py-6'}>
        {currentView === 'shop' ? (
          <>
            <StoreHero theme={theme} onExplore={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })} />
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
              <ProductGrid products={filteredProducts} onAddToCart={handleAddToCart} theme={theme} />
            )}
            <BrandFooter storeName={storeName} theme={theme} />
          </>
        ) : adminSession === undefined ? (
          <p className="py-12 text-center text-sm text-zinc-400">Verificando acesso...</p>
        ) : adminSession ? (
          <AdminPanel
            currentStoreName={storeName}
            onUpdateStoreName={handleStoreNameChange}
            theme={theme}
            themeId={themeId}
            onThemeChange={handleThemeChange}
            onAddProduct={handleAddProduct}
            dashboard={dashboard}
            onUpdateStock={handleUpdateStock}
            onRefundOrder={handleRefundOrder}
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

      <CustomerAccessModal
        isOpen={customerSession === null}
        onAuthenticated={setCustomerSession}
        storeName={storeName}
        theme={theme}
      />

      {isCheckoutOpen && (
        <CheckoutDialog
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          cartItems={cart}
        />
      )}
    </div>
    </MotionConfig>
  );
}
