'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { formatBytes } from '@/lib/media/compress';
import { Card, EmptyState, inputClass } from '@/components/ui';
import type { DocumentType } from '@/lib/types/database';

const DOC_TYPES: DocumentType[] = [
  'MANUAL', 'WARRANTY', 'RECEIPT', 'PERMIT', 'INSPECTION',
  'INSURANCE', 'CONTRACT', 'ESTIMATE', 'INVOICE', 'REPORT', 'OTHER',
];

export interface DocRow {
  id: string;
  title: string;
  doc_type: DocumentType;
  storage_path: string;
  size_bytes: number | null;
  created_at: string;
}

/** Document list comes from the server; this handles upload, open and delete. */
export default function DocumentManager({
  propertyId,
  documents,
}: {
  propertyId: string;
  documents: DocRow[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [docType, setDocType] = useState<DocumentType>('MANUAL');
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `${propertyId}/${crypto.randomUUID()}-${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from('property-docs')
        .upload(path, file, { contentType: file.type || 'application/octet-stream' });
      if (uploadError) throw new Error(uploadError.message);

      const { error: insertError } = await supabase.from('documents').insert({
        property_id: propertyId,
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

  async function remove(doc: DocRow) {
    setBusy(true);
    await supabase.from('documents').delete().eq('id', doc.id);
    await supabase.storage.from('property-docs').remove([doc.storage_path]);
    router.refresh();
    setBusy(false);
  }

  return (
    <div className="space-y-3">
      <Card className="space-y-3 p-4">
        <h3 className="font-semibold text-navy-800">Upload a document</h3>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (optional — defaults to the file name)"
          className={inputClass}
        />
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value as DocumentType)}
          className={inputClass}
          aria-label="Document type"
        >
          {DOC_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0) + t.slice(1).toLowerCase()}
            </option>
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
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-navy-700 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-white"
        />
        {busy ? <p className="text-xs text-slate-500">Working…</p> : null}
        {error ? (
          <p role="alert" className="rounded bg-red-50 px-2 py-1 text-xs text-red-800">
            {error}
          </p>
        ) : null}
      </Card>

      {documents.length === 0 ? (
        <EmptyState title="No documents yet" hint="Manuals, warranties, permits, invoices." />
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li key={d.id}>
              <Card className="flex items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-navy-800">{d.title}</p>
                  <p className="text-xs text-slate-500">
                    {d.doc_type.charAt(0) + d.doc_type.slice(1).toLowerCase()}
                    {d.size_bytes ? ` • ${formatBytes(d.size_bytes)}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void open(d.storage_path)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-navy-700 ring-1 ring-slate-300"
                >
                  Open
                </button>
                <button
                  type="button"
                  onClick={() => void remove(d)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-red-700 ring-1 ring-red-200"
                >
                  Delete
                </button>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
