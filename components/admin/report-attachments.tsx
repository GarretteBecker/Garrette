'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatBytes } from '@/lib/media/compress';
import type { DocumentType } from '@/lib/types/database';

export interface ReportFile {
  id: string;
  title: string;
  doc_type: DocumentType;
  storage_path: string;
  size_bytes: number | null;
  created_at: string;
}

const DOC_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'REPORT', label: 'Report / write-up' },
  { value: 'INSPECTION', label: 'Inspection or certificate' },
  { value: 'INVOICE', label: 'Invoice' },
  { value: 'ESTIMATE', label: 'Estimate' },
  { value: 'WARRANTY', label: 'Warranty' },
  { value: 'MANUAL', label: 'Manual' },
  { value: 'PERMIT', label: 'Permit' },
  { value: 'CONTRACT', label: 'Contract' },
  { value: 'OTHER', label: 'Something else' },
];

/**
 * Files the office attaches to one report — a trade partner's service
 * sheet, an inspection certificate, a write-up done elsewhere.
 *
 * Uploads land in the private documents bucket under
 * <property_id>/reports/<report_id>/, which the existing storage policies
 * already cover. A member cannot see any of this until the report is
 * released (policy in migration 0009).
 */
export default function ReportAttachments({
  propertyId,
  reportId,
  files,
  canEdit,
  released,
}: {
  propertyId: string;
  reportId: string;
  files: (ReportFile & { url: string | null })[];
  canEdit: boolean;
  released: boolean;
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<DocumentType>('REPORT');
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `${propertyId}/reports/${reportId}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('property-docs')
        .upload(path, file, { contentType: file.type || 'application/octet-stream' });
      if (uploadError) throw new Error(uploadError.message);

      const { error: insertError } = await supabase.from('documents').insert({
        property_id: propertyId,
        report_id: reportId,
        title: title.trim() || file.name,
        doc_type: docType,
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
      });
      if (insertError) throw new Error(insertError.message);

      setTitle('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function open(path: string) {
    const { data } = await supabase.storage.from('property-docs').createSignedUrl(path, 300);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
  }

  async function remove(f: ReportFile) {
    setBusy(true);
    await supabase.from('documents').delete().eq('id', f.id);
    await supabase.storage.from('property-docs').remove([f.storage_path]);
    router.refresh();
    setBusy(false);
  }

  const hasFiles = files.length > 0;
  if (!canEdit && !hasFiles) return null;

  return (
    <section className="mb-10 break-inside-avoid">
      <div className="mb-4 flex items-baseline gap-3 border-b border-slate-200 pb-2">
        <span className="text-[11px] font-bold tracking-widest text-brandgreen-600">+</span>
        <h2 className="text-lg font-semibold tracking-tight text-navy-800">
          Attached documents
        </h2>
      </div>

      {hasFiles ? (
        <ul className="space-y-2">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2.5"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"
                   className="h-5 w-5 shrink-0 text-slate-400" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 3v5h5" />
                <path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7z" />
              </svg>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium text-navy-800">{f.title}</p>
                <p className="text-[11px] text-slate-500">
                  {DOC_TYPES.find((d) => d.value === f.doc_type)?.label ?? f.doc_type}
                  {f.size_bytes ? ` · ${formatBytes(f.size_bytes)}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void open(f.storage_path)}
                className="no-print shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-navy-700 ring-1 ring-slate-300"
              >
                Open
              </button>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() => void remove(f)}
                  disabled={busy}
                  className="no-print shrink-0 rounded-lg px-2 py-1.5 text-[13px] font-medium text-red-700"
                >
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-slate-500">
          Nothing attached to this report yet.
        </p>
      )}

      {canEdit ? (
        <div className="no-print mt-4 rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
          <p className="text-[13px] font-semibold text-navy-800">Attach a file</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-slate-500">
            A trade partner&rsquo;s service sheet, an inspection certificate, a
            write-up you did elsewhere — anything that belongs with this
            quarter.
            {released ? null : ' The member will not see it until you release this report.'}
          </p>

          <div className="mt-3 space-y-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title (optional — defaults to the file name)"
              className="h-11 w-full rounded-lg border border-slate-300 px-3 text-[15px] outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/20"
            />
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocumentType)}
              aria-label="What kind of file"
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-[15px] outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/20"
            >
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/*,.doc,.docx"
              disabled={busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
              }}
              className="block w-full text-[13px] file:mr-3 file:rounded-lg file:border-0 file:bg-navy-700 file:px-4 file:py-2.5 file:text-[13px] file:font-semibold file:text-white"
            />
            {busy ? <p className="text-[12px] text-slate-500">Working…</p> : null}
            {error ? (
              <p role="alert" className="rounded bg-red-50 px-2 py-1 text-[12px] text-red-800">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
