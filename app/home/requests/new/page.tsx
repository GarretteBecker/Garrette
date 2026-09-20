import { requireRole } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import PortalShell from '@/components/member/shell';
import RequestForm from '@/components/member/request-form';
import NoHomeLinked from '@/components/member/no-home-linked';
import type { Asset, Property, Room } from '@/lib/types/database';

export default async function NewRequestPage() {
  await requireRole('member');
  const supabase = await createClient();

  // RLS scopes this to the member's own home.
  const { data: properties } = await supabase.from('properties').select('*').limit(1);
  const property = (properties ?? [])[0] as Property | undefined;
  if (!property) return <NoHomeLinked active="dashboard" />;

  const [{ data: rooms }, { data: assets }] = await Promise.all([
    supabase.from('rooms').select('*').eq('property_id', property.id).order('sort_order'),
    supabase.from('assets').select('*').eq('property_id', property.id).order('name'),
  ]);

  return (
    <PortalShell active="dashboard" title="Request service" subtitle={property.name}>
      <p className="mb-5 text-[14px] leading-relaxed text-slate-600">
        Tell us what is going on and we will take it from there. You will be
        able to follow it here the whole way through.
      </p>
      <RequestForm
        propertyId={property.id}
        rooms={(rooms ?? []) as Room[]}
        assets={(assets ?? []) as Asset[]}
      />
    </PortalShell>
  );
}
