/**
 * Reference photographs of shutoffs — what one looks like, not whose it is.
 *
 * ⚠ These are NEVER shown to a member as their own. The rule in
 * docs/emergency-help.md still stands: if we have not photographed a
 * member's shutoff, their emergency screen says so. It does not show one
 * of these and let them assume.
 *
 * They are used in exactly two places, and both are honest about it:
 *
 *  1. The technician's capture card, labelled "Example — not this home",
 *     so whoever is standing in the basement knows what they are looking
 *     for and what a usable photo looks like.
 *  2. The sample home at /demo, which is banner-labelled as sample data on
 *     every screen, so the demo shows what a finished shutoff card looks
 *     like instead of an empty one.
 *
 * `mine` records where each came from, because it decides what we may do
 * with it. Only Garrette's own photographs should ever end up in front of
 * a customer in marketing or a printed leave-behind. The other two are
 * placeholders for internal reference — one is visibly a video thumbnail
 * with somebody else's title burned into it, which is left uncropped on
 * purpose so nobody mistakes it for ours. Replace them by dropping a new
 * file at the same path.
 */

import type { SafetyPointKind } from '@/lib/emergency';

export interface ReferencePhoto {
  src: string;
  /** What to look at in it. */
  caption: string;
  /** True only for B&M's own photographs. */
  mine: boolean;
}

export const REFERENCE_PHOTO: Partial<Record<SafetyPointKind, ReferencePhoto>> = {
  WATER_MAIN: {
    src: '/reference/water-main.jpg',
    caption:
      'Basement water meter with a valve either side of it. The street-side valve is the lower one; the house-side valve above the meter is the one a homeowner should be told to close. Both are gate valves — many turns, not a quarter turn.',
    mine: true,
  },
  GAS_MAIN: {
    src: '/reference/gas-main.jpg',
    caption:
      'Natural gas meter outside, with the main valve on the inlet before the regulator. Recorded for the record only — the app never sends a member here during a leak.',
    mine: false,
  },
  PROPANE_TANK_SHUTOFF: {
    src: '/reference/propane-tank.jpg',
    caption:
      'The service valve on top of a propane tank, under the dome lid. This is the one valve the app asks a member to close, so photograph it with the lid up and get the gauge in frame if you can.',
    mine: false,
  },
};

/** Where the picture came from, said plainly on screen. */
export function referenceCredit(p: ReferencePhoto): string {
  return p.mine
    ? 'B&M’s own photograph.'
    : 'Placeholder — not our photograph. Replace it with one of yours.';
}
