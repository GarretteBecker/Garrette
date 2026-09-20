import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'B&M HomeKeeper',
  description: 'One number for your home. Managed home care by B&M Home Improvement Solutions LLC.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'HomeKeeper',
  },
};

export const viewport: Viewport = {
  themeColor: '#1B2A4A',
  width: 'device-width',
  initialScale: 1,
  // The field app is used one-handed outdoors; let people zoom if they need to.
  maximumScale: 5,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-slate-50 text-navy-900 antialiased">
        {children}
      </body>
    </html>
  );
}
