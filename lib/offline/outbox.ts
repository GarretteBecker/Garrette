/**
 * Offline outbox.
 *
 * The Miller basement has no signal. A tech must be able to run the whole
 * visit — tick the checklist, log findings with photos, update assets,
 * complete the visit — with the phone in airplane mode, and have it all
 * land in Postgres when they walk back upstairs.
 *
 * Everything the tech does is written here first (IndexedDB, survives a
 * refresh or a killed tab), then drained in order by lib/offline/sync.ts.
 * Photo blobs live in the same record, so a queued finding carries its
 * picture with it.
 */

export type OutboxKind =
  | 'checklist.update'
  | 'finding.create'
  | 'asset.upsert'
  | 'visit.complete';

export interface OutboxOp {
  /** Client-generated id, also used as the row id so retries are idempotent. */
  localId: string;
  kind: OutboxKind;
  /** JSON-serialisable row payload. */
  payload: Record<string, unknown>;
  /** Optional photo captured with a finding. */
  photo?: { blob: Blob; width: number; height: number };
  propertyId: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

const DB_NAME = 'homekeeper-offline';
const DB_VERSION = 1;
const STORE = 'outbox';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB unavailable'));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'localId' });
        store.createIndex('createdAt', 'createdAt');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Could not open offline storage'));
  });

  return dbPromise;
}

async function tx<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = fn(transaction.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Offline storage error'));
  });
}

export async function enqueue(
  op: Omit<OutboxOp, 'createdAt' | 'attempts'>,
): Promise<void> {
  await tx('readwrite', (store) =>
    store.put({ ...op, createdAt: Date.now(), attempts: 0 } satisfies OutboxOp),
  );
  notify();
}

export async function listQueued(): Promise<OutboxOp[]> {
  const all = await tx<OutboxOp[]>('readonly', (store) => store.getAll() as IDBRequest<OutboxOp[]>);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function remove(localId: string): Promise<void> {
  await tx('readwrite', (store) => store.delete(localId) as unknown as IDBRequest<undefined>);
  notify();
}

export async function markFailed(localId: string, message: string): Promise<void> {
  const existing = await tx<OutboxOp | undefined>(
    'readonly',
    (store) => store.get(localId) as IDBRequest<OutboxOp | undefined>,
  );
  if (!existing) return;
  await tx('readwrite', (store) =>
    store.put({ ...existing, attempts: existing.attempts + 1, lastError: message }),
  );
  notify();
}

export async function count(): Promise<number> {
  try {
    return await tx<number>('readonly', (store) => store.count());
  } catch {
    return 0;
  }
}

// --- change notification, so the sync badge updates everywhere -------------

const listeners = new Set<() => void>();

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function notify(): void {
  listeners.forEach((fn) => fn());
}
