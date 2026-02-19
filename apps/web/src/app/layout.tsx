import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ClassFlowAI',
  description: 'AI-powered interactive teaching platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
