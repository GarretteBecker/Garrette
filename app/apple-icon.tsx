import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/**
 * iOS home-screen icon. Safari wants a PNG, so this renders one at build
 * time rather than committing a binary.
 */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1B2A4A',
        }}
      >
        <svg width="120" height="120" viewBox="0 0 24 24" fill="none" stroke="#ffffff"
             strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V21h14V9.5" />
          <path d="M9.5 21v-6h5v6" stroke="#2E5E3A" />
        </svg>
      </div>
    ),
    size,
  );
}
