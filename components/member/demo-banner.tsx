/** Makes it unmistakable that /demo is a sample home, not anyone's real data. */
export default function DemoBanner() {
  return (
    <div className="mb-5 rounded-xl bg-navy-50 px-4 py-3 text-center ring-1 ring-navy-200">
      <p className="text-[12px] font-semibold uppercase tracking-wider text-navy-700">
        Sample home
      </p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-navy-800/70">
        This is what your HomeKeeper portal looks like. The home and everything
        in it is an example.
      </p>
    </div>
  );
}
