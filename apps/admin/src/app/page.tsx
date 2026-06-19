'use client';

import Link from 'next/link';
import { usePendingKyc, useChamas } from '../data/hooks';

export default function DashboardPage() {
  const pending = usePendingKyc();
  const chamas = useChamas();

  return (
    <>
      <h2>Dashboard</h2>
      <div className="card">
        <div className="row">
          <strong>KYC awaiting review</strong>
          <span className={pending.length > 0 ? 'tag warn' : 'tag ok'}>{pending.length}</span>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          <Link href="/kyc">Open queue →</Link>
        </p>
      </div>
      <div className="card">
        <div className="row">
          <strong>Active chamas</strong>
          <span className="tag">{chamas.length}</span>
        </div>
        <p className="muted" style={{ marginTop: 8 }}>
          <Link href="/chamas">Browse chamas →</Link>
        </p>
      </div>
    </>
  );
}
