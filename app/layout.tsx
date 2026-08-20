import './globals.css';
import type { Metadata } from 'next';
import { Roboto } from 'next/font/google';

const roboto = Roboto({ subsets: ['latin'], weight: ['100', '300', '400', '500', '700', '900'] });

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_ENV === 'staging'
    ? 'staging contest racconti - toHorror'
    : 'contest racconti - toHorror',
  icons: {
  icon: [
    { url: '/favicon.ico', type: 'image/x-icon' },
  ],
  apple: '/favicon_512.png',
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
      <head>
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="shortcut icon" href="/favicon.ico" type="image/x-icon" />
      </head>
      <body className={roboto.className}>{children}</body>
    </html>
  );
}
