'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { completeRequest, type RequestActionState } from '@/lib/actions/service-requests';
import { Field, inputClass, textareaClass } from '@/components/ui';
import { ASSET_CONDITIONS, conditionLabel } from '@/lib/types/finding-status';
import type { Asset } from '@/lib/types/database';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-14 w-full rounded-xl bg-brandgreen-600 text-base font-bold text-white disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Complete & update Home Record'}
    </button>
  );
}

/**
 * Closing out a job.
 *
 * This is the only path to COMPLETED. The action calls a database function
 * that writes the work to the linked item, moves the job photos onto it and
 * advances the stage in one transaction — so a job cannot be marked done
 * while the Home Record quietly goes stale.
 */
export default function CompletionForm({
  requestId,
  asset,
  photoCount = 0,
}: {
  requestId: string;
  asset: Pick<Asset, 'id' | 'name' | 'model' | 'serial_number'> | null;
  /** Job photos already on this request, so we can say if there are none. */
  photoCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState<RequestActionState, FormData>(completeRequest, {});

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="h-14 w-full rounded-xl bg-brandgreen-600 text-base font-bold text-white active:scale-[0.99]"
      >
        Close out the work
      </button>
    );
  }

  return (
    <form action={formAction} className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <input type="hidden" name="request_id" value={requestId} />

      <div>
        <h3 className="font-semibold text-navy-800">What was done</h3>
        <p className="mt-0.5 text-[13px] leading-relaxed text-slate-500">
          {asset
            ? `This goes straight onto ${asset.name} in their Home Record, so write it the way you'd want to read it in three years.`
            : 'No item is linked to this request, so this is recorded on the request only.'}
        </p>
      </div>

      <Field label="Work performed" htmlFor="work_performed">
        <textarea
          id="work_performed"
          name="work_performed"
          required
          rows={4}
          placeholder="Replaced the impeller and cleaned out the pit. Tested three cycles."
          className={textareaClass}
        />
      </Field>

      <Field label="Parts used" htmlFor="parts_used">
        <input
          id="parts_used"
          name="parts_used"
          placeholder="1x Zoeller impeller kit, 1x check valve"
          className={inputClass}
        />
      </Field>

      {asset ? (
        <>
          <Field
            label="Model"
            htmlFor="completion_model"
            hint={
              asset.model
                ? `Already recorded as ${asset.model} — this will not overwrite it.`
                : 'Blank on the record. Fill it in if you had eyes on the plate.'
            }
          >
            <input id="completion_model" name="completion_model" className={inputClass} />
          </Field>

          <Field
            label="Serial number"
            htmlFor="completion_serial"
            hint={
              asset.serial_number
                ? `Already recorded as ${asset.serial_number} — this will not overwrite it.`
                : 'Blank on the record. Fill it in if you had eyes on the plate.'
            }
          >
            <input
              id="completion_serial"
              name="completion_serial"
              autoCapitalize="characters"
              className={inputClass}
            />
          </Field>

          <Field label="Condition now" htmlFor="completion_condition">
            <select id="completion_condition" name="completion_condition" defaultValue="" className={inputClass}>
              <option value="">Leave as it was</option>
              {ASSET_CONDITIONS.map((c) => (
                <option key={c} value={c}>{conditionLabel(c)}</option>
              ))}
            </select>
          </Field>
        </>
      ) : null}

      {/* Not a blocker — a closed job with no photo is better than a job left
          open — but a written-up repair with nothing to look at is worth one
          line of friction. */}
      {photoCount === 0 ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-[13px] leading-relaxed text-amber-900 ring-1 ring-amber-600/20">
          No job photos yet. Scroll up and take a before/after if you can — it
          is what makes this repair mean something a year from now.
        </p>
      ) : (
        <p className="rounded-lg bg-brandgreen-50 px-3 py-2.5 text-[13px] text-brandgreen-800">
          {photoCount} job photo{photoCount === 1 ? '' : 's'}{' '}
          {asset
            ? `will move onto ${asset.name} in the Home Record with this write-up.`
            : 'will stay on this request — link an item above if they belong with a piece of equipment.'}
        </p>
      )}

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
          {state.error}
        </p>
      ) : null}

      <Submit />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="h-11 w-full rounded-lg font-medium text-slate-600"
      >
        Cancel
      </button>
    </form>
  );
}
