import { warrantyInfo, type WarrantyInfo } from '@/lib/member/portal';
import type { Asset } from '@/lib/types/database';

/**
 * Warranty watch.
 *
 * The expiry date has been on every Home Record item since day one and was
 * never used for anything. That is money on the floor: a member whose water
 * heater fails ten weeks after the warranty quietly lapsed paid for a tank
 * they did not have to.
 *
 * "Ending soon" is deliberately NOT redefined here — it reuses
 * warrantyInfo() from lib/member/portal.ts, which the Home Record already
 * uses for its warranty chips. One definition, so a card cannot say
 * "ending soon" while the chip beside it says "under warranty".
 */

export type WarrantyResponse = 'PENDING' | 'WANTS' | 'DECLINED';

export interface WarrantyNotice {
  id: string;
  asset_id: string;
  warranty_expires: string;
  notified_at: string | null;
  response: WarrantyResponse;
}

export interface ExpiringWarranty {
  asset: Pick<Asset,
    'id' | 'name' | 'manufacturer' | 'model' | 'serial_number' | 'warranty_expires' | 'category'>;
  info: WarrantyInfo;
  notice: WarrantyNotice | null;
}

/**
 * Which of their items are coming out of warranty, soonest first.
 *
 * Anything the member has already declined is dropped — a reminder they
 * said no to is a nag, and a nag is worse than silence.
 */
export function expiringWarranties(
  assets: Pick<Asset,
    'id' | 'name' | 'manufacturer' | 'model' | 'serial_number' | 'warranty_expires' | 'category'>[],
  notices: WarrantyNotice[] = [],
  now: Date = new Date(),
): ExpiringWarranty[] {
  const noticeFor = new Map(
    notices.map((n) => [`${n.asset_id}|${n.warranty_expires.slice(0, 10)}`, n]),
  );

  const out: ExpiringWarranty[] = [];
  for (const asset of assets) {
    const info = warrantyInfo(asset.warranty_expires, now);
    if (info.state !== 'ENDING_SOON') continue;

    const key = `${asset.id}|${(asset.warranty_expires ?? '').slice(0, 10)}`;
    const notice = noticeFor.get(key) ?? null;
    if (notice?.response === 'DECLINED') continue;

    out.push({ asset, info, notice });
  }

  return out.sort((a, b) => (a.info.daysLeft ?? 0) - (b.info.daysLeft ?? 0));
}

/** "in 58 days", "next week", "this week" — a homeowner's sense of urgency. */
export function warrantyCountdown(daysLeft: number | null): string {
  if (daysLeft == null) return '';
  if (daysLeft <= 0) return 'today';
  if (daysLeft === 1) return 'tomorrow';
  if (daysLeft <= 7) return `in ${daysLeft} days`;
  if (daysLeft <= 14) return 'in about two weeks';
  if (daysLeft <= 45) return `in about ${Math.round(daysLeft / 7)} weeks`;
  return `in about ${Math.round(daysLeft / 30)} months`;
}

/**
 * The sentence the member reads.
 *
 * Says the thing that actually matters — that a repair is free now and paid
 * for later — without promising the manufacturer will honour anything,
 * which is not ours to promise.
 */
export function warrantyPitch(w: ExpiringWarranty): string {
  const what = [w.asset.manufacturer, w.asset.model].filter(Boolean).join(' ') || w.asset.name;
  return `Your ${w.asset.name.toLowerCase()} (${what}) comes out of warranty ${warrantyCountdown(
    w.info.daysLeft,
  )}. If anything is wrong with it, it is far cheaper to find out now than after.`;
}

/** Pre-fills the service request raised from a warranty reminder. */
export function warrantyRequestTitle(w: ExpiringWarranty): string {
  return `Warranty check — ${w.asset.name}`;
}
