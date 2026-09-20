import Link from 'next/link';
import {
  NOT_911_NOTICE, pointLabel, responsePromise, SAFETY_POINT_LABEL,
  type EmergencyDefinition, type SafetyPoint, type SafetyPointKind,
} from '@/lib/emergency';
import { emergencyContact, bmEmergencyPhone, telHref } from '@/lib/emergency-contacts';
import type { Asset } from '@/lib/types/database';

/**
 * What to do, for this house.
 *
 * The shape of this screen is the safety design:
 *
 *  - An EVACUATE case opens with a red full-width instruction and a 911
 *    button, ABOVE the steps. Nothing about shutoffs appears until after it.
 *  - A step that needs a shutoff shows the member's own — location, how to
 *    work it, and the photograph a technician took. If we never recorded
 *    theirs, the step says exactly that. It never guesses and it never
 *    shows somebody else's valve.
 *  - "Do not" comes before the call-us button, because the mistakes are
 *    made in the first two minutes.
 */
export default function EmergencyGuide({
  def,
  points,
  assets,
  hrefPrefix = '/home',
  hasPriority,
  demo = false,
}: {
  def: EmergencyDefinition;
  points: SafetyPoint[];
  assets: Pick<Asset, 'id' | 'name' | 'manufacturer' | 'model' | 'serial_number' | 'location_notes'>[];
  hrefPrefix?: string;
  hasPriority: boolean;
  demo?: boolean;
}) {
  const byKind = new Map<SafetyPointKind, SafetyPoint>();
  for (const p of points) if (!byKind.has(p.kind)) byKind.set(p.kind, p);

  const bm = bmEmergencyPhone();
  const evacuating = def.severity === 'EVACUATE';

  // A short list or none. Somebody with a burst pipe does not need to scroll
  // past every bathroom faucet they own — the categories cast a wide net on
  // purpose, and the screen narrows it back down.
  const SHOWN = 4;
  const shownAssets = assets.slice(0, SHOWN);
  const moreAssets = assets.length - shownAssets.length;

  return (
    <>
      <Link
        href={`${hrefPrefix}/help`}
        className="mb-4 inline-block text-[13px] font-semibold text-brandgreen-600"
      >
        ← Something else
      </Link>

      {/* ---------------------------------------------- life before property */}
      {evacuating && def.evacuate ? (
        <div className="mb-5 overflow-hidden rounded-2xl bg-red-700 text-white shadow-sm">
          <div className="p-5">
            <p className="text-[11px] font-bold uppercase tracking-widest text-red-200">
              Do this first
            </p>
            <p className="mt-1.5 text-[19px] font-semibold leading-snug">{def.evacuate}</p>
          </div>
          <a
            href="tel:911"
            className="flex h-14 w-full items-center justify-center bg-white text-[17px] font-bold text-red-700 active:bg-red-50"
          >
            Call 911
          </a>
        </div>
      ) : (
        <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 ring-1 ring-red-600/20">
          <p className="text-[13px] leading-relaxed text-red-900">{NOT_911_NOTICE}</p>
        </div>
      )}

      <h2 className="mb-1 text-[22px] font-semibold leading-tight tracking-tight text-navy-800">
        {def.label}
      </h2>
      <p className="mb-5 text-[13px] text-slate-500">{def.examples}</p>

      {/* ---------------------------------------------- the steps */}
      <ol className="space-y-3">
        {def.steps.map((step, i) => {
          const point = step.needs ? byKind.get(step.needs) ?? null : null;
          const call = step.contact ? emergencyContact(step.contact) : null;

          return (
            <li key={i} className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
              <div className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy-700 text-[13px] font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[16px] font-semibold leading-snug text-navy-800">
                    {step.title}
                  </p>
                  {step.detail ? (
                    <p className="mt-1 text-[14px] leading-relaxed text-slate-600">{step.detail}</p>
                  ) : null}

                  {call ? (
                    <a
                      href={telHref(call.phone)}
                      className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-navy-700 text-[15px] font-bold text-white active:scale-[0.99]"
                    >
                      Call {call.name} — {call.phone}
                    </a>
                  ) : null}

                  {step.needs ? (
                    point ? (
                      <YourPoint point={point} />
                    ) : (
                      <NotRecorded kind={step.needs} />
                    )
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* ---------------------------------------------- do not */}
      {def.doNot && def.doNot.length > 0 ? (
        <div className="mt-5 rounded-2xl bg-red-50 p-4 ring-1 ring-red-600/20">
          <p className="text-[11px] font-bold uppercase tracking-widest text-red-800">
            Please do not
          </p>
          <ul className="mt-2 space-y-1.5">
            {def.doNot.map((d) => (
              <li key={d} className="flex gap-2 text-[14px] leading-relaxed text-red-900">
                <span aria-hidden="true">·</span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ---------------------------------------------- their equipment */}
      {assets.length > 0 ? (
        <div className="mt-5 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Yours, from your Home Record
          </p>
          <ul className="mt-2.5 space-y-2.5">
            {shownAssets.map((a) => (
              <li key={a.id} className="text-[14px]">
                <p className="font-semibold text-navy-800">{a.name}</p>
                <p className="text-[13px] leading-snug text-slate-600">
                  {[a.manufacturer, a.model].filter(Boolean).join(' ')}
                  {a.serial_number ? ` · Serial ${a.serial_number}` : ''}
                </p>
                {a.location_notes ? (
                  <p className="text-[13px] text-slate-500">{a.location_notes}</p>
                ) : null}
              </li>
            ))}
          </ul>
          {moreAssets > 0 ? (
            <Link
              href={`${hrefPrefix}/record`}
              className="mt-3 inline-block text-[13px] font-semibold text-brandgreen-600"
            >
              {moreAssets} more in your Home Record
            </Link>
          ) : null}
        </div>
      ) : null}

      {/* ---------------------------------------------- tell us */}
      <div className="mt-5 rounded-2xl bg-navy-700 p-4 text-white">
        <p className="text-[14px] leading-relaxed text-navy-100">
          {responsePromise(hasPriority)}
        </p>
        {bm ? (
          <a
            href={telHref(bm)}
            className="mt-3 flex h-14 w-full items-center justify-center rounded-xl bg-white text-[16px] font-bold text-navy-800 active:scale-[0.99]"
          >
            Call B&amp;M — {bm}
          </a>
        ) : null}
        <Link
          href={
            demo
              ? `${hrefPrefix}/requests/new`
              : `${hrefPrefix}/requests/new?urgent=1&kind=${def.kind.toLowerCase()}`
          }
          className={`mt-2 flex h-14 w-full items-center justify-center rounded-xl text-[16px] font-bold active:scale-[0.99] ${
            bm ? 'bg-white/10 text-white ring-1 ring-white/25' : 'bg-white text-navy-800'
          }`}
        >
          Log it with photos
        </Link>
      </div>
    </>
  );
}

/** Their own shutoff: where it is, how it works, what it looks like. */
function YourPoint({ point }: { point: SafetyPoint }) {
  return (
    <div className="mt-3 overflow-hidden rounded-xl bg-brandgreen-50 ring-1 ring-brandgreen-600/25">
      <div className="p-3.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-brandgreen-700">
          Yours is here
        </p>
        <p className="mt-1 text-[15px] font-semibold leading-snug text-navy-800">
          {pointLabel(point)}
          {point.room_name ? ` · ${point.room_name}` : ''}
        </p>
        {point.location_note ? (
          <p className="mt-1 text-[14px] leading-relaxed text-slate-700">{point.location_note}</p>
        ) : null}
        {point.how_to_note ? (
          <p className="mt-2 rounded-lg bg-white px-3 py-2 text-[13px] leading-relaxed text-slate-700">
            {point.how_to_note}
          </p>
        ) : null}
      </div>
      {point.photo_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={point.photo_url}
          alt={`${pointLabel(point)} in your home`}
          className="block max-h-72 w-full object-cover"
        />
      ) : null}
    </div>
  );
}

/**
 * We have not recorded theirs.
 *
 * Said plainly. The alternative — showing nothing — reads as though the
 * step simply does not apply to them, which in an emergency is worse than
 * an honest gap.
 */
function NotRecorded({ kind }: { kind: SafetyPointKind }) {
  return (
    <div className="mt-3 rounded-xl bg-amber-50 p-3.5 ring-1 ring-amber-600/20">
      <p className="text-[14px] font-semibold text-amber-900">
        We have not recorded your {SAFETY_POINT_LABEL[kind].toLowerCase()} yet.
      </p>
      <p className="mt-1 text-[13px] leading-relaxed text-amber-900/80">
        Ask us to photograph it on the next visit and it will be right here
        next time. For now, call us and we will talk you through finding it.
      </p>
    </div>
  );
}
