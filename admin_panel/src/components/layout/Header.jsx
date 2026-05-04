import { useEffect, useState } from 'react';
import { Menu, Package2, Search } from 'lucide-react';

import { ordersApi } from '../../api/endpoints';

export const Header = ({ title, subtitle, onToggleSidebar }) => {
  const [pendingOrders, setPendingOrders] = useState(0);

  useEffect(() => {
    let mounted = true;

    const loadPendingOrders = async () => {
      try {
        const { data } = await ordersApi.list({ page: 1, pageSize: 1, status: 'PENDING' });
        if (!mounted) return;
        setPendingOrders(data.meta?.total || 0);
      } catch {
        if (mounted) setPendingOrders(0);
      }
    };

    loadPendingOrders();
    const timer = window.setInterval(loadPendingOrders, 15000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div className="flex items-center gap-3 px-4 py-3 md:px-6">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 md:hidden"
        >
          <Menu size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-900 md:text-xl">{title}</h1>
          {subtitle ? <p className="text-xs text-slate-500 md:text-sm">{subtitle}</p> : null}
        </div>
        <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 md:flex">
          <Search size={16} className="text-slate-400" />
          <span className="text-xs text-slate-500">Admin workspace</span>
        </div>
        <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-2.5">
          <Package2 size={18} className="text-slate-700" />
          {pendingOrders > 0 ? (
            <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-brand-600 px-1.5 py-0.5 text-center text-[10px] font-bold text-white">
              {pendingOrders}
            </span>
          ) : null}
        </div>
      </div>
    </header>
  );
};
