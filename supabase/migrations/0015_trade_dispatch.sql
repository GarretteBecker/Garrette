-- =====================================================================
-- B&M HomeKeeper — 0015 real dispatch
--
-- "Dispatch" was picking one partner from a flat list and moving a stage.
-- Whether anyone actually turned up depended on whoever you happened to
-- pick, and nothing recorded whether they answered, how long they took,
-- or whether they were any good.
--
-- What a member experiences is "somebody always comes, fast". That needs
-- four things this migration adds:
--
--   1. RANKING — a primary, a secondary and backups per category, so the
--      office is not choosing from memory at eight on a Friday.
--   2. AN OFFER WITH A CLOCK — a job is offered to one partner with a
--      deadline to answer, not silently assigned to them.
--   3. ROLLOVER — when they decline or the clock runs out, it goes to the
--      next one, and every step is on the record.
--   4. PERFORMANCE — acceptance rate and response time, measured rather
--      than remembered, so ranking can be based on something.
-- =====================================================================

create type public.dispatch_rank as enum ('PRIMARY', 'SECONDARY', 'BACKUP');

create type public.dispatch_response as enum (
  'PENDING',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',    -- the clock ran out
  'WITHDRAWN'   -- the office pulled it back
);

alter table public.trade_partners
  add column service_area        text,
  -- How long they get to answer. Per partner because a roofer and an
  -- emergency plumber do not live at the same speed.
  add column response_sla_hours  integer not null default 4,
  add column emergency_available boolean not null default false;

comment on column public.trade_partners.response_sla_hours is
  'Hours to accept or decline before the job rolls to the next partner.';

-- ---------------------------------------------------------------------
-- Who covers what, and in what order.
-- ---------------------------------------------------------------------
create table public.trade_coverage (
  id               uuid primary key default gen_random_uuid(),
  trade_partner_id uuid not null references public.trade_partners (id) on delete cascade,
  -- Free text, matching service_requests.category, which is also free text.
  category         text not null,
  rank             public.dispatch_rank not null default 'BACKUP',
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (trade_partner_id, category)
);

create index trade_coverage_category_idx on public.trade_coverage (category, rank);

create trigger trade_coverage_set_updated_at
  before update on public.trade_coverage
  for each row execute function public.set_updated_at();

-- Exactly one primary and one secondary per category. Two primaries is not
-- a ranking, it is the flat list this migration exists to replace.
create unique index trade_coverage_one_primary
  on public.trade_coverage (category) where rank = 'PRIMARY';
create unique index trade_coverage_one_secondary
  on public.trade_coverage (category) where rank = 'SECONDARY';

comment on table public.trade_coverage is
  'Primary / secondary / backup per request category. One primary and one '
  'secondary each, enforced — anything else is not a ranking.';

-- ---------------------------------------------------------------------
-- The offer.
--
-- A job is OFFERED, not assigned. The difference is the whole feature:
-- an offer has a deadline, an answer and a next step.
-- ---------------------------------------------------------------------
create table public.dispatch_offers (
  id                 uuid primary key default gen_random_uuid(),
  service_request_id uuid not null references public.service_requests (id) on delete cascade,
  trade_partner_id   uuid not null references public.trade_partners (id) on delete cascade,
  rank               public.dispatch_rank,

  offered_at         timestamptz not null default now(),
  respond_by         timestamptz not null,
  offered_by         uuid references public.profiles (id) on delete set null,

  response           public.dispatch_response not null default 'PENDING',
  responded_at       timestamptz,
  decline_reason     text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index dispatch_offers_request_idx on public.dispatch_offers (service_request_id, offered_at);
create index dispatch_offers_partner_idx on public.dispatch_offers (trade_partner_id);
create index dispatch_offers_pending_idx on public.dispatch_offers (respond_by)
  where response = 'PENDING';

create trigger dispatch_offers_set_updated_at
  before update on public.dispatch_offers
  for each row execute function public.set_updated_at();

comment on table public.dispatch_offers is
  'Every offer of a job to a trade partner, with the deadline to answer and '
  'what they said. The chain of offers on a request is its dispatch history.';

-- ---------------------------------------------------------------------
-- A trade partner acting as themselves.
-- ---------------------------------------------------------------------
create or replace function public.is_trade_partner(target_partner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.trade_partners tp
     where tp.id = target_partner_id
       and tp.profile_id = auth.uid()
       and tp.is_active
  )
$$;

-- A trade must be able to see a job they have been OFFERED, not only one
-- already assigned to them — otherwise they cannot decide whether to take
-- it. Extends the existing helper rather than replacing its meaning.
create or replace function public.is_trade_for_request(target_request_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.service_requests sr
    join public.trade_partners tp on tp.id = sr.trade_partner_id
    where sr.id = target_request_id
      and tp.profile_id = auth.uid()
      and tp.is_active
  )
  or exists (
    select 1
    from public.dispatch_offers o
    join public.trade_partners tp on tp.id = o.trade_partner_id
    where o.service_request_id = target_request_id
      and tp.profile_id = auth.uid()
      and tp.is_active
      and o.response in ('PENDING', 'ACCEPTED')
  )
$$;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
alter table public.trade_coverage enable row level security;
alter table public.trade_coverage force row level security;

-- Staff manage coverage. A partner may see their own, and nobody else's —
-- who else B&M uses is not their business.
create policy trade_coverage_select on public.trade_coverage
  for select to authenticated
  using (public.is_admin() or public.is_trade_partner(trade_partner_id));

create policy trade_coverage_admin_write on public.trade_coverage
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

alter table public.dispatch_offers enable row level security;
alter table public.dispatch_offers force row level security;

create policy dispatch_offers_select on public.dispatch_offers
  for select to authenticated
  using (public.is_admin() or public.is_trade_partner(trade_partner_id));

create policy dispatch_offers_admin_write on public.dispatch_offers
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------
-- Offer the job to the next partner in line.
--
-- Expires whatever is outstanding first, so the chain reads honestly: a
-- primary who never answered shows as EXPIRED, not as though they were
-- skipped. Returns null when the bench is empty, which the app surfaces
-- rather than failing silently.
-- ---------------------------------------------------------------------
create or replace function public.dispatch_next(
  target_request_id uuid,
  p_partner_id uuid default null   -- override the ranking by hand
)
returns public.dispatch_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  req     public.service_requests;
  partner public.trade_partners;
  chosen  uuid;
  chosen_rank public.dispatch_rank;
  result  public.dispatch_offers;
begin
  select * into req from public.service_requests where id = target_request_id;
  if not found then
    raise exception 'service request not found';
  end if;

  if not public.can_write_property(req.property_id) then
    raise exception 'only staff can dispatch';
  end if;

  -- Anything still outstanding has had its chance.
  update public.dispatch_offers
     set response = 'EXPIRED', responded_at = now()
   where service_request_id = target_request_id
     and response = 'PENDING';

  if p_partner_id is not null then
    chosen := p_partner_id;
    select rank into chosen_rank
      from public.trade_coverage
     where trade_partner_id = chosen and category = req.category;
  else
    -- Next by rank, skipping anyone already offered this job.
    select c.trade_partner_id, c.rank into chosen, chosen_rank
      from public.trade_coverage c
      join public.trade_partners tp on tp.id = c.trade_partner_id
     where c.category = req.category
       and tp.is_active
       and not exists (
         select 1 from public.dispatch_offers o
          where o.service_request_id = target_request_id
            and o.trade_partner_id = c.trade_partner_id
       )
     order by case c.rank
                when 'PRIMARY' then 1
                when 'SECONDARY' then 2
                else 3
              end,
              tp.company_name
     limit 1;
  end if;

  if chosen is null then
    return null;   -- nobody left; the app says so rather than pretending
  end if;

  select * into partner from public.trade_partners where id = chosen;

  insert into public.dispatch_offers
    (service_request_id, trade_partner_id, rank, respond_by, offered_by)
  values
    (target_request_id, chosen, chosen_rank,
     now() + make_interval(hours => coalesce(partner.response_sla_hours, 4)),
     auth.uid())
  returning * into result;

  update public.service_requests
     set trade_partner_id = chosen, stage = 'DISPATCHED'
   where id = target_request_id;

  insert into public.service_request_events
    (service_request_id, from_stage, to_stage, note, actor_id)
  values (
    target_request_id, req.stage, 'DISPATCHED',
    'Offered to ' || partner.company_name ||
    coalesce(' (' || lower(chosen_rank::text) || ')', '') ||
    ' — ' || coalesce(partner.response_sla_hours, 4) || 'h to respond.',
    auth.uid()
  );

  return result;
end;
$$;

-- ---------------------------------------------------------------------
-- The trade partner answers.
--
-- Theirs to press, from their own phone. Declining clears the assignment
-- so the job can roll on; it does not sit in limbo pointing at somebody
-- who already said no.
-- ---------------------------------------------------------------------
create or replace function public.trade_respond_to_offer(
  target_offer_id uuid,
  p_accept boolean,
  p_reason text default null
)
returns public.dispatch_offers
language plpgsql
security definer
set search_path = public
as $$
declare
  o       public.dispatch_offers;
  partner public.trade_partners;
  result  public.dispatch_offers;
begin
  select * into o from public.dispatch_offers where id = target_offer_id;
  if not found then
    raise exception 'offer not found';
  end if;

  if not public.is_trade_partner(o.trade_partner_id) then
    raise exception 'not your job to answer';
  end if;

  if o.response <> 'PENDING' then
    raise exception 'this offer is already %', lower(o.response::text);
  end if;

  if now() > o.respond_by then
    update public.dispatch_offers
       set response = 'EXPIRED', responded_at = now()
     where id = target_offer_id;
    raise exception 'the time to answer this ran out at %', o.respond_by;
  end if;

  select * into partner from public.trade_partners where id = o.trade_partner_id;

  update public.dispatch_offers
     set response       = (case when p_accept then 'ACCEPTED' else 'DECLINED' end)
                            ::public.dispatch_response,
         responded_at   = now(),
         decline_reason = case when p_accept then null else p_reason end
   where id = target_offer_id
  returning * into result;

  if p_accept then
    update public.service_requests
       set stage = 'ACCEPTED', trade_partner_id = o.trade_partner_id
     where id = o.service_request_id;

    insert into public.service_request_events
      (service_request_id, from_stage, to_stage, note, actor_id)
    values (o.service_request_id, 'DISPATCHED', 'ACCEPTED',
            partner.company_name || ' accepted the job.', auth.uid());
  else
    -- Back to the office's court, with nobody assigned.
    update public.service_requests
       set trade_partner_id = null, stage = 'TRIAGE'
     where id = o.service_request_id;

    insert into public.service_request_events
      (service_request_id, from_stage, to_stage, note, actor_id)
    values (o.service_request_id, 'DISPATCHED', 'TRIAGE',
            partner.company_name || ' declined' ||
            coalesce(': ' || p_reason, '.'), auth.uid());
  end if;

  return result;
end;
$$;

-- ---------------------------------------------------------------------
-- Are they any good?
--
-- Acceptance rate and response time, measured rather than remembered.
-- EXPIRED counts against a partner on purpose: not answering is a worse
-- failure than declining, because it costs the member the whole clock.
-- ---------------------------------------------------------------------
create or replace view public.trade_performance
with (security_invoker = true) as
  select
    tp.id                as trade_partner_id,
    tp.company_name,
    tp.trade,
    tp.is_active,
    tp.response_sla_hours,
    count(o.id)                                          as offers,
    count(o.id) filter (where o.response = 'ACCEPTED')    as accepted,
    count(o.id) filter (where o.response = 'DECLINED')    as declined,
    count(o.id) filter (where o.response = 'EXPIRED')     as expired,
    count(o.id) filter (where o.response = 'PENDING')     as pending,
    case when count(o.id) filter (where o.response <> 'PENDING') > 0
         then round(
           100.0 * count(o.id) filter (where o.response = 'ACCEPTED')
                 / count(o.id) filter (where o.response <> 'PENDING'))
         else null end                                   as accept_rate,
    round(avg(
      extract(epoch from (o.responded_at - o.offered_at)) / 60
    ) filter (where o.responded_at is not null
                and o.response in ('ACCEPTED', 'DECLINED')))
                                                         as avg_response_minutes,
    (select count(*) from public.service_requests sr
      where sr.trade_partner_id = tp.id
        and sr.stage in ('COMPLETED', 'HOME_RECORD_UPDATED', 'CLOSED'))
                                                         as jobs_completed
  from public.trade_partners tp
  left join public.dispatch_offers o on o.trade_partner_id = tp.id
  group by tp.id, tp.company_name, tp.trade, tp.is_active, tp.response_sla_hours;

comment on view public.trade_performance is
  'Acceptance rate and response time per partner. EXPIRED counts against '
  'them deliberately — silence costs the member the whole clock.';
