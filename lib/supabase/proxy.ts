import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured } from './config';

/** Public routes that never require a session. */
const PUBLIC_PATHS = [
  '/login',
  // Where an invited person creates their account. It HAS to be public:
  // by definition they have no session yet, so gating it behind one means
  // nobody you invite can ever get in. There is nothing to protect here —
  // without a matching invite the database refuses the sign-up anyway.
  '/join',
  '/auth',
  '/manifest.webmanifest',
  '/icon.svg',
  // The no-login sales demo. Renders fixture data only (lib/member/demo-data.ts)
  // and never touches the database, so there is nothing here to leak.
  '/demo',
  // Shown by the service worker when there is no connection.
  '/offline',
];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Refreshes the auth cookie on every request and bounces signed-out users
 * to /login. This is a convenience gate, NOT the security boundary — the
 * real boundary is RLS in Postgres (CLAUDE.md rule 2).
 */
export async function updateSession(request: NextRequest) {
  // Not configured yet: there is no database, so there is nothing to guard
  // and no session to refresh. Let every request through so the demo and the
  // setup notice still render instead of the whole site erroring.
  if (!isSupabaseConfigured()) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (user && (pathname === '/login' || pathname === '/join')) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
