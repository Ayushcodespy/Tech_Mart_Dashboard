export const NotFoundPage = () => {
  return (
    <div className="panel flex min-h-[300px] flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-sm uppercase tracking-widest text-slate-400">404</p>
      <h2 className="text-2xl font-bold text-slate-900">Page not found</h2>
      <p className="text-sm text-slate-500">The page you are looking for does not exist.</p>
    </div>
  );
};
