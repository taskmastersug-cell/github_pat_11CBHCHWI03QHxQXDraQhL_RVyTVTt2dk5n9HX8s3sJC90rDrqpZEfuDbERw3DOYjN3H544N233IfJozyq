import './globals.css';
import type { ReactNode } from 'react';
import { Shell } from './_shell';

export const metadata = {
  title: 'RoundPay Admin',
  description: 'KYC reviewer + treasurer dashboard',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
