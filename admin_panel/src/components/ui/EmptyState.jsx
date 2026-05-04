export const EmptyState = ({ title, subtitle }) => {
  return (
    <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
      <h4 className="text-sm font-semibold text-slate-700">{title}</h4>
      {subtitle ? <p className="mt-1 text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  );
};
