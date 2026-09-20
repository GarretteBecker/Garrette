import Link from 'next/link';
import type { ReactNode } from 'react';
import type { FindingStatus, AssetCondition, ChecklistResult } from '@/lib/types/database';
import {
  FINDING_STATUS_STYLES,
  CHECKLIST_RESULT_STYLES,
  conditionLabel,
} from '@/lib/types/finding-status';

export function StatusPill({
  status,
  size = 'sm',
  solid = false,
}: {
  status: FindingStatus;
  size?: 'sm' | 'md';
  solid?: boolean;
}) {
  const style = FINDING_STATUS_STYLES[status];
  const sizing = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]';
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded font-bold uppercase tracking-wide ${sizing} ${
        solid ? style.solid : style.soft
      }`}
    >
      {style.label}
    </span>
  );
}

export function ChecklistResultPill({ result }: { result: ChecklistResult }) {
  const s = CHECKLIST_RESULT_STYLES[result];
  return (
    <span className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase ${s.chip}`}>
      {s.label}
    </span>
  );
}

export function ConditionPill({ condition }: { condition: AssetCondition }) {
  const map: Record<AssetCondition, string> = {
    NEW: 'bg-brandgreen-100 text-brandgreen-800',
    GOOD: 'bg-brandgreen-100 text-brandgreen-800',
    FAIR: 'bg-amber-100 text-amber-900',
    POOR: 'bg-red-100 text-red-900',
    END_OF_LIFE: 'bg-red-200 text-red-900',
    UNKNOWN: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase ${map[condition]}`}>
      {conditionLabel(condition)}
    </span>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-xl bg-white shadow-sm ring-1 ring-slate-200 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        {children}
      </h2>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function PrimaryButton({
  children,
  type = 'submit',
  disabled,
  className = '',
}: {
  children: ReactNode;
  type?: 'submit' | 'button';
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      className={`h-12 rounded-lg bg-brandgreen-600 px-4 text-base font-semibold text-white transition active:scale-[0.99] disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = 'primary',
  className = '',
}: {
  href: string;
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  className?: string;
}) {
  const styles =
    variant === 'primary'
      ? 'bg-brandgreen-600 text-white'
      : 'bg-white text-navy-700 ring-1 ring-slate-300';
  return (
    <Link
      href={href}
      className={`inline-flex h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold active:scale-[0.99] ${styles} ${className}`}
    >
      {children}
    </Link>
  );
}

/** Label + control wrapper used by every form in the app. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
  className = '',
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-navy-800">
        {label}
      </label>
      {children}
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export const inputClass =
  'h-12 w-full rounded-lg border border-slate-300 bg-white px-3 outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/20';

export const textareaClass =
  'min-h-24 w-full rounded-lg border border-slate-300 bg-white p-3 outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/20';

export function formatMoneyRange(low: number | null, high: number | null): string | null {
  if (low == null && high == null) return null;
  const fmt = (n: number) =>
    n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  if (low != null && high != null) return `${fmt(low)} – ${fmt(high)}`;
  return fmt((low ?? high)!);
}

export function formatDate(value: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
