'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { createInvite, revokeInvite } from '@/lib/actions/invites';
import { Field, inputClass } from '@/components/ui';
import { ROLE_LABEL, ROLE_BLURB } from '@/lib/auth-roles';
import type { UserRole } from '@/lib/types/database';
import type { InviteRow } from '@/app/team/people/page';

const ROLES: UserRole[] = ['ops', 'tech', 'admin', 'member', 'trade'];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-lg bg-navy-700 font-semibold text-white disabled:opacity-60"
    >
      {pending ? 'Saving…' : 'Create the invite'}
    </button>
  );
}

function daysLeft(iso: string) {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

/**
 * Inviting somebody.
 *
 * The role picker explains what each role can do rather than assuming
 * anybody remembers, because the difference between Office and Owner is
 * the difference between somebody booking visits and somebody able to
 * change what a membership costs.
 */
export default function InvitePanel({
  properties,
  open,
}: {
  properties: { id: string; name: string }[];
  open: InviteRow[];
}) {
  const [role, setRole] = useState<UserRole>('ops');
  const [adding, setAdding] = useState(false);

  return (
    <div className="space-y-3">
      {open.length > 0 ? (
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <h2 className="mb-2 font-semibold text-navy-800">
            Waiting to be accepted — {open.length}
          </h2>
          <ul className="divide-y divide-slate-100">
            {open.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <div className="min-w-0">
                  <p className="font-medium text-navy-800">{i.email}</p>
                  <p className="text-[13px] text-slate-500">
                    {ROLE_LABEL[i.role]} · expires in {daysLeft(i.expires_at)} days
                  </p>
                </div>
                <form action={revokeInvite} className="shrink-0">
                  <input type="hidden" name="id" value={i.id} />
                  <button type="submit" className="rounded px-2 py-1 text-[13px] font-semibold text-red-600">
                    Withdraw
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {adding ? (
        <div className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
          <h2 className="mb-3 font-semibold text-navy-800">Invite somebody</h2>
          <form action={(fd) => { createInvite(fd); setAdding(false); }} className="space-y-3">
            <Field label="Their email" htmlFor="inv_email"
                   hint="This has to be the address they will sign up with. It is how the invite is matched.">
              <input id="inv_email" name="email" type="email" required
                     autoCapitalize="none" autoCorrect="off"
                     placeholder="name@example.com" className={inputClass} />
            </Field>

            <Field label="Their name" htmlFor="inv_name" hint="Optional — saves them typing it.">
              <input id="inv_name" name="full_name" className={inputClass} />
            </Field>

            <fieldset>
              <legend className="mb-1.5 block text-[13px] font-medium text-navy-800">
                What they can do
              </legend>
              <div className="space-y-1.5">
                {ROLES.map((r) => (
                  <label
                    key={r}
                    className={`flex cursor-pointer gap-2.5 rounded-lg p-3 ring-1 ${
                      role === r ? 'bg-navy-50 ring-navy-600/30' : 'bg-white ring-slate-200'
                    }`}
                  >
                    <input
                      type="radio" name="role" value={r}
                      checked={role === r}
                      onChange={() => setRole(r)}
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    <span>
                      <span className="block text-[14px] font-semibold text-navy-800">
                        {ROLE_LABEL[r]}
                      </span>
                      <span className="block text-[12px] leading-relaxed text-slate-600">
                        {ROLE_BLURB[r]}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {role === 'member' ? (
              <Field label="Which home" htmlFor="inv_property"
                     hint="A homeowner invite needs a home, or they sign in to an empty portal.">
                <select id="inv_property" name="property_id" required className={inputClass}>
                  <option value="">Choose a home…</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </Field>
            ) : null}

            <Field label="Invite is good for" htmlFor="inv_days">
              <select id="inv_days" name="expires_days" defaultValue="14" className={inputClass}>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </Field>

            <p className="rounded-lg bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-600">
              This does not email anybody. It gives that address permission to
              create an account. Send them the sign-in link yourself and tell
              them to use this exact email — anyone else is refused.
            </p>

            <Submit />
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="h-12 w-full rounded-xl bg-white font-semibold text-navy-700 ring-1 ring-slate-300 hover:bg-slate-50"
        >
          Invite somebody
        </button>
      )}
    </div>
  );
}
