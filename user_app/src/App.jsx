import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Camera,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleDot,
  Eye,
  EyeOff,
  Gamepad2,
  HardDrive,
  Heart,
  Home,
  ImageOff,
  Headphones,
  Keyboard,
  LayoutGrid,
  Laptop,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  MapPinned,
  Minus,
  Monitor,
  Mouse,
  PackageOpen,
  PanelTop,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCcw,
  Search,
  SearchX,
  Smartphone,
  ShoppingBasket,
  ShoppingCart,
  Speaker,
  Tablet,
  Trash2,
  Truck,
  Tv,
  UserPlus,
  UserRound,
  Wallet,
  Watch,
} from 'lucide-react';

import {
  authApi,
  cartApi,
  catalogApi,
  clearTokens,
  getAccessToken,
  getErrorMessage,
  getRefreshToken,
  ordersApi,
  resolveAssetUrl,
  saveTokens,
  wishlistApi,
} from './api';
import { appConfig } from './config';

const HAS_LOGGED_IN_KEY = 'techmart_user_has_logged_in';
const RECENT_SEARCHES_KEY = 'techmart_recent_searches';

const tabs = [
  { name: 'home', label: 'Home', icon: 'Home' },
  { name: 'categories', label: 'Categories', icon: 'LayoutGrid' },
  { name: 'search', label: 'Search', icon: 'Search' },
  { name: 'wishlist', label: 'Wishlist', icon: 'Heart' },
  { name: 'profile', label: 'Account', icon: 'UserRound' },
];

const timelineStatuses = ['PENDING', 'ACCEPTED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

const icons = {
  ArrowLeft,
  ArrowRight,
  Bell,
  Camera,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleDot,
  Eye,
  EyeOff,
  Gamepad2,
  HardDrive,
  Heart,
  Home,
  ImageOff,
  Headphones,
  Keyboard,
  LayoutGrid,
  Laptop,
  Loader2,
  LockKeyhole,
  Mail,
  MapPin,
  MapPinned,
  Minus,
  Monitor,
  Mouse,
  PackageOpen,
  PanelTop,
  Pencil,
  Plus,
  ReceiptText,
  RefreshCcw,
  Search,
  SearchX,
  Smartphone,
  ShoppingBasket,
  ShoppingCart,
  Speaker,
  Tablet,
  Trash2,
  Truck,
  Tv,
  UserPlus,
  UserRound,
  Wallet,
  Watch,
};

function Icon({ name, size = 20, className = '', ...props }) {
  const Component = icons[name] || Circle;
  return <Component size={size} className={className} aria-hidden="true" {...props} />;
}

function unwrapList(response) {
  const body = response?.data;
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.data)) return body.data;
  return [];
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeProduct(product) {
  const primaryImage =
    product?.images?.find((image) => image.is_primary)?.image_url || product?.images?.[0]?.image_url;
  return {
    ...product,
    id: toNumber(product.id),
    category_id: toNumber(product.category_id),
    price_value: toNumber(product.final_price ?? product.price),
    stock_qty: toNumber(product.stock_qty),
    image_url: resolveAssetUrl(product.image_url || primaryImage),
  };
}

function normalizeCart(cart) {
  if (!cart) return null;
  return {
    ...cart,
    subtotal: toNumber(cart.subtotal),
    items: (cart.items || []).map((item) => ({
      ...item,
      id: toNumber(item.id),
      product_id: toNumber(item.product_id),
      quantity: toNumber(item.quantity),
      unit_price: toNumber(item.unit_price),
      line_total: toNumber(item.line_total),
    })),
  };
}

function normalizeOrder(order) {
  return {
    ...order,
    subtotal: toNumber(order.subtotal),
    delivery_fee: toNumber(order.delivery_fee),
    total: toNumber(order.total),
    items: (order.items || []).map((item) => ({
      ...item,
      quantity: toNumber(item.quantity),
      unit_price: toNumber(item.unit_price),
      line_total: toNumber(item.line_total),
    })),
  };
}

function money(value) {
  return `Rs.${toNumber(value).toFixed(2)}`;
}

function firstName(user) {
  return user?.full_name?.split(' ')?.[0] || 'Welcome';
}

function hasCompleteAddress(user) {
  return Boolean(
    user?.address_line1?.trim() &&
      user?.city?.trim() &&
      user?.state?.trim() &&
      user?.postal_code?.trim() &&
      user?.country?.trim()
  );
}

function fullAddress(user) {
  if (!user) return '';
  return [
    user.address_line1,
    user.address_line2,
    user.landmark,
    [user.city, user.state].filter(Boolean).join(', '),
    user.postal_code,
    user.country,
  ]
    .filter((part) => part && String(part).trim())
    .join(', ');
}

function statusLabel(value) {
  return String(value || '').replaceAll('_', ' ');
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function readRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) || '[]');
  } catch {
    return [];
  }
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [stack, setStack] = useState([{ name: 'home' }]);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');
  const [catalog, setCatalog] = useState({
    loading: true,
    products: [],
    categories: [],
    banners: [],
    error: '',
  });
  const [cart, setCart] = useState(null);
  const [cartLoading, setCartLoading] = useState(false);
  const [wishlist, setWishlist] = useState([]);
  const [wishlistLoading, setWishlistLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [notice, setNotice] = useState(null);
  const noticeTimer = useRef(null);
  const pendingAfterLogin = useRef(null);

  const currentPage = stack[stack.length - 1];
  const isTabPage = tabs.some((tab) => tab.name === currentPage.name);

  useEffect(() => {
    document.title = appConfig.appName;
  }, []);

  const navigate = useCallback((page) => {
    setStack((items) => [...items, page]);
  }, []);

  const replace = useCallback((page) => {
    setStack((items) => [...items.slice(0, -1), page]);
  }, []);

  const goBack = useCallback(() => {
    setStack((items) => (items.length > 1 ? items.slice(0, -1) : items));
  }, []);

  const resetTo = useCallback((page) => {
    setStack([page]);
  }, []);

  const showToast = useCallback((message, action = null) => {
    window.clearTimeout(noticeTimer.current);
    setNotice({ message, action });
    noticeTimer.current = window.setTimeout(() => setNotice(null), 3200);
  }, []);

  const loadCatalog = useCallback(async () => {
    setCatalog((state) => ({ ...state, loading: true, error: '' }));
    try {
      const [categoriesResponse, bannersResponse, productsResponse] = await Promise.all([
        catalogApi.categories(),
        catalogApi.banners(),
        catalogApi.products(),
      ]);

      setCatalog({
        loading: false,
        categories: unwrapList(categoriesResponse).map((category) => ({
          ...category,
          image_url: resolveAssetUrl(category.image_url),
        })),
        banners: unwrapList(bannersResponse).map((banner) => ({
          ...banner,
          image_url: resolveAssetUrl(banner.image_url),
        })),
        products: unwrapList(productsResponse).map(normalizeProduct),
        error: '',
      });
    } catch (error) {
      setCatalog((state) => ({ ...state, loading: false, error: getErrorMessage(error) }));
    }
  }, []);

  const loadCart = useCallback(async () => {
    setCartLoading(true);
    try {
      const response = await cartApi.get();
      setCart(normalizeCart(response.data));
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setCartLoading(false);
    }
  }, [showToast]);

  const loadWishlist = useCallback(async () => {
    setWishlistLoading(true);
    try {
      const response = await wishlistApi.list();
      setWishlist(unwrapList(response).map(normalizeProduct));
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setWishlistLoading(false);
    }
  }, [showToast]);

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    try {
      const response = await ordersApi.list();
      setOrders(unwrapList(response).map(normalizeOrder));
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setOrdersLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let alive = true;

    async function bootstrap() {
      const hadSession = Boolean(getAccessToken() || getRefreshToken());
      try {
        if (hadSession) {
          const response = await authApi.me();
          if (alive) setUser(response.data);
        }
      } catch {
        clearTokens();
      } finally {
        if (alive) {
          setBooting(false);
        }
      }
    }

    bootstrap();
    loadCatalog();

    const onExpired = () => {
      setUser(null);
      setCart(null);
      setWishlist([]);
      showToast('Session expired. Please login again.');
      resetTo({ name: 'home' });
    };
    window.addEventListener('techmart-auth-expired', onExpired);

    return () => {
      alive = false;
      window.removeEventListener('techmart-auth-expired', onExpired);
      window.clearTimeout(noticeTimer.current);
    };
  }, [loadCatalog, resetTo, showToast]);

  useEffect(() => {
    if (!user) {
      setCart(null);
      setWishlist([]);
      setOrders([]);
      return;
    }
    loadCart();
    loadWishlist();
  }, [loadCart, loadWishlist, user]);

  const cartCount = useMemo(
    () => cart?.items?.reduce((sum, item) => sum + item.quantity, 0) || 0,
    [cart]
  );

  const wishlistIds = useMemo(() => new Set(wishlist.map((product) => product.id)), [wishlist]);

  const categoryCounts = useMemo(() => {
    const counts = new Map();
    catalog.products.forEach((product) => {
      counts.set(product.category_id, (counts.get(product.category_id) || 0) + 1);
    });
    return counts;
  }, [catalog.products]);

  const runPendingAction = useCallback(() => {
    const action = pendingAfterLogin.current;
    pendingAfterLogin.current = null;
    if (action) {
      window.setTimeout(action, 60);
    }
  }, []);

  const login = async ({ email, password }) => {
    setAuthLoading(true);
    setAuthError('');
    try {
      const tokenResponse = await authApi.login({ email, password });
      saveTokens(tokenResponse.data);
      localStorage.setItem(HAS_LOGGED_IN_KEY, 'true');

      const profileResponse = await authApi.me();
      setUser(profileResponse.data);
      setAuthLoading(false);
      showToast('Logged in successfully');
      goBack();
      runPendingAction();
      return true;
    } catch (error) {
      const message = getErrorMessage(error);
      setAuthError(message === 'Invalid credentials' ? 'Invalid email or password' : message);
      setAuthLoading(false);
      return false;
    }
  };

  const signup = async ({ fullName, email, phone, password }) => {
    setAuthLoading(true);
    setAuthError('');
    try {
      await authApi.register({
        full_name: fullName,
        email,
        phone: phone || null,
        password,
      });
      setAuthLoading(false);
      return login({ email, password });
    } catch (error) {
      setAuthError(getErrorMessage(error));
      setAuthLoading(false);
      return false;
    }
  };

  const forgotPassword = async ({ email, password, confirmPassword, requestOnly = false, resetCode }) => {
    setAuthLoading(true);
    setAuthError('');
    try {
      if (!email?.trim()) {
        throw new Error('Email is required');
      }
      if (requestOnly) {
        await authApi.forgotPassword({ email: email.trim() });
        setAuthLoading(false);
        showToast('Password reset code sent to your email.');
        return true;
      }
      if (!resetCode?.trim()) {
        throw new Error('Reset code is required');
      }
      if (!password || password.length < 8) {
        throw new Error('Password must be at least 8 characters');
      }
      if (password !== confirmPassword) {
        throw new Error('Passwords do not match');
      }

      await authApi.resetPassword({
        email: email.trim(),
        code: resetCode.trim(),
        new_password: password,
      });
      setAuthLoading(false);
      showToast('Password reset successful. Please login with your new password.');
      replace({ name: 'login', reason: 'Use your new password to sign in' });
      return true;
    } catch (error) {
      setAuthError(getErrorMessage(error));
      setAuthLoading(false);
      return false;
    }
  };

  const logout = async () => {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await authApi.logout(refreshToken);
    } catch {
      // Local sign-out should still complete if the network is unavailable.
    }
    clearTokens();
    setUser(null);
    setCart(null);
    setWishlist([]);
    resetTo({ name: 'home' });
    showToast('Signed out');
  };

  const openLogin = useCallback(
    (reason, afterLogin = null) => {
      pendingAfterLogin.current = afterLogin;
      navigate({ name: 'login', reason });
    },
    [navigate]
  );

  const addToCartAuthed = useCallback(
    async (product) => {
      if (product.stock_qty <= 0) {
        showToast('This product is out of stock.');
        return;
      }
      setCartLoading(true);
      try {
        const response = await cartApi.add(product.id);
        setCart(normalizeCart(response.data));
        showToast(`${product.name} added to cart`, {
          label: 'Go to Cart',
          onClick: () => navigate({ name: 'cart' }),
        });
      } catch (error) {
        showToast(getErrorMessage(error));
      } finally {
        setCartLoading(false);
      }
    },
    [navigate, showToast]
  );

  const addToCart = useCallback(
    (product) => {
      if (!user) {
        openLogin('Please login to add items to cart', () => addToCartAuthed(product));
        return;
      }
      addToCartAuthed(product);
    },
    [addToCartAuthed, openLogin, user]
  );

  const toggleWishlistAuthed = useCallback(
    async (product) => {
      const exists = wishlistIds.has(product.id);
      try {
        if (exists) {
          await wishlistApi.remove(product.id);
          setWishlist((items) => items.filter((item) => item.id !== product.id));
          showToast('Removed from wishlist');
          return;
        }

        await wishlistApi.add(product.id);
        setWishlist((items) =>
          items.some((item) => item.id === product.id) ? items : [product, ...items]
        );
        showToast('Added to wishlist');
      } catch (error) {
        showToast(getErrorMessage(error));
      }
    },
    [showToast, wishlistIds]
  );

  const toggleWishlist = useCallback(
    (product) => {
      if (!user) {
        openLogin('Please login to manage wishlist', () => toggleWishlistAuthed(product));
        return;
      }
      toggleWishlistAuthed(product);
    },
    [openLogin, toggleWishlistAuthed, user]
  );

  const updateCartItem = async (item, quantity) => {
    setCartLoading(true);
    try {
      const response =
        quantity <= 0 ? await cartApi.remove(item.id) : await cartApi.update(item.id, quantity);
      setCart(normalizeCart(response.data));
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setCartLoading(false);
    }
  };

  const placeOrder = async () => {
    if (!user) {
      openLogin('Please login to checkout', () => navigate({ name: 'checkout' }));
      return;
    }
    if (!hasCompleteAddress(user)) {
      showToast('Please complete your delivery address first.');
      navigate({ name: 'profileEdit' });
      return;
    }

    setOrdersLoading(true);
    try {
      await ordersApi.place(fullAddress(user));
      await Promise.all([loadCart(), loadOrders()]);
      showToast('Order placed successfully');
      replace({ name: 'orders' });
    } catch (error) {
      showToast(getErrorMessage(error));
    } finally {
      setOrdersLoading(false);
    }
  };

  const updateProfile = async (payload) => {
    setAuthLoading(true);
    try {
      const response = await authApi.updateProfile(payload);
      setUser(response.data);
      showToast('Profile updated');
      goBack();
      return true;
    } catch (error) {
      showToast(getErrorMessage(error));
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  const openProtectedTab = (tabName) => {
    if ((tabName === 'wishlist' || tabName === 'profile') && !user) {
      openLogin('Please login to access this section', () => resetTo({ name: tabName }));
      return;
    }
    resetTo({ name: tabName });
  };

  const shared = {
    addToCart,
    authError,
    authLoading,
    cart,
    cartCount,
    cartLoading,
    catalog,
    categoryCounts,
    goBack,
    loadCatalog,
    loadOrders,
    loadWishlist,
    login,
    logout,
    navigate,
    openLogin,
    orders,
    ordersLoading,
    placeOrder,
    replace,
    resetTo,
    signup,
    forgotPassword,
    toggleWishlist,
    updateCartItem,
    updateProfile,
    user,
    wishlist,
    wishlistIds,
    wishlistLoading,
  };

  if (booting) return <SplashScreen />;

  return (
    <div className="app-viewport">
      <div className="app-shell">
        <SiteHeader
          active={isTabPage ? currentPage.name : ''}
          catalog={catalog}
          count={cartCount}
          navigate={navigate}
          onSelect={openProtectedTab}
          openLogin={openLogin}
          user={user}
        />
        <main className="screen">
          <RenderPage page={currentPage} shared={shared} />
        </main>
        {notice && <TopNotice notice={notice} onClose={() => setNotice(null)} />}
      </div>
    </div>
  );
}

function RenderPage({ page, shared }) {
  switch (page.name) {
    case 'home':
      return <HomePage {...shared} />;
    case 'categories':
      return <CategoriesPage {...shared} />;
    case 'search':
      return <SearchPage {...shared} />;
    case 'wishlist':
      return <WishlistPage {...shared} />;
    case 'profile':
      return <ProfilePage {...shared} />;
    case 'login':
      return <AuthPage mode="login" reason={page.reason} {...shared} />;
    case 'signup':
      return <AuthPage mode="signup" reason={page.reason} {...shared} />;
    case 'forgotPassword':
      return <AuthPage mode="forgotPassword" reason={page.reason} {...shared} />;
    case 'listing':
      return <ProductListingPage title={page.title} products={page.products} {...shared} />;
    case 'product':
      return <ProductDetailPage product={page.product} {...shared} />;
    case 'cart':
      return <CartPage {...shared} />;
    case 'checkout':
      return <CheckoutPage {...shared} />;
    case 'profileEdit':
      return <ProfileEditPage {...shared} />;
    case 'orders':
      return <OrdersPage {...shared} />;
    case 'orderDetail':
      return <OrderDetailPage order={page.order} {...shared} />;
    case 'info':
      return <InfoPage title={page.title} {...shared} />;
    default:
      return <HomePage {...shared} />;
  }
}

function SplashScreen() {
  return (
    <div className="app-viewport">
      <div className="app-shell center-screen">
        <div className="brand-mark">
          <Icon name="ShoppingBasket" size={38} />
        </div>
        <h1>{appConfig.appName}</h1>
        <Loader compact />
      </div>
    </div>
  );
}

function HomePage({
  addToCart,
  cartCount,
  catalog,
  categoryCounts,
  loadCatalog,
  navigate,
  openLogin,
  toggleWishlist,
  user,
  wishlistIds,
}) {
  const [query, setQuery] = useState('');
  const recommended = catalog.products.slice(0, 8);
  const featured = catalog.products.filter((product) => product.is_featured).slice(0, 8);
  const visibleFeatured = featured.length ? featured : catalog.products.slice(1, 9);
  const trending = catalog.products.slice(2, 10);
  const locationTitle = user?.city?.trim() || (user ? firstName(user) : 'Fresh Produce');
  const locationSubtitle = hasCompleteAddress(user)
    ? fullAddress(user)
    : user
      ? 'Complete your address from profile'
      : 'Login for faster checkout';

  const runSearch = async () => {
    const search = query.trim();
    if (!search) return;
    const results = catalog.products.filter((product) =>
      product.name.toLowerCase().includes(search.toLowerCase())
    );
    navigate({ name: 'listing', title: `Search: ${search}`, products: results });
  };

  if (catalog.loading && !catalog.products.length) return <Loader />;
  if (catalog.error && !catalog.products.length) {
    return <ErrorState message={catalog.error} onRetry={loadCatalog} />;
  }

  return (
    <div className="page-flow home-page">
      <header className="home-header">
        <div className="location-block">
          <Icon name="MapPin" className="text-brand" />
          <div>
            <strong>{locationTitle}</strong>
            <span>{locationSubtitle}</span>
          </div>
        </div>
        <button
          className="icon-button cart-button"
          onClick={() =>
            user
              ? navigate({ name: 'cart' })
              : openLogin('Please login to open cart', () => navigate({ name: 'cart' }))
          }
          aria-label="Cart"
        >
          <Icon name="ShoppingCart" />
          {cartCount > 0 && <b>{cartCount}</b>}
        </button>
      </header>

      <form
        className="search-box"
        onSubmit={(event) => {
          event.preventDefault();
          runSearch();
        }}
      >
        <Icon name="Search" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for items or products..."
        />
        <button type="submit" className="icon-button" aria-label="Search">
          <Icon name="ArrowRight" />
        </button>
      </form>

      <BannerStrip banners={catalog.banners} />

      <SectionHeader
        title="Shop by category"
        onOpen={() => navigate({ name: 'categories' })}
      />
      <div className="category-row">
        {catalog.categories.slice(0, 8).map((category) => (
          <CategoryMini
            key={category.id}
            category={category}
            count={categoryCounts.get(category.id) || 0}
            onClick={() =>
              navigate({
                name: 'listing',
                title: category.name,
                products: catalog.products.filter((product) => product.category_id === category.id),
              })
            }
          />
        ))}
      </div>

      <ProductSection
        title="Recommended"
        products={recommended}
        onOpen={() => navigate({ name: 'listing', title: 'Recommended', products: recommended })}
        addToCart={addToCart}
        navigate={navigate}
        toggleWishlist={toggleWishlist}
        wishlistIds={wishlistIds}
      />
      <ProductSection
        title="Featured"
        products={visibleFeatured}
        onOpen={() => navigate({ name: 'listing', title: 'Featured', products: visibleFeatured })}
        addToCart={addToCart}
        navigate={navigate}
        toggleWishlist={toggleWishlist}
        wishlistIds={wishlistIds}
      />
      <ProductSection
        title="Trending"
        products={trending}
        onOpen={() => navigate({ name: 'listing', title: 'Trending', products: trending })}
        addToCart={addToCart}
        navigate={navigate}
        toggleWishlist={toggleWishlist}
        wishlistIds={wishlistIds}
      />
    </div>
  );
}

function BannerStrip({ banners }) {
  if (!banners.length) {
    return (
      <section className="fallback-banner">
        <div>
          <strong>Free Delivery</strong>
          <span>on first 3 orders</span>
        </div>
        <Icon name="Truck" size={38} />
      </section>
    );
  }

  return (
    <div className="banner-strip">
      {banners.map((banner) => (
        <article className="banner-card" key={banner.id}>
          {banner.image_url ? <img src={banner.image_url} alt="" /> : <div className="image-fallback" />}
          <div>
            <strong>{banner.title}</strong>
            {banner.subtitle && <span>{banner.subtitle}</span>}
          </div>
        </article>
      ))}
    </div>
  );
}

function SectionHeader({ title, onOpen }) {
  return (
    <div className="section-header">
      <h2>{title}</h2>
      <button className="icon-button" onClick={onOpen} aria-label={title}>
        <Icon name="ChevronRight" />
      </button>
    </div>
  );
}

function ProductSection({ title, products, onOpen, addToCart, navigate, toggleWishlist, wishlistIds }) {
  return (
    <section className="product-section">
      <SectionHeader title={title} onOpen={onOpen} />
      {products.length ? (
        <div className="product-row">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              compact
              wishlisted={wishlistIds.has(product.id)}
              onAdd={() => addToCart(product)}
              onOpen={() => navigate({ name: 'product', product })}
              onWishlist={() => toggleWishlist(product)}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="No products yet" icon="PackageOpen" />
      )}
    </section>
  );
}

function CategoriesPage({ catalog, categoryCounts, loadCatalog, navigate }) {
  if (catalog.loading && !catalog.categories.length) return <Loader />;
  if (catalog.error && !catalog.categories.length) {
    return <ErrorState message={catalog.error} onRetry={loadCatalog} />;
  }

  return (
    <div className="page-flow">
      <PageTitle title="Categories" />
      <div className="category-grid">
        {catalog.categories.map((category) => (
          <CategoryCard
            key={category.id}
            category={category}
            count={categoryCounts.get(category.id) || 0}
            onClick={() =>
              navigate({
                name: 'listing',
                title: category.name,
                products: catalog.products.filter((product) => product.category_id === category.id),
              })
            }
          />
        ))}
      </div>
    </div>
  );
}

function SearchPage({ addToCart, catalog, navigate, toggleWishlist, wishlistIds }) {
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState(readRecentSearches);
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);
  const trending = catalog.products.slice(0, 8);

  const runSearch = (value = query) => {
    const search = value.trim();
    if (!search) return;
    const nextRecent = [search, ...recent.filter((item) => item !== search)].slice(0, 6);
    setRecent(nextRecent);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(nextRecent));
    setResults(
      catalog.products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase()))
    );
    setSearched(true);
  };

  const shown = searched ? results : trending;

  return (
    <div className="page-flow">
      <form
        className="search-box top-search"
        onSubmit={(event) => {
          event.preventDefault();
          runSearch();
        }}
      >
        <Icon name="Search" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search for items or products..."
        />
      </form>

      <div className="section-header">
        <h2>Recent searches</h2>
        <button
          className="text-button"
          onClick={() => {
            setRecent([]);
            localStorage.removeItem(RECENT_SEARCHES_KEY);
          }}
        >
          Clear
        </button>
      </div>
      <div className="chips">
        {recent.map((item) => (
          <button
            key={item}
            className="chip"
            onClick={() => {
              setQuery(item);
              runSearch(item);
            }}
          >
            {item}
          </button>
        ))}
      </div>

      <SectionHeader
        title={searched ? 'Search results' : 'Trending items'}
        onOpen={() =>
          navigate({
            name: 'listing',
            title: searched ? 'Search results' : 'Trending items',
            products: shown,
          })
        }
      />
      <div className="product-row roomy">
        {shown.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            wishlisted={wishlistIds.has(product.id)}
            onAdd={() => addToCart(product)}
            onOpen={() => navigate({ name: 'product', product })}
            onWishlist={() => toggleWishlist(product)}
          />
        ))}
      </div>
      {searched && !results.length && <EmptyState title="No products found" icon="SearchX" />}
    </div>
  );
}

function WishlistPage({
  addToCart,
  loadWishlist,
  navigate,
  toggleWishlist,
  wishlist,
  wishlistIds,
  wishlistLoading,
}) {
  useEffect(() => {
    loadWishlist();
  }, [loadWishlist]);

  if (wishlistLoading && !wishlist.length) return <Loader />;

  return (
    <div className="page-flow">
      <PageTitle title="Wishlist" />
      {wishlist.length ? (
        <div className="product-grid">
          {wishlist.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              wishlisted={wishlistIds.has(product.id)}
              onAdd={() => addToCart(product)}
              onOpen={() => navigate({ name: 'product', product })}
              onWishlist={() => toggleWishlist(product)}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="Your wishlist is empty" icon="Heart" />
      )}
    </div>
  );
}

function ProductListingPage({
  addToCart,
  goBack,
  navigate,
  products = [],
  title,
  toggleWishlist,
  wishlistIds,
}) {
  return (
    <div className="page-flow">
      <PageHeader title={title} onBack={goBack} />
      {products.length ? (
        <div className="product-grid">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              wishlisted={wishlistIds.has(product.id)}
              onAdd={() => addToCart(product)}
              onOpen={() => navigate({ name: 'product', product })}
              onWishlist={() => toggleWishlist(product)}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="No products found" icon="PackageOpen" />
      )}
    </div>
  );
}

function ProductDetailPage({ addToCart, goBack, product, toggleWishlist, wishlistIds }) {
  if (!product) return null;
  const inStock = product.stock_qty > 0;

  return (
    <div className="detail-screen">
      <PageHeader title={product.name} onBack={goBack} />
      <div className="product-hero">
        <ProductImage product={product} />
        <button className="floating-heart" onClick={() => toggleWishlist(product)} aria-label="Wishlist">
          <Icon name="Heart" className={wishlistIds.has(product.id) ? 'filled-heart' : ''} />
        </button>
      </div>
      <section className="detail-panel">
        <div className="detail-title-row">
          <h1>{product.name}</h1>
          <span className={inStock ? 'stock-pill' : 'stock-pill danger'}>
            {inStock ? 'In Stock' : 'Out of Stock'}
          </span>
        </div>
        <strong className="price-text">{money(product.price_value)}</strong>
        <p className="muted">Available quantity: {product.stock_qty}</p>
        <h2>Description</h2>
        <p>
          {product.description?.trim() ||
            'Premium products curated for your everyday tech and lifestyle needs.'}
        </p>
      </section>
      <div className="sticky-action">
        <button className="primary-button wide" disabled={!inStock} onClick={() => addToCart(product)}>
          {inStock ? 'Add to Cart' : 'Out of Stock'}
        </button>
      </div>
    </div>
  );
}

function CartPage({ cart, cartLoading, goBack, navigate, updateCartItem }) {
  const items = cart?.items || [];

  return (
    <div className="page-flow">
      <PageHeader title="My Cart" onBack={goBack} />
      {cartLoading && !cart ? (
        <Loader />
      ) : items.length ? (
        <>
          <div className="cart-list">
            {items.map((item) => (
              <article className="cart-item" key={item.id}>
                <div>
                  <h3>{item.product_name}</h3>
                  <p>{money(item.unit_price)} x {item.quantity}</p>
                  <strong>{money(item.line_total)}</strong>
                </div>
                <div className="quantity-tools">
                  <button
                    className="icon-button small"
                    onClick={() => updateCartItem(item, item.quantity - 1)}
                    aria-label="Decrease"
                  >
                    <Icon name="Minus" size={16} />
                  </button>
                  <span>{item.quantity}</span>
                  <button
                    className="icon-button small"
                    onClick={() => updateCartItem(item, item.quantity + 1)}
                    aria-label="Increase"
                  >
                    <Icon name="Plus" size={16} />
                  </button>
                  <button
                    className="icon-button small ghost-danger"
                    onClick={() => updateCartItem(item, 0)}
                    aria-label="Remove"
                  >
                    <Icon name="Trash2" size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
          <div className="checkout-bar">
            <strong>Subtotal: {money(cart.subtotal)}</strong>
            <button className="primary-button wide" onClick={() => navigate({ name: 'checkout' })}>
              Proceed to Checkout
            </button>
          </div>
        </>
      ) : (
        <EmptyState title="Your cart is empty" icon="ShoppingCart" />
      )}
    </div>
  );
}

function CheckoutPage({ cart, goBack, navigate, ordersLoading, placeOrder, user }) {
  const ready = hasCompleteAddress(user);

  return (
    <div className="page-flow checkout-page">
      <PageHeader title="Checkout" onBack={goBack} />
      <section className="plain-panel">
        <h2>Delivery Address</h2>
        <p>{ready ? fullAddress(user) : 'Address not set. Add your full address from profile.'}</p>
        <button className="inline-action" onClick={() => navigate({ name: 'profileEdit' })}>
          <Icon name="MapPinned" /> Edit Address
        </button>
      </section>
      <section className="plain-panel">
        <h2>Payment Method</h2>
        <PaymentTile title="Cash on Delivery" subtitle="Pay when your order arrives" active />
        <PaymentTile title="UPI" subtitle="Coming soon" disabled />
        <PaymentTile title="Card / Net Banking" subtitle="Coming soon" disabled />
      </section>
      <section className="plain-panel summary-panel">
        <SummaryRow label="Subtotal" value={cart?.subtotal || 0} />
        <SummaryRow label="Delivery Fee" value={0} />
        <SummaryRow label="Total" value={cart?.subtotal || 0} emphasize />
      </section>
      <button className="primary-button wide" disabled={!ready || ordersLoading} onClick={placeOrder}>
        {ordersLoading ? 'Placing Order...' : 'Place Order'}
      </button>
    </div>
  );
}

function PaymentTile({ title, subtitle, active = false, disabled = false }) {
  return (
    <div className={active ? 'payment-tile active' : disabled ? 'payment-tile disabled' : 'payment-tile'}>
      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <Icon name={active ? 'CircleDot' : 'Circle'} />
    </div>
  );
}

function ProfilePage({ logout, navigate, openLogin, user }) {
  if (!user) {
    return (
      <div className="page-flow">
        <PageTitle title="Account" />
        <EmptyState title="Not logged in" icon="UserRound" />
        <button className="primary-button wide" onClick={() => openLogin('Please login to continue')}>
          Login
        </button>
      </div>
    );
  }

  const quick = [
    { label: 'Wallet', icon: 'Wallet', page: { name: 'info', title: 'Wallet' } },
    { label: 'Alerts', icon: 'Bell', page: { name: 'info', title: 'Notifications' } },
    { label: 'Wishlist', icon: 'Heart', page: { name: 'wishlist' } },
  ];
  const sections = [
    ['Orders', ['Orders', 'Addresses', 'Subscriptions', 'Recently Ordered']],
    ['Support', ['WhatsApp Us', 'Change Language']],
    [
      'Legal',
      [
        'Shipping Policy',
        'Refund Policy',
        'Return Policy',
        'Cancellation Policy',
        'Privacy Policy',
        'Terms and Conditions',
      ],
    ],
    ['More', ['Offers', 'Rate Us', 'QR Code', 'Share App', 'Refer & Earn', 'About Us', 'Website', 'Sign out']],
  ];

  const openItem = (item) => {
    if (item === 'Orders') return navigate({ name: 'orders' });
    if (item === 'Addresses') return navigate({ name: 'profileEdit' });
    if (item === 'Sign out') return logout();
    return navigate({ name: 'info', title: item });
  };

  return (
    <div className="page-flow">
      <PageTitle title="Account" />
      <section className="profile-card">
        <div className="avatar">
          <Icon name="UserRound" />
        </div>
        <div>
          <h2>{user.full_name}</h2>
          <p>{user.email}</p>
          {user.phone && <p>{user.phone}</p>}
        </div>
        <button className="icon-button" onClick={() => navigate({ name: 'profileEdit' })} aria-label="Edit">
          <Icon name="Pencil" size={18} />
        </button>
      </section>
      <section className="plain-panel">
        <h2>Saved Address</h2>
        <p>{hasCompleteAddress(user) ? fullAddress(user) : 'Address not complete.'}</p>
      </section>
      <div className="quick-grid">
        {quick.map((item) => (
          <button className="quick-tile" key={item.label} onClick={() => navigate(item.page)}>
            <Icon name={item.icon} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      {sections.map(([title, items]) => (
        <section className="menu-section" key={title}>
          <h2>{title}</h2>
          {items.map((item) => (
            <button key={item} className="menu-row" onClick={() => openItem(item)}>
              <span>{item}</span>
              <Icon name="ChevronRight" />
            </button>
          ))}
        </section>
      ))}
      <p className="version-text">Developed by Ayush Patel<br />Version 17.0</p>
    </div>
  );
}

function ProfileEditPage({ authLoading, goBack, updateProfile, user }) {
  const [form, setForm] = useState({
    full_name: user?.full_name || '',
    phone: user?.phone || '',
    address_line1: user?.address_line1 || '',
    address_line2: user?.address_line2 || '',
    landmark: user?.landmark || '',
    city: user?.city || '',
    state: user?.state || '',
    postal_code: user?.postal_code || '',
    country: user?.country || 'India',
  });

  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="page-flow">
      <PageHeader title="Edit Profile" onBack={goBack} />
      <form
        className="form-stack"
        onSubmit={(event) => {
          event.preventDefault();
          updateProfile(form);
        }}
      >
        <TextField label="Full Name" value={form.full_name} onChange={(value) => change('full_name', value)} required />
        <TextField label="Phone Number" value={form.phone} onChange={(value) => change('phone', value)} />
        <h2>Delivery Address</h2>
        <TextField label="Address Line 1" value={form.address_line1} onChange={(value) => change('address_line1', value)} required />
        <TextField label="Address Line 2" value={form.address_line2} onChange={(value) => change('address_line2', value)} />
        <TextField label="Landmark" value={form.landmark} onChange={(value) => change('landmark', value)} />
        <TextField label="City" value={form.city} onChange={(value) => change('city', value)} required />
        <TextField label="State" value={form.state} onChange={(value) => change('state', value)} required />
        <TextField label="Postal Code" value={form.postal_code} onChange={(value) => change('postal_code', value)} required />
        <TextField label="Country" value={form.country} onChange={(value) => change('country', value)} required />
        <button className="primary-button wide" disabled={authLoading}>
          {authLoading ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </div>
  );
}

function OrdersPage({ goBack, loadOrders, navigate, orders, ordersLoading }) {
  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const openOrder = async (order) => {
    try {
      const response = await ordersApi.detail(order.id);
      navigate({ name: 'orderDetail', order: normalizeOrder(response.data) });
    } catch {
      navigate({ name: 'orderDetail', order });
    }
  };

  return (
    <div className="page-flow">
      <PageHeader title="My Orders" onBack={goBack} />
      {ordersLoading && !orders.length ? (
        <Loader />
      ) : orders.length ? (
        <div className="order-list">
          {orders.map((order) => (
            <button className="order-card" key={order.id} onClick={() => openOrder(order)}>
              <div>
                <strong>{order.order_number}</strong>
                <span>{statusLabel(order.status)} - {order.items?.length || 0} item(s)</span>
              </div>
              <div>
                <b>{money(order.total)}</b>
                <Icon name="ChevronRight" />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <EmptyState title="No orders yet" icon="ReceiptText" />
      )}
    </div>
  );
}

function OrderDetailPage({ goBack, order }) {
  const currentIndex = timelineStatuses.indexOf(order.status);
  const cancelled = order.status === 'CANCELLED' || order.status === 'REJECTED';

  return (
    <div className="page-flow">
      <PageHeader title={order.order_number} onBack={goBack} />
      <section className="plain-panel">
        <div className="status-row">
          <span className={cancelled ? 'status-chip danger' : 'status-chip'}>{statusLabel(order.status)}</span>
          <span className="status-chip blue">Payment {statusLabel(order.payment_status || 'PENDING')}</span>
        </div>
        <p className="muted">Placed on {formatDate(order.created_at)}</p>
        {order.tracking_id && <strong>Tracking ID: {order.tracking_id}</strong>}
      </section>
      <section className="plain-panel timeline-panel">
        <h2>Order Timeline</h2>
        {cancelled ? (
          <div className="cancelled-box">This order is no longer active.</div>
        ) : (
          timelineStatuses.map((item, index) => (
            <div className="timeline-row" key={item}>
              <span className={currentIndex >= index ? 'timeline-dot done' : 'timeline-dot'} />
              <b>{statusLabel(item)}</b>
            </div>
          ))
        )}
      </section>
      <section className="plain-panel">
        <h2>Items</h2>
        {order.items.map((item) => (
          <SummaryLine
            key={item.id}
            title={item.product_name_snapshot}
            subtitle={`Qty ${item.quantity} x ${money(item.unit_price)}`}
            value={money(item.line_total)}
          />
        ))}
      </section>
      <section className="plain-panel summary-panel">
        <h2>Delivery Address</h2>
        <p>{order.shipping_address}</p>
        <SummaryRow label="Subtotal" value={order.subtotal} />
        <SummaryRow label="Delivery Fee" value={order.delivery_fee} />
        <SummaryRow label="Total" value={order.total} emphasize />
      </section>
    </div>
  );
}

function PasswordField({ label, onChange, placeholder = 'Password', required = false, showPassword, togglePassword, value }) {
  return (
    <label className="field-label">
      {label}
      <div className="field with-button">
        <Icon name="LockKeyhole" />
        <input
          value={value}
          type={showPassword ? 'text' : 'password'}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          minLength={8}
          required={required}
        />
        <button
          type="button"
          className="icon-button"
          onClick={togglePassword}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
        >
          <Icon name={showPassword ? 'EyeOff' : 'Eye'} />
        </button>
      </div>
    </label>
  );
}

function AuthPage({ authError, authLoading, forgotPassword, goBack, login, mode, replace, reason, signup }) {
  const isSignup = mode === 'signup';
  const isForgotPassword = mode === 'forgotPassword';
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resetCodeSent, setResetCodeSent] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', phone: '', password: '', confirmPassword: '', resetCode: '' });
  const change = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <div className="auth-screen">
      <PageHeader title={isSignup ? 'Create Account' : isForgotPassword ? 'Forgot Password' : 'Login'} onBack={goBack} />
      <form
        className="auth-card"
        onSubmit={async (event) => {
          event.preventDefault();
          if (isSignup) {
            signup(form);
          } else if (isForgotPassword) {
            const success = await forgotPassword({ ...form, requestOnly: !resetCodeSent });
            if (success && !resetCodeSent) setResetCodeSent(true);
          } else {
            login(form);
          }
        }}
      >
        <div className="brand-mark">
          <Icon name={isSignup ? 'UserPlus' : isForgotPassword ? 'LockKeyhole' : 'ShoppingBasket'} size={34} />
        </div>
        <h1>{isSignup ? 'Create Account' : isForgotPassword ? 'Reset Password' : 'Welcome Back'}</h1>
        <p>
          {reason ||
            (isSignup
              ? 'Start shopping fresh produce'
              : isForgotPassword
                ? resetCodeSent
                  ? 'Enter the code from your email and choose a new password'
                  : 'Enter your email to receive a reset code'
                : 'Login to continue shopping')}
        </p>
        {isSignup && (
          <>
            <TextField label="Full Name" value={form.fullName} onChange={(value) => change('fullName', value)} required />
            <TextField label="Phone" value={form.phone} onChange={(value) => change('phone', value)} />
          </>
        )}
        <TextField label="Email" type="email" value={form.email} onChange={(value) => change('email', value)} required icon="Mail" />
        {isForgotPassword && resetCodeSent ? (
          <TextField label="Reset Code" value={form.resetCode} onChange={(value) => change('resetCode', value)} required icon="LockKeyhole" />
        ) : null}
        {!isForgotPassword || resetCodeSent ? (
          <PasswordField
            label={isForgotPassword ? 'New Password' : 'Password'}
            value={form.password}
            onChange={(value) => change('password', value)}
            required
            showPassword={showPassword}
            togglePassword={() => setShowPassword((value) => !value)}
          />
        ) : null}
        {isForgotPassword && resetCodeSent ? (
          <PasswordField
            label="Confirm Password"
            value={form.confirmPassword}
            onChange={(value) => change('confirmPassword', value)}
            required
            showPassword={showConfirmPassword}
            togglePassword={() => setShowConfirmPassword((value) => !value)}
          />
        ) : null}
        {authError && <div className="form-error">{authError}</div>}
        <button className="primary-button wide" disabled={authLoading}>
          {authLoading ? 'Please wait...' : isSignup ? 'Sign up' : isForgotPassword ? resetCodeSent ? 'Reset Password' : 'Send Reset Code' : 'Login'}
        </button>
        {!isSignup && !isForgotPassword ? (
          <button
            type="button"
            className="text-button centered"
            onClick={() => replace({ name: 'forgotPassword', reason: 'Reset your password to continue' })}
          >
            Forgot password?
          </button>
        ) : null}
        <button
          type="button"
          className="text-button centered"
          onClick={() =>
            replace({
              name: isForgotPassword ? 'login' : isSignup ? 'login' : 'signup',
              reason,
            })
          }
        >
          {isForgotPassword
            ? 'Back to login'
            : isSignup
              ? 'Already have an account? Login'
              : 'Create new account'}
        </button>
      </form>
    </div>
  );
}

function ProductCard({ compact = false, onAdd, onOpen, onWishlist, product, wishlisted }) {
  const inStock = product.stock_qty > 0;
  return (
    <article className={compact ? 'product-card compact' : 'product-card'}>
      <button className="image-button" onClick={onOpen}>
        <ProductImage product={product} />
      </button>
      <button className="heart-button" onClick={onWishlist} aria-label="Wishlist">
        <Icon name="Heart" className={wishlisted ? 'filled-heart' : ''} size={18} />
      </button>
      <button className="mini-add" disabled={!inStock} onClick={onAdd}>
        <Icon name="Plus" size={16} /> Add
      </button>
      <button className="product-copy" onClick={onOpen}>
        <strong>{product.name}</strong>
        <span>{money(product.price_value)}</span>
      </button>
    </article>
  );
}

function ProductImage({ product }) {
  const [failed, setFailed] = useState(false);
  return product.image_url && !failed ? (
    <img src={product.image_url} alt={product.name} onError={() => setFailed(true)} />
  ) : (
    <div className="image-fallback">
      <Icon name="ImageOff" />
    </div>
  );
}

function CategoryIcon({ category }) {
  const [failed, setFailed] = useState(false);

  if (category?.image_url && !failed) {
    return <img src={category.image_url} alt={category.name} onError={() => setFailed(true)} />;
  }

  const normalized = String(category?.icon_name || '').trim();
  const icon =
    {
      Smartphone: 'Smartphone',
      Laptop: 'Laptop',
      Tv: 'Tv',
      Watch: 'Watch',
      Headphones: 'Headphones',
      Camera: 'Camera',
      Gamepad2: 'Gamepad2',
      Tablet: 'Tablet',
      Monitor: 'Monitor',
      Speaker: 'Speaker',
      Keyboard: 'Keyboard',
      Mouse: 'Mouse',
      HardDrive: 'HardDrive',
      apple: 'Smartphone',
      eco: 'Laptop',
      local_florist: 'Camera',
      spa: 'Watch',
      nutrition: 'Smartphone',
      grain: 'HardDrive',
      bakery_dining: 'Headphones',
      local_grocery_store: 'Laptop',
      'healthicons:vegetables': 'Smartphone',
      'healthicons:vegetables-outline': 'Smartphone',
      'healthicons:fruits': 'Smartphone',
      'ph:bowl-food': 'Laptop',
      'mdi:cart-outline': 'Laptop',
      'mdi:basket-outline': 'Laptop',
      'material-symbols:shopping-basket-outline-rounded': 'Laptop',
      'mdi:leaf': 'Laptop',
      'tabler:leaf': 'Laptop',
      'tabler:plant-2': 'Laptop',
      'material-symbols:eco-outline-rounded': 'Laptop',
      'mdi:sprout-outline': 'Watch',
      'mdi:food-apple-outline': 'Smartphone',
      'mdi:fruit-cherries': 'Smartphone',
      'mdi:fruit-grapes-outline': 'Smartphone',
      'mdi:fruit-watermelon': 'Smartphone',
      'ph:orange-slice': 'Smartphone',
      'mdi:carrot': 'Smartphone',
      'fluent:food-carrot-20-regular': 'Smartphone',
      'mdi:corn': 'Smartphone',
      'material-symbols:nutrition-outline-rounded': 'Smartphone',
      'mdi:rice': 'HardDrive',
      'mdi:seed-outline': 'HardDrive',
      'mdi:baguette': 'Headphones',
      'game-icons:powder-bag': 'Laptop',
    }[normalized] || 'Laptop';

  return <Icon name={icon} size={28} />;
}

function CategoryMini({ category, count, onClick }) {
  return (
    <button className="category-mini" onClick={onClick}>
      <span>
        <CategoryIcon category={category} />
      </span>
      <strong>{category.name}</strong>
      <small>{count} Items</small>
    </button>
  );
}

function CategoryCard({ category, count, onClick }) {
  return (
    <button className="category-card" onClick={onClick}>
      <span>
        <CategoryIcon category={category} />
      </span>
      <strong>{category.name}</strong>
      <small>{count} Items</small>
    </button>
  );
}

function SiteHeader({ active, catalog, count, navigate, onSelect, openLogin, user }) {
  const [query, setQuery] = useState('');

  const runSearch = () => {
    const search = query.trim();
    if (!search) {
      onSelect('search');
      return;
    }

    const products = catalog.products.filter((product) =>
      product.name.toLowerCase().includes(search.toLowerCase())
    );
    navigate({ name: 'listing', title: `Search: ${search}`, products });
  };

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <button className="brand-link" onClick={() => onSelect('home')} aria-label={`${appConfig.appName} home`}>
          <span className="brand-badge">
            <Icon name="ShoppingBasket" size={24} />
          </span>
          <span>
            <strong>{appConfig.appName}</strong>
            <small>{appConfig.tagline}</small>
          </span>
        </button>

        <form
          className="site-search"
          onSubmit={(event) => {
            event.preventDefault();
            runSearch();
          }}
        >
          <Icon name="Search" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search fruits, vegetables, grains..."
          />
          <button type="submit" aria-label="Search">
            <Icon name="ArrowRight" />
          </button>
        </form>

        <nav className="site-nav" aria-label="Primary">
          {tabs.map((tab) => (
            <button
              key={tab.name}
              className={active === tab.name ? 'active' : ''}
              onClick={() => onSelect(tab.name)}
            >
              <Icon name={tab.icon} size={17} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        <div className="site-actions">
          <button
            className="icon-button cart-button"
            onClick={() =>
              user
                ? navigate({ name: 'cart' })
                : openLogin('Please login to open cart', () => navigate({ name: 'cart' }))
            }
            aria-label="Cart"
          >
            <Icon name="ShoppingCart" />
            {count > 0 && <b>{count}</b>}
          </button>
          <button
            className="account-button"
            onClick={() =>
              user
                ? onSelect('profile')
                : openLogin('Please login to continue', () => navigate({ name: 'profile' }))
            }
          >
            <Icon name="UserRound" size={18} />
            <span>{user ? firstName(user) : 'Login'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

function BottomNav({ active, count, onSelect }) {
  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <button
          key={tab.name}
          className={active === tab.name ? 'active' : ''}
          onClick={() => onSelect(tab.name)}
        >
          <span>
            <Icon name={tab.icon} />
            {tab.name === 'home' && count > 0 && <b>{count}</b>}
          </span>
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function PageHeader({ title, onBack }) {
  return (
    <header className="page-header">
      <button className="icon-button" onClick={onBack} aria-label="Back">
        <Icon name="ArrowLeft" />
      </button>
      <h1>{title}</h1>
      <span />
    </header>
  );
}

function PageTitle({ title }) {
  return <h1 className="page-title">{title}</h1>;
}

function TextField({ icon, label, onChange, required = false, type = 'text', value }) {
  return (
    <label className="field">
      {icon && <Icon name={icon} />}
      <input
        type={type}
        placeholder={label}
        value={value}
        required={required}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function SummaryRow({ emphasize = false, label, value }) {
  return (
    <div className={emphasize ? 'summary-row emphasize' : 'summary-row'}>
      <span>{label}</span>
      <strong>{money(value)}</strong>
    </div>
  );
}

function SummaryLine({ subtitle, title, value }) {
  return (
    <div className="summary-line">
      <div>
        <strong>{title}</strong>
        <span>{subtitle}</span>
      </div>
      <b>{value}</b>
    </div>
  );
}

function Loader({ compact = false }) {
  return (
    <div className={compact ? 'loader compact-loader' : 'loader'}>
      <Icon name="Loader2" className="spin" />
      <span>Loading...</span>
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="empty-state">
      <Icon name="CircleAlert" size={36} />
      <h2>{message}</h2>
      <button className="secondary-button" onClick={onRetry}>
        <Icon name="RefreshCcw" /> Retry
      </button>
    </div>
  );
}

function EmptyState({ icon, title }) {
  return (
    <div className="empty-state">
      <Icon name={icon} size={38} />
      <h2>{title}</h2>
    </div>
  );
}

function TopNotice({ notice, onClose }) {
  return (
    <div className="top-notice">
      <span>{notice.message}</span>
      {notice.action && (
        <button
          onClick={() => {
            onClose();
            notice.action.onClick();
          }}
        >
          {notice.action.label}
        </button>
      )}
    </div>
  );
}

function InfoPage({ goBack, title }) {
  return (
    <div className="page-flow">
      <PageHeader title={title} onBack={goBack} />
      <EmptyState title={`${title} page`} icon="PanelTop" />
    </div>
  );
}
