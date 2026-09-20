'use client';

import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useFormStatus } from 'react-dom';
import { signIn, type LoginState } from './actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="h-12 w-full rounded-lg bg-brandgreen-600 text-base font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
    >
      {pending ? 'Signing in…' : 'Sign in'}
    </button>
  );
}

export default function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get('next') ?? '';
  const [state, formAction] = useActionState<LoginState, FormData>(signIn, {});

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={next} />

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-navy-800">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          required
          className="h-12 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/20"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1 block text-sm font-medium text-navy-800">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="h-12 w-full rounded-lg border border-slate-300 px-3 outline-none focus:border-navy-600 focus:ring-2 focus:ring-navy-600/20"
        />
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 ring-1 ring-red-700/20">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
