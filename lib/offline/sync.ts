'use client';

import { createClient } from '@/lib/supabase/client';
import {
  listQueued,
  remove,
  markFailed,
  notify,
  type OutboxOp,
} from './outbox';

/**
 * Drains the outbox in the order things happened.
 *
 * Ordering matters: a finding created offline may reference an asset that
 * was also created offline, so we stop at the first failure rather than
 * skipping ahead and writing rows that point at nothing.
 */

let running = false;

export interface SyncResult {
  sent: number;
  failed: number;
  remaining: number;
}

export async function syncNow(): Promise<SyncResult> {
  if (running) return { sent: 0, failed: 0, remaining: await pending() };
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { sent: 0, failed: 0, remaining: await pending() };
  }

  running = true;
  let sent = 0;
  let failed = 0;

  try {
    const queue = await listQueued();
    const supabase = createClient();

    for (const op of queue) {
      try {
        await applyOp(supabase, op);
        await remove(op.localId);
        sent += 1;
      } catch (e) {
        failed += 1;
        await markFailed(op.localId, e instanceof Error ? e.message : 'Sync failed');
        break; // preserve order
      }
    }
  } finally {
    running = false;
    notify();
  }

  return { sent, failed, remaining: await pending() };
}

async function pending(): Promise<number> {
  const { count } = await import('./outbox');
  return count();
}

type SupabaseClient = ReturnType<typeof createClient>;

async function applyOp(supabase: SupabaseClient, op: OutboxOp): Promise<void> {
  switch (op.kind) {
    case 'checklist.update': {
      const { itemId, ...rest } = op.payload as { itemId: string } & Record<string, unknown>;
      const { error } = await supabase.from('checklist_items').update(rest).eq('id', itemId);
      if (error) throw new Error(error.message);
      return;
    }

    case 'asset.upsert': {
      const { error } = await supabase
        .from('assets')
        .upsert({ id: op.localId, ...op.payload });
      if (error) throw new Error(error.message);
      return;
    }

    case 'finding.create': {
      // Use the client-generated id so a retry after a half-failed sync
      // updates the same row instead of creating a duplicate.
      const { error } = await supabase
        .from('findings')
        .upsert({ id: op.localId, ...op.payload });
      if (error) throw new Error(error.message);

      if (op.photo) {
        const path = `${op.propertyId}/findings/${op.localId}/${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('property-photos')
          .upload(path, op.photo.blob, { contentType: 'image/jpeg', upsert: true });
        if (uploadError) throw new Error(uploadError.message);

        const { error: photoError } = await supabase.from('photos').insert({
          property_id: op.propertyId,
          finding_id: op.localId,
          visit_id: (op.payload.visit_id as string | null) ?? null,
          room_id: (op.payload.room_id as string | null) ?? null,
          asset_id: (op.payload.asset_id as string | null) ?? null,
          storage_path: path,
          width: op.photo.width,
          height: op.photo.height,
          size_bytes: op.photo.blob.size,
        });
        if (photoError) throw new Error(photoError.message);
      }
      return;
    }

    case 'visit.complete': {
      const { visitId, ...rest } = op.payload as { visitId: string } & Record<string, unknown>;
      const { error } = await supabase.from('visits').update(rest).eq('id', visitId);
      if (error) throw new Error(error.message);
      return;
    }

    default: {
      // Unknown op from an older build — drop it rather than blocking forever.
      return;
    }
  }
}

/** Wire up automatic sync: on reconnect, on tab focus, and every 30s. */
export function startAutoSync(): () => void {
  const run = () => {
    void syncNow();
  };

  window.addEventListener('online', run);
  window.addEventListener('focus', run);
  const timer = window.setInterval(run, 30_000);
  run();

  return () => {
    window.removeEventListener('online', run);
    window.removeEventListener('focus', run);
    window.clearInterval(timer);
  };
}
