import { redirect } from 'next/navigation';

/**
 * The staff area moved to /team when the office got its own role.
 *
 * Kept as a redirect because people bookmark things, and a 404 on the
 * screen somebody opens every morning is a bad way to learn about a
 * rename.
 */
export default function AdminMoved() {
  redirect('/team');
}
