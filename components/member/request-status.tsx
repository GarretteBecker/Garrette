import { STAGE_META, STAGE_ORDER, TONE_STYLE, urgencyLabel } from '@/lib/service-requests';
import type { ServiceRequestStage, PriorityLevel } from '@/lib/types/database';

export interface StatusEvent {
  id: string;
  from_stage: ServiceRequestStage | null;
  to_stage: ServiceRequestStage;
  note: string | null;
  created_at: string;
}

function when(value: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function StageChip({
  stage,
  member = false,
}: {
  stage: ServiceRequestStage;
  member?: boolean;
}) {
  const meta = STAGE_META[stage];
  const tone = TONE_STYLE[meta.tone];
  return (
    <span className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${tone.chip}`}>
      {member ? meta.memberLabel : meta.label}
    </span>
  );
}

/** A slim progress rail so a member can see how far along things are. */
export function StageRail({ stage }: { stage: ServiceRequestStage }) {
  const total = STAGE_ORDER.length - 1;
  const at = STAGE_ORDER.indexOf(stage);
  const pct = Math.round((at / total) * 100);
  const meta = STAGE_META[stage];

  return (
    <div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
        role="img"
        aria-label={`Stage ${at + 1} of ${total + 1}: ${meta.memberLabel}`}
      >
        <div
          className={`h-full rounded-full transition-all ${TONE_STYLE[meta.tone].dot}`}
          style={{ width: `${Math.max(pct, 6)}%` }}
        />
      </div>
      <p className="mt-1.5 text-[11px] text-slate-500">
        Step {at + 1} of {total + 1}
      </p>
    </div>
  );
}

/** The member-facing history of a request. */
export default function RequestStatus({
  stage,
  priority,
  events,
  children,
}: {
  stage: ServiceRequestStage;
  priority: PriorityLevel;
  events: StatusEvent[];
  /**
   * Anything that needs to sit between the status card and the history —
   * the approval card, above all. The history runs long, and a button the
   * member has to scroll past twelve entries to find is a button that does
   * not get pressed.
   */
  children?: React.ReactNode;
}) {
  const meta = STAGE_META[stage];

  return (
    <>
      <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex items-center justify-between gap-3">
          <StageChip stage={stage} member />
          <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {urgencyLabel(priority)}
          </span>
        </div>
        <p className="text-[17px] font-semibold leading-snug text-navy-800">
          {meta.memberLabel}
        </p>
        <p className="mt-1 text-[14px] leading-relaxed text-slate-600">{meta.memberHint}</p>

        {meta.owner !== '—' ? (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-600">
            Currently with{' '}
            <span className="font-semibold text-navy-800">
              {meta.owner === 'You' ? 'you' : meta.owner}
            </span>
            .
          </p>
        ) : null}

        <div className="mt-4">
          <StageRail stage={stage} />
        </div>
      </div>

      {children}

      {events.length > 0 ? (
        <>
          <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
            History
          </h2>
          <ol className="relative space-y-4 border-l border-slate-200 pl-5">
            {[...events].reverse().map((e) => {
              const m = STAGE_META[e.to_stage];
              return (
                <li key={e.id} className="relative">
                  <span
                    className={`absolute -left-[26px] top-1 h-3 w-3 rounded-full ring-4 ring-slate-50 ${TONE_STYLE[m.tone].dot}`}
                    aria-hidden="true"
                  />
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="font-medium text-navy-800">{m.memberLabel}</p>
                    <span className="shrink-0 text-[11px] text-slate-400">{when(e.created_at)}</span>
                  </div>
                  {e.note ? (
                    <p className="mt-0.5 text-[13px] leading-relaxed text-slate-600">{e.note}</p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </>
      ) : null}
    </>
  );
}
