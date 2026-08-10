import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar from './components/Navbar';
import ProductGrid from './components/ProductGrid';
import CartDrawer from './components/CartDrawer';
import CheckoutDialog from './components/CheckoutDialog';
import CustomerAccessModal from './components/CustomerAccessModal';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import StoreHero from './components/StoreHero';
import { STORE_THEMES } from './themes';
import {
  fetchProducts,
  getCustomerSession,
  getAdminSession,
  loginAdmin,
  logoutAdmin,
  saveProduct,
  fetchAdminDashboard,
  updateProductStock,
} from './services/api';

export default function App() {
  const [themeId, setThemeId] = useState(() => localStorage.getItem('store-theme') || 'hardware');
  const [storeName, setStoreName] = useState(() => localStorage.getItem('store-name') || STORE_THEMES.hardware.name);
  const [currentView, setCurrentView] = useState('shop');
  const [cart, setCart] = useState([]);
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
  useEffect(() => () => window.clearTimeout(themeTransitionTimer.current), []);

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
    getAdminSession().then(setAdminSession).catch(() => setAdminSession(null));
    getCustomerSession().then(setCustomerSession).catch(() => setCustomerSession(null));

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    if (!adminSession || currentView !== 'admin') return;
    fetchAdminDashboard().then(setDashboard).catch(() => setDashboard(null));
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
      if (error.status === 401) setAdminSession(null);
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
      if (error.status === 401) setAdminSession(null);
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

  const handleOrderCreated = () => {
    setCart([]);
  };

  return (
    <div className="app-shell min-h-screen" data-theme={theme.id}>
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

      <main className={currentView === 'shop' ? '' : 'py-6'}>
        {currentView === 'shop' ? (
          <>
            <StoreHero theme={theme} onExplore={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })} />
            {isLoadingProducts ? (
              <p className="py-12 text-center text-sm text-[var(--muted)]">Carregando produtos...</p>
            ) : productsError ? (
              <p className="py-12 text-center text-sm text-rose-500" role="alert">{productsError}</p>
            ) : (
              <ProductGrid products={filteredProducts} onAddToCart={handleAddToCart} theme={theme} />
            )}
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
          onOrderCreated={handleOrderCreated}
        />
      )}
    </div>
  );
}
