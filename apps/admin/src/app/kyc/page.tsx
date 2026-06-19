'use client';

import { useState } from 'react';
import { usePendingKyc } from '../../data/hooks';
import { useAuth } from '../../stores/auth';
import { approveKyc } from '../../firebase/callables';

export default function KycQueuePage() {
  const queue = usePendingKyc();
  const kycReviewer = useAuth((s) => s.claims.kycReviewer === true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const act = async (uid: string, approve: boolean) => {
    setBusy(uid);
    setError(null);
    try {
      await approveKyc({ uid, approve });
    } catch (e) {
      setError((e as Error).message ?? 'Failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <h2>KYC queue</h2>
      {!kycReviewer ? (
        <div className="card">
          <p>You need the <code>kycReviewer</code> custom claim to approve KYC. Ask an admin to grant it.</p>
        </div>
      ) : null}
      {error ? <p className="tag err">{error}</p> : null}
      {queue.length === 0 ? (
        <div className="card">
          <p className="muted">No pending reviews.</p>
        </div>
      ) : (
        queue.map((u) => (
          <div className="card" key={u.uid}>
            <div className="row">
              <div>
                <strong>{u.displayName ?? u.uid}</strong>
                <div className="muted">{u.msisdn ?? '(no phone)'}</div>
                <div className="muted">Submitted: {u.kyc?.verifiedAt ? new Date(u.kyc.verifiedAt).toLocaleString() : '—'}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  className="btn"
                  disabled={!kycReviewer || busy === u.uid}
                  onClick={() => act(u.uid, true)}
                >
                  Approve
                </button>
                <button
                  className="btn danger"
                  disabled={!kycReviewer || busy === u.uid}
                  onClick={() => act(u.uid, false)}
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </>
  );
}
