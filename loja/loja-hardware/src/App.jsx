import { useEffect, useMemo, useState } from 'react';
import Navbar from './components/Navbar';
import ProductGrid from './components/ProductGrid';
import CartDrawer from './components/CartDrawer';
import AdminPanel from './components/AdminPanel';
import AdminLogin from './components/AdminLogin';
import {
  fetchProducts,
  getAdminSession,
  loginAdmin,
  logoutAdmin,
  saveProduct,
} from './services/api';

export default function App() {
  const [storeName, setStoreName] = useState('NEXUS HARDWARE');
  const [currentView, setCurrentView] = useState('shop');
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [products, setProducts] = useState([]);
  const [adminSession, setAdminSession] = useState(undefined);
  const [productsError, setProductsError] = useState('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

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

    return () => {
      isActive = false;
    };
  }, []);

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
      alert('Produto salvo com sucesso no banco de dados.');
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

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100">
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
            <p className="py-12 text-center text-sm text-zinc-400">Carregando produtos...</p>
          ) : productsError ? (
            <p className="py-12 text-center text-sm text-red-400" role="alert">{productsError}</p>
          ) : (
            <ProductGrid products={filteredProducts} onAddToCart={handleAddToCart} />
          )
        ) : adminSession === undefined ? (
          <p className="py-12 text-center text-sm text-zinc-400">Verificando acesso...</p>
        ) : adminSession ? (
          <AdminPanel
            currentStoreName={storeName}
            onUpdateStoreName={setStoreName}
            onAddProduct={handleAddProduct}
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
      />
    </div>
  );
}
