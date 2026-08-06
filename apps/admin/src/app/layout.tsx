import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Karrkarr Fleet Admin',
  description: 'Karrkarr Pte Ltd — Fleet Operations Dashboard',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full">{children}</body>
    </html>
  );
}
