'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';
import { sendWarrantyNotice } from '@/lib/actions/warranty';
import { NOTICE_METHOD_LABEL, type NoticeMethod } from '@/lib/agreements';
import { inputClass } from '@/components/ui';

const METHODS: NoticeMethod[] = ['EMAIL', 'SMS', 'MAIL', 'IN_PERSON'];

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
 * Tell a member their warranty is running out, and record that we did.
 *
 * Both halves in one press: the message goes out of GoHighLevel, and the
 * date, method and sender are written down. A notice the member gets that
 * we have no record of is the worst of both worlds.
 */
export default function WarrantyNoticeButton({ assetId }: { assetId: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2.5 h-10 rounded-lg bg-navy-50 px-3.5 text-[13px] font-semibold text-navy-700 ring-1 ring-navy-100 active:bg-navy-100"
      >
        Tell them
      </button>
    );
  }

  return (
    <form action={sendWarrantyNotice} className="mt-2.5 flex items-center gap-2">
      <input type="hidden" name="asset_id" value={assetId} />
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
