import PortalShell, { type PortalTab } from './shell';

/** Shown when a member account exists but is not linked to a property yet. */
export default function NoHomeLinked({ active }: { active: PortalTab }) {
  return (
    <PortalShell active={active} title="HomeKeeper">
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center">
        <p className="text-[15px] font-medium text-navy-800">
          No home linked to your account yet
        </p>
        <p className="mt-2 text-[14px] leading-relaxed text-slate-500">
          Give B&amp;M a call and we will get you connected.
        </p>
      </div>
    </PortalShell>
  );
}
