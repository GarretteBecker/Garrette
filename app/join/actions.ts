'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export interface JoinState {
  error?: string;
  checkEmail?: boolean;
}

/**
 * Redeeming an invite.
 *
 * This is the other half of migration 0022. The invite row is permission
 * to exist; this is where somebody uses it. There is no service-role
 * client here (CLAUDE.md), so the person creates their own account with
 * their own password and the database decides whether they may.
 *
 * The role is NOT sent from this form. handle_new_user reads it off the
 * invite, which is why the form never asks. Anything a sign-up form can
 * say about itself is attacker-controlled — that was the 0007 lesson.
 */
export async function join(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('confirm') ?? '');
  const fullName = String(formData.get('full_name') ?? '').trim();

  if (!email || !password) return { error: 'Enter your email and a password.' };
  if (password !== confirm) return { error: 'The two passwords do not match.' };
  if (password.length < 10) {
    return { error: 'Use at least 10 characters. A short phrase you will remember beats a clever short one.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });

  if (error) {
    // The trigger raises insufficient_privilege for an email with no
    // unexpired invite. Supabase usually surfaces that as a generic
    // "database error saving new user", so this does not promise to know
    // which it was — it names the likely cause without guessing.
    const msg = error.message.toLowerCase();
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      return { error: 'There is already an account for that email. Use Sign in instead.' };
    }
    return {
      error:
        'We could not set that account up. The usual reason is that this email has not been invited, or the invite has expired — it has to match the address B&M invited, exactly. Check with the office.',
    };
  }

  // Email confirmation on: no session until they click the link.
  if (!data.session) return { checkEmail: true };

  revalidatePath('/', 'layout');
  redirect('/');
}
