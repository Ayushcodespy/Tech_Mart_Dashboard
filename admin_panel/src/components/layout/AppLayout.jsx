import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../context/AuthContext';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

const titleMap = {
  '/': { title: 'TechMart Admin Dashboard', subtitle: 'Live business performance and activity' },
  '/categories': { title: 'Category Management', subtitle: 'Manage category names and icons for app navigation' },
  '/products': { title: 'Product Management', subtitle: 'Inventory, pricing and visibility controls' },
  '/orders': { title: 'Order Control Center', subtitle: 'Track, update and fulfill customer orders' },
  '/reports': { title: 'Reports', subtitle: 'View daily, monthly, and custom date business reports' },
  '/banners': { title: 'Banner Campaigns', subtitle: 'Homepage and offer banner management' },
  '/inventory': { title: 'Inventory Analytics', subtitle: 'Low stock alerts and stock movement logs' },
  '/users': { title: 'User & Roles', subtitle: 'Super admin controls for access management' },
};

export const AppLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const pageMeta = titleMap[location.pathname] || {
    title: 'Admin Panel',
    subtitle: 'Manage operations',
  };

  return (
    <div className="app-shell flex h-screen overflow-hidden bg-[var(--bg)]">
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onLogout={() => {
          logout();
          navigate('/login');
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          title={pageMeta.title}
          subtitle={pageMeta.subtitle}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
