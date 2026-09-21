'use client';

import { useFormStatus } from 'react-dom';
import { assignVisitTech } from '@/lib/actions/visits';

function Save() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
            className="h-10 shrink-0 rounded-lg bg-navy-700 px-3 text-[13px] font-semibold text-white disabled:opacity-60">
      {pending ? 'Saving…' : 'Assign'}
    </button>
  );
}

/**
 * Who is going.
 *
 * An unassigned visit never reaches anybody's field app, so this is called
 * out on the calendar rather than hidden behind the property page.
 */
export default function AssignTech({
  visitId, currentTechId, currentTechName, techs,
}: {
  visitId: string;
  currentTechId: string | null;
  currentTechName: string | null;
  techs: { id: string; name: string }[];
}) {
  return (
    <form action={assignVisitTech} className="mt-2.5 flex items-center gap-2">
      <input type="hidden" name="visit_id" value={visitId} />
      <select
        name="tech_id"
        defaultValue={currentTechId ?? ''}
        aria-label={`Technician for this visit${currentTechName ? `, currently ${currentTechName}` : ''}`}
        className={`h-10 min-w-0 flex-1 rounded-lg border px-2.5 text-[14px] ${
          currentTechId ? 'border-slate-300 bg-white text-navy-800' : 'border-amber-400 bg-amber-50 text-amber-900'
        }`}
      >
        <option value="">Nobody assigned</option>
        {techs.map((t) => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
      <Save />
    </form>
  );
}
