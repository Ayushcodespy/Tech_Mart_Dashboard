import { api, authHeadersForFormData } from './client';

export const authApi = {
  login: (payload) => api.post('/auth/login', payload),
  forgotPassword: (payload) => api.post('/auth/forgot-password', payload),
  resetPassword: (payload) => api.post('/auth/reset-password', payload),
  me: () => api.get('/auth/me'),
};

export const dashboardApi = {
  summary: () => api.get('/admin/dashboard/summary'),
};

export const reportsApi = {
  summary: (params) => api.get('/admin/reports', { params }),
};

export const productsApi = {
  list: ({ page = 1, pageSize = 20, q = '' }) =>
    api.get('/admin/products', { params: { page, page_size: pageSize, q: q || undefined } }),
  create: (payload) => api.post('/products', payload),
  update: (id, payload) => api.patch(`/products/${id}`, payload),
  remove: (id) => api.delete(`/products/${id}`),
  setStatus: (id, value) => {
    const fd = new FormData();
    fd.append('value', String(value));
    return api.patch(`/admin/products/${id}/status`, fd);
  },
  setFeatured: (id, value) => {
    const fd = new FormData();
    fd.append('value', String(value));
    return api.patch(`/admin/products/${id}/featured`, fd);
  },
  adjustStock: (id, payload) => api.patch(`/admin/products/${id}/stock`, payload),
  updatePrice: (id, { price, discountPercent }) => {
    const fd = new FormData();
    fd.append('price', String(price));
    fd.append('discount_percent', String(discountPercent));
    return api.patch(`/admin/products/${id}/price`, fd);
  },
  uploadMainImage: (id, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post(`/admin/products/${id}/images/main`, fd, {
      headers: authHeadersForFormData(),
    });
  },
};

export const categoriesApi = {
  list: ({ page = 1, pageSize = 100 }) =>
    api.get('/categories', { params: { page, page_size: pageSize } }),
  create: (payload) => api.post('/categories', payload, { headers: authHeadersForFormData() }),
  update: (id, payload) => api.patch(`/categories/${id}`, payload, { headers: authHeadersForFormData() }),
  remove: (id, params) => api.delete(`/categories/${id}`, { params }),
};

export const ordersApi = {
  list: ({ page = 1, pageSize = 20, status = '', q = '' }) =>
    api.get('/admin/orders', {
      params: { page, page_size: pageSize, status_filter: status || undefined, q: q || undefined },
    }),
  updateStatus: (id, status) => api.patch(`/admin/orders/${id}/status`, { status }),
  updateTracking: (id, trackingId) => api.patch(`/admin/orders/${id}/tracking`, { tracking_id: trackingId }),
  updatePayment: (id, paymentStatus) =>
    api.patch(`/admin/orders/${id}/payment-status`, { payment_status: paymentStatus }),
};

export const bannersApi = {
  list: ({ page = 1, pageSize = 20 }) => api.get('/admin/banners', { params: { page, page_size: pageSize } }),
  create: (formData) => api.post('/admin/banners', formData, { headers: authHeadersForFormData() }),
  update: (id, formData) => api.patch(`/admin/banners/${id}`, formData, { headers: authHeadersForFormData() }),
  remove: (id) => api.delete(`/admin/banners/${id}`),
};

export const inventoryApi = {
  lowStock: ({ page = 1, pageSize = 20 }) =>
    api.get('/admin/inventory/low-stock', { params: { page, page_size: pageSize } }),
  logs: ({ page = 1, pageSize = 20 }) =>
    api.get('/admin/inventory/logs', { params: { page, page_size: pageSize } }),
  adjust: (payload) => api.post('/admin/inventory/adjust', payload),
};

export const usersApi = {
  list: ({ page = 1, pageSize = 20 }) => api.get('/admin/users', { params: { page, page_size: pageSize } }),
  setRole: (id, role) => api.patch(`/admin/users/${id}/role`, { role }),
  remove: (id, params) => api.delete(`/admin/users/${id}`, { params }),
};
