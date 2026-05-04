import axios from 'axios';

let API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1';
// Remove trailing slash from base URL to avoid double slashes
API_BASE_URL = API_BASE_URL.replace(/\/$/, '');
const API_ORIGIN = new URL(API_BASE_URL).origin;

export const TOKEN_KEY = 'admin_access_token';

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      const isLogin = window.location.pathname === '/login';
      if (!isLogin) {
        window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      }
    }
    return Promise.reject(error);
  }
);

export const getErrorMessage = (error) => {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (typeof error?.message === 'string') return error.message;
  return 'Something went wrong';
};

export const authHeadersForFormData = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const resolveAssetUrl = (value) => {
  if (!value) return '';
  if (value.startsWith('http://') || value.startsWith('https://')) return value;
  if (value.startsWith('/')) return `${API_ORIGIN}${value}`;
  return `${API_ORIGIN}/${value}`;
};
