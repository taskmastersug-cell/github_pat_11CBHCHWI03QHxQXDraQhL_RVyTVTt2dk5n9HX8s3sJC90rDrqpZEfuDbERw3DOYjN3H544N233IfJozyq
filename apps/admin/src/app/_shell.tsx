'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../stores/auth';
import { SignIn } from './_signIn';

export function Shell({ children }: { children: ReactNode }) {
  const init = useAuth((s) => s.init);
  const user = useAuth((s) => s.user);
  const ready = useAuth((s) => s.ready);
  const claims = useAuth((s) => s.claims);
  const signOut = useAuth((s) => s.signOut);
  const pathname = usePathname();

  useEffect(() => { init(); }, [init]);

  if (!ready) return <div className="signin"><p className="muted">Loading...</p></div>;
  if (!user) return <SignIn />;

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>RoundPay</h1>
        <nav>
          <Link href="/" className={pathname === '/' ? 'active' : ''}>Dashboard</Link>
          <Link href="/kyc" className={pathname?.startsWith('/kyc') ? 'active' : ''}>
            KYC queue{claims.kycReviewer ? '' : ' (need claim)'}
          </Link>
          <Link href="/chamas" className={pathname?.startsWith('/chamas') ? 'active' : ''}>Chamas</Link>
        </nav>
        <div className="spacer" />
        <div className="footer">
          <div>{user.email ?? user.uid}</div>
          <button className="btn secondary" onClick={signOut} style={{ marginTop: 8 }}>Sign out</button>
        </div>
      </aside>
      <main>{children}</main>
    </div>
  );
}
