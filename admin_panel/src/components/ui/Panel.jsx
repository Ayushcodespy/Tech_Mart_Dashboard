export const Panel = ({ title, actions, children, className = '' }) => {
  return (
    <section className={`panel ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">{title}</h3>
          <div>{actions}</div>
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
};
