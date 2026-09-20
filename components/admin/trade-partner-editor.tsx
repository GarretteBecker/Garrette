'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveTradePartner, type ActionState } from '@/lib/actions/properties';
import { Card, Field, inputClass, textareaClass, EmptyState } from '@/components/ui';
import type { TradePartner } from '@/lib/types/database';

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 rounded-lg bg-brandgreen-600 px-5 font-semibold text-white disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Save partner'}
    </button>
  );
}

export default function TradePartnerEditor({ partners }: { partners: TradePartner[] }) {
  const [editing, setEditing] = useState<TradePartner | 'new' | null>(null);
  const [state, formAction] = useActionState<ActionState, FormData>(
    async (prev, fd) => {
      const result = await saveTradePartner(prev, fd);
      if (result.ok) setEditing(null);
      return result;
    },
    {},
  );

  if (editing) {
    const tp = editing === 'new' ? null : editing;
    return (
      <Card className="p-4">
        <h2 className="mb-3 font-semibold text-navy-800">
          {tp ? 'Edit trade partner' : 'Add a trade partner'}
        </h2>
        <form action={formAction} className="space-y-4">
          {tp ? <input type="hidden" name="id" value={tp.id} /> : null}

          <Field label="Company" htmlFor="company_name">
            <input
              id="company_name"
              name="company_name"
              required
              defaultValue={tp?.company_name ?? ''}
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Trade" htmlFor="trade">
              <input
                id="trade"
                name="trade"
                required
                defaultValue={tp?.trade ?? ''}
                className={inputClass}
                placeholder="Plumbing"
              />
            </Field>
            <Field label="Contact" htmlFor="contact_name">
              <input
                id="contact_name"
                name="contact_name"
                defaultValue={tp?.contact_name ?? ''}
                className={inputClass}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone" htmlFor="phone">
              <input
                id="phone"
                name="phone"
                type="tel"
                defaultValue={tp?.phone ?? ''}
                className={inputClass}
              />
            </Field>
            <Field label="Email" htmlFor="email">
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={tp?.email ?? ''}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="License #" htmlFor="license_number">
            <input
              id="license_number"
              name="license_number"
              defaultValue={tp?.license_number ?? ''}
              className={inputClass}
            />
          </Field>

          <Field label="Notes" htmlFor="notes">
            <textarea
              id="notes"
              name="notes"
              defaultValue={tp?.notes ?? ''}
              className={textareaClass}
            />
          </Field>

          <label className="flex items-center gap-3 text-sm font-medium text-navy-800">
            <input
              type="checkbox"
              name="is_active"
              defaultChecked={tp?.is_active ?? true}
              className="h-5 w-5 rounded border-slate-300"
            />
            Currently active
          </label>

          {state.error ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
              {state.error}
            </p>
          ) : null}

          <div className="flex gap-2">
            <SaveButton />
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="h-12 rounded-lg px-4 font-medium text-slate-600 ring-1 ring-slate-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setEditing('new')}
        className="h-12 w-full rounded-lg bg-brandgreen-600 font-semibold text-white active:scale-[0.99]"
      >
        + Add trade partner
      </button>

      {partners.length === 0 ? (
        <EmptyState title="No trade partners yet" hint="Add the subs you dispatch work to." />
      ) : (
        <ul className="space-y-2">
          {partners.map((tp) => (
            <li key={tp.id}>
              <Card className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-navy-800">
                    {tp.company_name}
                    {!tp.is_active ? (
                      <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-slate-500">
                        Inactive
                      </span>
                    ) : null}
                  </p>
                  <p className="text-sm text-slate-600">{tp.trade}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {[tp.contact_name, tp.phone].filter(Boolean).join(' • ')}
                  </p>
                  {tp.license_number ? (
                    <p className="text-xs text-slate-400">Lic. {tp.license_number}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(tp)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-navy-700 ring-1 ring-slate-300"
                >
                  Edit
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
