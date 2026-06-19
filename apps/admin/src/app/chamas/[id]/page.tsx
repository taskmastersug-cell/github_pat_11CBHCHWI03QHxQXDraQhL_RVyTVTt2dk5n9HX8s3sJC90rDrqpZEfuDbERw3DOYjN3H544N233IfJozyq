'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { formatMoney, money } from '@roundpay/shared';
import {
  useChama, useChamaClaims, useChamaMemberships, useChamaLedger,
} from '../../../data/hooks';
import { summarizeLedger } from '../../../data/ledgerSummary';
import { approveClaim, readEvidence } from '../../../firebase/callables';

export default function ChamaDetailPage() {
  const params = useParams<{ id: string }>();
  const chamaId = params?.id ?? null;
  const chama = useChama(chamaId);
  const claims = useChamaClaims(chamaId);
  const memberships = useChamaMemberships(chamaId);
  const ledger = useChamaLedger(chamaId);
  const summary = summarizeLedger(ledger);
  const [busy, setBusy] = useState<string | null>(null);
  const [evidence, setEvidence] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  if (!chama) return <p className="muted">Loading...</p>;

  const submitted = claims.filter((c) => c.state === 'submitted');

  const openEvidence = async (claimId: string, path: string) => {
    if (!chamaId) return;
    try {
      const { url } = await readEvidence({ chamaId, path });
      setEvidence((e) => ({ ...e, [claimId]: url }));
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const decide = async (claimId: string, approve: boolean) => {
    if (!chamaId) return;
    setBusy(claimId);
    setError(null);
    try {
      await approveClaim({ chamaId, claimId, approve });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <h2>{chama.name}</h2>
      <div className="card">
        <div className="row">
          <div>
            <div><strong>Type:</strong> {chama.type}</div>
            <div><strong>Contribution:</strong> {formatMoney(money(chama.contributionAmount), chama.currency, 'en')}</div>
            <div><strong>Members:</strong> {memberships.filter((m) => m.status === 'active').length} / {chama.memberCount}</div>
          </div>
          <span className={`tag ${chama.status === 'active' ? 'ok' : chama.status === 'paused' ? 'err' : ''}`}>{chama.status}</span>
        </div>
      </div>

      <h3>Ledger health</h3>
      <div className="card">
        <div className="row">
          <strong>Balance invariant</strong>
          <span className={summary.imbalanced ? 'tag err' : 'tag ok'}>
            {summary.imbalanced ? 'IMBALANCED' : 'Balanced'}
          </span>
        </div>
        <table style={{ marginTop: 12 }}>
          <thead><tr><th>Account</th><th>Balance</th></tr></thead>
          <tbody>
            {Object.entries(summary.totalsByAccount).map(([acc, amt]) => (
              <tr key={acc}>
                <td className="muted" style={{ fontFamily: 'monospace', fontSize: 12 }}>{acc}</td>
                <td>{formatMoney(money(amt), chama.currency, 'en')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {chama.type === 'welfare' ? (
        <>
          <h3>Submitted claims</h3>
          {error ? <p className="tag err">{error}</p> : null}
          {submitted.length === 0 ? (
            <div className="card"><p className="muted">No pending claims.</p></div>
          ) : (
            submitted.map((c) => (
              <div className="card" key={c.claimId}>
                <div className="row">
                  <div>
                    <strong>{c.reason}</strong>
                    <div className="muted">Requested: {formatMoney(money(c.amountRequested), chama.currency, 'en')}</div>
                    <div className="muted">By: {c.uid}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {c.evidenceRef ? (
                      evidence[c.claimId] ? (
                        <a className="btn secondary" href={evidence[c.claimId]} target="_blank" rel="noreferrer">View evidence</a>
                      ) : (
                        <button className="btn secondary" onClick={() => openEvidence(c.claimId, c.evidenceRef!)}>Load evidence</button>
                      )
                    ) : null}
                    <button className="btn" disabled={busy === c.claimId} onClick={() => decide(c.claimId, true)}>Approve</button>
                    <button className="btn danger" disabled={busy === c.claimId} onClick={() => decide(c.claimId, false)}>Reject</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </>
      ) : null}
    </>
  );
}
