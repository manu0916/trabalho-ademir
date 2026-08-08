import { useEffect, useMemo, useState } from 'react';
import Navbar from './components/Navbar';
import ProductGrid from './components/ProductGrid';
import CartDrawer from './components/CartDrawer';
import CheckoutDialog from './components/CheckoutDialog';
import CustomerAccessModal from './components/CustomerAccessModal';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
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
  const [storeName, setStoreName] = useState('NEXUS HARDWARE');
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
      if (error.status === 401 || error.status === 403) setAdminSession(null);
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
      if (error.status === 401 || error.status === 403) setAdminSession(null);
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
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)', color: 'var(--text-main)', fontFamily: "'Outfit', sans-serif" }}>
      <Navbar
        storeName={storeName}
        cartCount={cart.reduce((total, item) => total + item.quantity, 0)}
        onOpenCart={() => setIsCartOpen(true)}
        currentView={currentView}
        onViewChange={setCurrentView}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <main className="py-6">
        {currentView === 'shop' ? (
          isLoadingProducts ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <div
                className="h-10 w-10 rounded-full border-2 border-t-transparent animate-spin"
                style={{ borderColor: 'rgba(99,102,241,0.4)', borderTopColor: '#6366f1' }}
              />
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Carregando produtos...</p>
            </div>
          ) : productsError ? (
            <div className="flex flex-col items-center justify-center py-32 gap-3">
              <p className="text-sm" role="alert" style={{ color: '#f87171' }}>{productsError}</p>
            </div>
          ) : (
            <ProductGrid products={filteredProducts} onAddToCart={handleAddToCart} />
          )
        ) : adminSession === undefined ? (
          <div className="flex items-center justify-center py-32">
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Verificando acesso...</p>
          </div>
        ) : adminSession ? (
          <AdminPanel
            currentStoreName={storeName}
            onUpdateStoreName={setStoreName}
            onAddProduct={handleAddProduct}
            dashboard={dashboard}
            onUpdateStock={handleUpdateStock}
            onLogout={handleLogout}
          />
        ) : (
          <AdminLogin onAuthenticated={handleAdminLogin} />
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
