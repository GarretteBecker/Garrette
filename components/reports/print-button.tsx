'use client';

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-navy-700"
    >
      Save as PDF
    </button>
  );
}
