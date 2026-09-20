import type { EmergencyContactKey } from '@/lib/emergency';

/**
 * Emergency phone numbers, set by the office rather than written into code.
 *
 * ⚠ A wrong number on a gas-leak screen is the worst bug this app could
 * have. Utility numbers vary by address and change over time, so nothing
 * here has a default: an unset contact simply does not render, and the step
 * still tells the member where to find it (their bill). Silence is safe;
 * a confidently wrong number is not.
 *
 * Set these in Netlify (or .env.local) once you have checked them against
 * an actual bill for the area you serve:
 *
 *   NEXT_PUBLIC_GAS_UTILITY_NAME / NEXT_PUBLIC_GAS_UTILITY_PHONE
 *   NEXT_PUBLIC_ELECTRIC_UTILITY_NAME / NEXT_PUBLIC_ELECTRIC_UTILITY_PHONE
 *   NEXT_PUBLIC_WATER_UTILITY_NAME / NEXT_PUBLIC_WATER_UTILITY_PHONE
 *   NEXT_PUBLIC_BM_EMERGENCY_PHONE
 *
 * They are NEXT_PUBLIC_ on purpose — a published emergency number is meant
 * to be read by the person holding the phone.
 */

export interface EmergencyContact {
  name: string;
  phone: string;
}

function contact(name?: string, phone?: string): EmergencyContact | null {
  const n = (name ?? '').trim();
  const p = (phone ?? '').trim();
  if (!p) return null;
  return { name: n || 'Utility emergency line', phone: p };
}

export function emergencyContact(key: EmergencyContactKey): EmergencyContact | null {
  switch (key) {
    case 'GAS_UTILITY':
      return contact(
        process.env.NEXT_PUBLIC_GAS_UTILITY_NAME,
        process.env.NEXT_PUBLIC_GAS_UTILITY_PHONE,
      );
    case 'ELECTRIC_UTILITY':
      return contact(
        process.env.NEXT_PUBLIC_ELECTRIC_UTILITY_NAME,
        process.env.NEXT_PUBLIC_ELECTRIC_UTILITY_PHONE,
      );
    case 'WATER_UTILITY':
      return contact(
        process.env.NEXT_PUBLIC_WATER_UTILITY_NAME,
        process.env.NEXT_PUBLIC_WATER_UTILITY_PHONE,
      );
  }
}

/** B&M's own number, when the office has published one. */
export function bmEmergencyPhone(): string | null {
  const p = (process.env.NEXT_PUBLIC_BM_EMERGENCY_PHONE ?? '').trim();
  return p || null;
}

/** tel: href, stripped of everything a dialler cannot use. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}
