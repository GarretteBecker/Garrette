'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { logRenewalNotice } from '@/lib/actions/agreements';
import { NOTICE_METHOD_LABEL, type NoticeMethod } from '@/lib/agreements';
import { inputClass } from '@/components/ui';

const METHODS: NoticeMethod[] = ['EMAIL', 'MAIL', 'SMS', 'IN_PERSON'];

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-11 shrink-0 rounded-lg bg-navy-700 px-4 text-[14px] font-semibold text-white active:scale-[0.99] disabled:opacity-60"
    >
      {pending ? 'Sending…' : 'Send it'}
    </button>
  );
}

/**
 * Send the renewal reminder and record it in one press.
 *
 * Two steps that must not come apart: the member gets told, and we can
 * prove it. The method is asked for because a posted letter and an email
 * are not the same evidence.
 */
export default function NoticeButton({ agreementId }: { agreementId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 h-10 rounded-lg bg-navy-50 px-3.5 text-[13px] font-semibold text-navy-700 ring-1 ring-navy-100 active:bg-navy-100"
      >
        Send the reminder
      </button>
    );
  }

  return (
    <form action={logRenewalNotice} className="mt-2 flex items-center gap-2">
      <input type="hidden" name="agreement_id" value={agreementId} />
      <select name="method" defaultValue="EMAIL" aria-label="How it was sent" className={inputClass}>
        {METHODS.map((m) => (
          <option key={m} value={m}>{NOTICE_METHOD_LABEL[m]}</option>
        ))}
      </select>
      <Submit />
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="h-11 shrink-0 rounded-lg px-2 text-[13px] font-medium text-slate-600"
      >
        Cancel
      </button>
    </form>
  );
}
