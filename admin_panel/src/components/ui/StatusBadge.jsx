import { classNames } from './utils';

const toneMap = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  neutral: 'bg-slate-50 text-slate-700 border-slate-200',
};

export const StatusBadge = ({ label, tone = 'neutral' }) => {
  return (
    <span
      className={classNames(
        'inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold uppercase',
        toneMap[tone] || toneMap.neutral
      )}
    >
      {label}
    </span>
  );
};
