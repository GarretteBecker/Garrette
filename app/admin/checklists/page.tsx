import Link from 'next/link';
import { requireRole } from '@/lib/auth';
import { AppHeader, BrandFooter } from '@/components/brand';
import ChecklistEditor from '@/components/admin/checklist-editor';
import { loadEditableTemplates } from '@/lib/checklists';
import { CHECKLIST_TEMPLATES, QUARTERS, quarterFor, type Quarter } from '@/lib/checklist-templates';

export const dynamic = 'force-dynamic';

export default async function ChecklistsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const profile = await requireRole('admin');
  const { q } = await searchParams;

  const active: Quarter = QUARTERS.includes(q as Quarter) ? (q as Quarter) : quarterFor();

  const stored = await loadEditableTemplates();
  const forQuarter = stored.find((s) => s.template.quarter === active) ?? null;

  const countFor = (quarter: Quarter) =>
    stored.find((s) => s.template.quarter === quarter)?.items.length ??
    CHECKLIST_TEMPLATES[quarter].items.length;

  const usingDraft = QUARTERS.filter((quarter) => !stored.some((s) => s.template.quarter === quarter));

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader
        profile={profile}
        title="Seasonal checklists"
        subtitle="What B&M checks, and when"
        backHref="/admin"
      />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-5">
        <p className="text-[14px] leading-relaxed text-slate-600">
          These are the lists your techs work through on a visit, and they are
          what the member&rsquo;s report is built from. Change them here — you do
          not need me for it.{' '}
          <span className="font-medium text-navy-800">
            A visit that has already been done keeps the list it was done with,
          </span>{' '}
          so editing a quarter never rewrites history.
        </p>

        {usingDraft.length > 0 ? (
          <div className="rounded-xl bg-amber-50 px-3.5 py-2.5 ring-1 ring-amber-600/25">
            <p className="text-[13px] font-semibold text-amber-900">
              Still on the built-in draft: {usingDraft.join(', ')}
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-amber-900/80">
              Those are a competent stranger&rsquo;s lists, not yours. They work,
              but they have never been through you.
            </p>
          </div>
        ) : null}

        <nav className="flex gap-1.5" aria-label="Quarter">
          {QUARTERS.map((quarter) => {
            const isActive = quarter === active;
            const isDraft = usingDraft.includes(quarter);
            return (
              <Link
                key={quarter}
                href={`/admin/checklists?q=${quarter}`}
                className={`flex-1 rounded-xl px-2 py-2.5 text-center ring-1 ${
                  isActive
                    ? 'bg-navy-700 text-white ring-navy-700'
                    : 'bg-white text-navy-800 ring-slate-200'
                }`}
              >
                <span className="block text-[15px] font-semibold">{quarter}</span>
                <span
                  className={`block text-[11px] ${isActive ? 'text-navy-200' : 'text-slate-500'}`}
                >
                  {countFor(quarter)} items{isDraft ? ' · draft' : ''}
                </span>
              </Link>
            );
          })}
        </nav>

        <ChecklistEditor
          quarter={active}
          template={forQuarter?.template ?? null}
          items={forQuarter?.items ?? []}
        />
      </main>
      <BrandFooter />
    </div>
  );
}
