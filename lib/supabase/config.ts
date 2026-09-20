/**
 * Is the database wired up yet?
 *
 * A fresh deploy often lands before anyone has pasted the Supabase keys in.
 * Without this check the app crashes on every page — including the sales
 * demo, which needs no database at all. That is a miserable first
 * impression for something that is, in fact, working.
 *
 * So: when the keys are missing, the parts that need a database say so
 * politely, and the parts that don't just work.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
