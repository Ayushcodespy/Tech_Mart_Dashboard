export const formatCurrency = (value) => {
  const numeric = Number(value || 0);
  return `Rs.${numeric.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
};

export const formatDateTime = (value) => {
  if (!value) return '-';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const classNames = (...classes) => classes.filter(Boolean).join(' ');
