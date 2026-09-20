'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatBytes } from '@/lib/media/compress';
import type { PortalDocument } from '@/lib/member/portal';

const TYPE_LABEL: Record<string, string> = {
  MANUAL: 'Manual',
  WARRANTY: 'Warranty',
  RECEIPT: 'Receipt',
  PERMIT: 'Permit',
  INSPECTION: 'Inspection',
  INSURANCE: 'Insurance',
  CONTRACT: 'Contract',
  ESTIMATE: 'Estimate',
  INVOICE: 'Invoice',
  REPORT: 'Report',
  OTHER: 'Document',
};

/**
 * The homeowner's paperwork. Files live in a private bucket, so opening one
 * mints a short-lived signed URL — a member can only ever sign a URL for a
 * file on their own property, because RLS says so.
 */
export default function DocumentsList({
  documents,
  demo = false,
}: {
  documents: PortalDocument[];
  demo?: boolean;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function open(doc: PortalDocument) {
    if (demo) {
      setError('This is a preview — the actual file is not attached to the demo.');
      return;
    }
    setBusy(doc.id);
    setError(null);
    try {
      const supabase = createClient();
      const { data, error: signError } = await supabase.storage
        .from('property-docs')
        .createSignedUrl(doc.storage_path, 300);
      if (signError) throw new Error(signError.message);
      if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open that file.');
    } finally {
      setBusy(null);
    }
  }

  if (documents.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center text-[15px] text-slate-500">
        Manuals, warranties and permits will show up here as we collect them.
      </p>
    );
  }

  const grouped = new Map<string, PortalDocument[]>();
  for (const d of documents) {
    const key = d.doc_type;
    grouped.set(key, [...(grouped.get(key) ?? []), d]);
  }

  return (
    <>
      <p className="mb-4 text-[14px] leading-relaxed text-slate-600">
        Every manual, warranty and permit for your home, in one place — so you
        are not digging through a kitchen drawer when something breaks.
      </p>

      {error ? (
        <p role="alert" className="mb-3 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ring-1 ring-amber-600/20">
          {error}
        </p>
      ) : null}

      <div className="space-y-5">
        {[...grouped.entries()].map(([type, docs]) => (
          <section key={type}>
            <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-slate-500">
              {TYPE_LABEL[type] ?? type}
            </h2>
            <ul className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
              {docs.map((d, i) => (
                <li key={d.id} className={i > 0 ? 'border-t border-slate-100' : ''}>
                  <button
                    type="button"
                    onClick={() => void open(d)}
                    disabled={busy === d.id}
                    className="flex w-full items-center gap-3 p-4 text-left active:bg-slate-50 disabled:opacity-60"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                         className="h-5 w-5 shrink-0 text-slate-400" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 3v5h5" />
                      <path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7z" />
                    </svg>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-medium leading-snug text-navy-800">{d.title}</p>
                      <p className="text-[12px] text-slate-500">
                        {busy === d.id
                          ? 'Opening…'
                          : d.size_bytes
                            ? formatBytes(d.size_bytes)
                            : TYPE_LABEL[d.doc_type] ?? 'Document'}
                      </p>
                    </div>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                         className="h-4 w-4 shrink-0 text-slate-300" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
