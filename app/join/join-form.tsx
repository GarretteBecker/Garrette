'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { join, type JoinState } from './actions';

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-lg bg-brandgreen-600 text-base font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
    >
      {pending ? 'Setting up…' : 'Create my account'}
    </button>
  );
}

const field =
  'h-12 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/20';

export default function JoinForm() {
  const [state, formAction] = useActionState<JoinState, FormData>(join, {});

  if (state.checkEmail) {
    return (
      <div className="text-center">
        <p className="text-lg font-semibold text-navy-800">Check your email</p>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
          We have sent you a link to confirm the address. Click it and you are
          in. If it does not arrive in a few minutes, look in spam.
        </p>
        <Link href="/login" className="mt-4 inline-block text-[14px] font-semibold text-brandgreen-700">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <p className="text-[13px] leading-relaxed text-slate-600">
        Use <span className="font-semibold text-navy-800">the exact email
        address B&amp;M invited</span>. That is how your account is matched to
        your home — a different address will not work.
      </p>

      <div>
        <label htmlFor="full_name" className="mb-1 block text-sm font-medium text-navy-800">
          Your name
        </label>
        <input id="full_name" name="full_name" autoComplete="name" className={field} />
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-navy-800">
          Email
        </label>
        <input id="email" name="email" type="email" required
               autoComplete="email" autoCapitalize="none" autoCorrect="off" className={field} />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-navy-800">
          Choose a password
        </label>
        <input id="password" name="password" type="password" required
               autoComplete="new-password" minLength={10} className={field} />
        <p className="mt-1 text-[12px] text-slate-500">
          At least 10 characters. A short phrase you will remember beats a
          clever short one.
        </p>
      </div>

      <div>
        <label htmlFor="confirm" className="mb-1 block text-sm font-medium text-navy-800">
          Type it again
        </label>
        <input id="confirm" name="confirm" type="password" required
               autoComplete="new-password" className={field} />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-[13px] leading-relaxed text-red-800 ring-1 ring-red-600/20">
          {state.error}
        </p>
      ) : null}

      <Submit />

      <p className="text-center text-[13px] text-slate-600">
        Already set up?{' '}
        <Link href="/login" className="font-semibold text-brandgreen-700">Sign in</Link>
      </p>
    </form>
  );
}
