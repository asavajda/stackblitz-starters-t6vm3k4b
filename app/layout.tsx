import './globals.css';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'contest racconti - toHorror',
  icons: {
    icon: '/favicon.ico',
  },
  description: 'Portale di valutazione racconti del Contest Letterario "I Racconti del Gatto Nero" — 26th TOHorror Fantastic Film Fest',
  openGraph: {
    images: [
      {
        url: 'https://raccontitohorror.vercel.app/logo_tohorror_dark.png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    images: [
      {
        url: 'https://raccontitohorror.vercel.app/logo_tohorror_dark.png',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
