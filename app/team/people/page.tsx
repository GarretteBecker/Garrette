import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { AppHeader, BrandFooter } from '@/components/brand';
import { Card, formatDate } from '@/components/ui';
import InvitePanel from '@/components/team/invite-panel';
import { ROLE_LABEL } from '@/lib/auth-roles';
import type { Profile, UserRole } from '@/lib/types/database';

export const dynamic = 'force-dynamic';

export interface InviteRow {
  id: string;
  email: string;
  role: UserRole;
  full_name: string | null;
  property_id: string | null;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
}

/**
 * Who works here, and who has been asked to.
 *
 * Owner only — the office runs the business, the owner decides who is in
 * it. RLS says the same thing: invites_admin_write and profiles_admin_write
 * are both is_admin(), so this screen could be deleted and an ops user
 * still could not add anybody.
 */
export default async function PeoplePage() {
  const profile = await requireRole('admin');
  const supabase = await createClient();

  const [{ data: profiles }, { data: invites }, { data: properties }] = await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('invites').select('*').order('created_at', { ascending: false }),
    supabase.from('properties').select('id, name').order('name'),
  ]);

  const people = (profiles ?? []) as Profile[];
  const staff = people.filter((p) => ['admin', 'ops', 'tech'].includes(p.role));
  const others = people.filter((p) => !['admin', 'ops', 'tech'].includes(p.role));
  const rows = (invites ?? []) as InviteRow[];
  const open = rows.filter((i) => !i.accepted_at && new Date(i.expires_at) > new Date());

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50">
      <AppHeader profile={profile} title="Team" subtitle="Who works here" backHref="/team" />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-5 px-4 py-5">
        <div className="rounded-xl bg-navy-50 p-4 ring-1 ring-navy-600/15">
          <p className="text-[14px] font-semibold text-navy-800">
            Nobody can create an account without an invite.
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-navy-800/80">
            That is enforced in the database, not by a setting — an email with
            no unexpired invite here is refused at sign-up whatever anyone
            ticks in Supabase. Adding an invite does not create the account:
            it gives that person permission to create their own, with the role
            you chose here rather than one they pick.
          </p>
        </div>

        <InvitePanel
          properties={(properties ?? []) as { id: string; name: string }[]}
          open={open}
        />

        <Card className="p-4">
          <h2 className="mb-1 font-semibold text-navy-800">Staff</h2>
          <p className="mb-3 text-[13px] text-slate-500">
            {staff.length} {staff.length === 1 ? 'person' : 'people'} with access to this console
            or the field app.
          </p>
          <PeopleTable people={staff} />
        </Card>

        {others.length > 0 ? (
          <Card className="p-4">
            <h2 className="mb-1 font-semibold text-navy-800">Homeowners &amp; trade partners</h2>
            <p className="mb-3 text-[13px] text-slate-500">
              {others.length} accounts. They see only their own home, or only the
              jobs sent to them.
            </p>
            <PeopleTable people={others} />
          </Card>
        ) : null}

        {rows.some((i) => i.accepted_at) ? (
          <Card className="p-4">
            <h2 className="mb-3 font-semibold text-navy-800">Invites already used</h2>
            <ul className="divide-y divide-slate-100 text-[13px]">
              {rows.filter((i) => i.accepted_at).slice(0, 10).map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 py-2">
                  <span className="truncate text-slate-700">{i.email}</span>
                  <span className="shrink-0 text-slate-500">
                    {ROLE_LABEL[i.role]} · joined {formatDate(i.accepted_at)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </main>
      <BrandFooter />
    </div>
  );
}

function PeopleTable({ people }: { people: Profile[] }) {
  if (people.length === 0) {
    return <p className="text-[14px] text-slate-500">Nobody yet.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {people.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          <div className="min-w-0">
            <p className="font-medium text-navy-800">
              {p.full_name || p.email || 'Unnamed'}
              {!p.is_active ? (
                <span className="ml-2 rounded bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">
                  No access
                </span>
              ) : null}
            </p>
            <p className="text-[13px] text-slate-500">{p.email}</p>
          </div>
          <span className="shrink-0 rounded-lg bg-slate-100 px-2.5 py-1 text-[13px] font-medium text-slate-700">
            {ROLE_LABEL[p.role]}
          </span>
        </li>
      ))}
    </ul>
  );
}
