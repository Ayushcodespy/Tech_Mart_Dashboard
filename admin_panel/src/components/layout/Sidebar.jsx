import { BarChart3, Boxes, FileText, Image, LayoutDashboard, LogOut, Package, Shapes, Users } from 'lucide-react';
import { NavLink } from 'react-router-dom';

import { appConfig } from '../../config';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/categories', label: 'Categories', icon: Shapes },
  { to: '/products', label: 'Products', icon: Package },
  { to: '/orders', label: 'Orders', icon: Boxes },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/banners', label: 'Banners', icon: Image },
  { to: '/inventory', label: 'Inventory', icon: BarChart3 },
  { to: '/users', label: 'Users', icon: Users },
];

export const Sidebar = ({ open, onClose, onLogout }) => {
  return (
    <>
      {open ? <button className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onClose} /> : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 h-screen w-72 shrink-0 border-r border-slate-200 bg-white shadow-xl transition-transform md:static md:translate-x-0 md:shadow-none ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-200 px-6 py-5">
            <p className="text-xs uppercase tracking-wider text-slate-400">{appConfig.appName}</p>
            <h2 className="text-lg font-bold text-slate-900">{appConfig.adminTitle}</h2>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                      isActive
                        ? 'bg-brand-50 text-brand-700'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`
                  }
                >
                  <Icon size={17} />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="border-t border-slate-200 p-4">
            <button
              type="button"
              onClick={onLogout}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
