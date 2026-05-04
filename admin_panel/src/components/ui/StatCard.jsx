import { TrendingDown, TrendingUp } from 'lucide-react';

import { formatCurrency } from './utils';

export const StatCard = ({ title, value, delta, currency = false, icon, onClick, active = false }) => {
  const hasDelta = typeof delta === 'number';
  const Component = onClick ? 'button' : 'article';
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`panel p-5 text-left ${onClick ? 'w-full cursor-pointer transition hover:border-brand-200 hover:shadow-md' : ''} ${active ? 'border-brand-300 ring-2 ring-brand-100' : ''}`}
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        {icon ? <span className="text-brand-600">{icon}</span> : null}
      </div>
      <p className="text-2xl font-bold text-slate-900">{currency ? formatCurrency(value) : value}</p>
      {hasDelta ? (
        <p className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${delta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
          {delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(delta)}%
        </p>
      ) : null}
    </Component>
  );
};
