/** Makes it unmistakable that /demo is a sample home, not anyone's real data. */
export default function DemoBanner() {
  return (
    <p className="mb-4 flex items-center justify-center gap-2 rounded-full bg-navy-50 px-4 py-2 text-center text-[12px] leading-snug text-navy-800/70 ring-1 ring-navy-200">
      <span className="font-bold uppercase tracking-wider text-navy-700">Sample</span>
      <span>Example home — not real data</span>
    </p>
  );
}
