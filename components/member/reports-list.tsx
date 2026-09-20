import Link from 'next/link';
import type { PortalReport } from '@/lib/member/portal';

function period(r: PortalReport): string {
  const fmt = (v: string | null) => {
    if (!v) return '';
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? ''
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const a = fmt(r.period_start);
  const b = fmt(r.period_end);
  return a && b ? `${a} – ${b}` : a || b;
}

export default function ReportsList({ reports }: { reports: PortalReport[] }) {
  if (reports.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center text-[15px] text-slate-500">
        Your first report will appear here after your next visit.
      </p>
    );
  }

  return (
    <>
      <p className="mb-4 text-[14px] leading-relaxed text-slate-600">
        A written record of every visit — what we checked, what we found, and
        what it means. Yours to keep, and useful when you sell.
      </p>

      <ul className="space-y-2.5">
        {reports.map((r) => {
          const year = new Date(r.generated_at).getFullYear();
          return (
            <li key={r.id}>
              <Link
                href={`/reports/${r.id}`}
                className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 active:bg-slate-50"
              >
                <div className="flex h-12 w-10 shrink-0 flex-col items-center justify-center rounded-lg bg-navy-700 text-white">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
                       className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 3v5h5" />
                    <path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug text-navy-800">{r.title}</p>
                  <p className="mt-0.5 text-[13px] text-slate-500">
                    {period(r) || year}
                    {r.report_type === 'ANNUAL_REVIEW' ? ' · Annual review' : ''}
                  </p>
                </div>
                <span className="shrink-0 text-[13px] font-semibold text-brandgreen-600">
                  Read
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="mt-4 rounded-xl bg-slate-100 px-4 py-3 text-[12px] leading-relaxed text-slate-600">
        Open a report and tap <span className="font-semibold">Save as PDF</span> to
        keep a copy on your phone or email it on.
      </p>
    </>
  );
}
