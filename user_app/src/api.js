import axios from 'axios';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';
const API_ORIGIN = new URL(API_BASE_URL).origin;

export const ACCESS_TOKEN_KEY = 'techmart_user_access_token';
export const REFRESH_TOKEN_KEY = 'techmart_user_refresh_token';

export const getAccessToken = () => localStorage.getItem(ACCESS_TOKEN_KEY);
export const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);

export const saveTokens = ({ access_token, refresh_token }) => {
  if (access_token) localStorage.setItem(ACCESS_TOKEN_KEY, access_token);
  if (refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
};

export const clearTokens = () => {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error?.config;
    const status = error?.response?.status;
    const refreshToken = getRefreshToken();

    if (status === 401 && original && !original._retry && refreshToken) {
      original._retry = true;
      try {
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refresh_token: refreshToken,
        });
        saveTokens(response.data);
        original.headers.Authorization = `Bearer ${response.data.access_token}`;
        return api(original);
      } catch (refreshError) {
        clearTokens();
        window.dispatchEvent(new Event('techmart-auth-expired'));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export const getErrorMessage = (error) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  const nested = error?.response?.data?.error?.message;
  if (typeof nested === 'string') return nested;
  if (typeof error?.message === 'string') return error.message;
  return 'Something went wrong. Please try again.';
};

export const resolveAssetUrl = (value) => {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/')) return `${API_ORIGIN}${value}`;
  return `${API_ORIGIN}/${value}`;
};

const pageParams = (page = 1, pageSize = 20, extra = {}) => ({
  page,
  page_size: pageSize,
  ...extra,
});

export const authApi = {
  register: (payload) => api.post('/auth/register', payload),
  login: (payload) => api.post('/auth/login', payload),
  forgotPassword: (payload) => api.post('/auth/forgot-password', payload),
  resetPassword: (payload) => api.post('/auth/reset-password', payload),
  me: () => api.get('/auth/me'),
  logout: (refreshToken) => api.post('/auth/logout', { refresh_token: refreshToken }),
  updateProfile: (payload) => api.patch('/users/me', payload),
};

export const catalogApi = {
  categories: ({ page = 1, pageSize = 100 } = {}) =>
    api.get('/categories', { params: pageParams(page, pageSize) }),
  banners: ({ page = 1, pageSize = 10, type = '' } = {}) =>
    api.get('/banners', {
      params: pageParams(page, pageSize, type ? { type } : {}),
    }),
  products: ({ page = 1, pageSize = 40, q = '', categoryId = null } = {}) =>
    api.get('/products', {
      params: pageParams(page, pageSize, {
        q: q || undefined,
        category_id: categoryId || undefined,
      }),
    }),
  product: (id) => api.get(`/products/${id}`),
};

export const cartApi = {
  get: () => api.get('/cart'),
  add: (productId, quantity = 1) =>
    api.post('/cart/items', { product_id: productId, quantity }),
  update: (itemId, quantity) => api.patch(`/cart/items/${itemId}`, { quantity }),
  remove: (itemId) => api.delete(`/cart/items/${itemId}`),
  clear: () => api.delete('/cart/clear'),
};

export const ordersApi = {
  place: (shippingAddress) =>
    api.post('/orders', shippingAddress ? { shipping_address: shippingAddress } : {}),
  list: ({ page = 1, pageSize = 20 } = {}) =>
    api.get('/orders', { params: pageParams(page, pageSize) }),
  detail: (id) => api.get(`/orders/${id}`),
  cancel: (id) => api.post(`/orders/${id}/cancel`),
};

export const wishlistApi = {
  list: ({ page = 1, pageSize = 50 } = {}) =>
    api.get('/wishlist', { params: pageParams(page, pageSize) }),
  add: (productId) => api.post(`/wishlist/${productId}`),
  remove: (productId) => api.delete(`/wishlist/${productId}`),
};
