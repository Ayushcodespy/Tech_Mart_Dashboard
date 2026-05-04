export const Loader = ({ label = 'Loading...' }) => (
  <div className="flex h-40 items-center justify-center gap-3 text-slate-600">
    <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-r-transparent" />
    <span className="text-sm">{label}</span>
  </div>
);
