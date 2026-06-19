'use client';

import Link from 'next/link';
import { useChamas } from '../../data/hooks';

export default function ChamasPage() {
  const chamas = useChamas();
  return (
    <>
      <h2>Chamas</h2>
      {chamas.length === 0 ? (
        <div className="card"><p className="muted">No chamas yet.</p></div>
      ) : (
        <table>
          <thead>
            <tr><th>Name</th><th>Type</th><th>Status</th><th>Members</th><th>Created</th></tr>
          </thead>
          <tbody>
            {chamas.map((c) => (
              <tr key={c.chamaId}>
                <td><Link href={`/chamas/${c.chamaId}`}>{c.name}</Link></td>
                <td>{c.type}</td>
                <td><span className={`tag ${c.status === 'active' ? 'ok' : c.status === 'paused' ? 'err' : ''}`}>{c.status}</span></td>
                <td>{c.memberCount}</td>
                <td className="muted">{new Date(c.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
