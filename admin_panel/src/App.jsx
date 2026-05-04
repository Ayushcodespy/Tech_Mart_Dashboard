import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AppLayout } from './components/layout/AppLayout';
import { appConfig } from './config';
import { useAuth } from './context/AuthContext';
import { ProtectedRoute } from './context/ProtectedRoute';
import { BannersPage } from './pages/BannersPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { LoginPage } from './pages/LoginPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { OrdersPage } from './pages/OrdersPage';
import { ProductsPage } from './pages/ProductsPage';
import { ReportsPage } from './pages/ReportsPage';
import { UsersPage } from './pages/UsersPage';

const App = () => {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    document.title = `${appConfig.appName} Admin`;
  }, []);

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<DashboardPage />} />
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/banners" element={<BannersPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/users" element={<UsersPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};

export default App;
