'use client';

import { useState } from 'react';
import { useAuth } from '../stores/auth';

export function SignIn() {
  const signIn = useAuth((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await signIn(email, password);
    } catch {
      setError('Sign-in failed. Check your credentials.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signin">
      <form className="card" onSubmit={submit}>
        <h2>Admin sign in</h2>
        <p className="muted">Use a reviewer account. KYC approvals require the kycReviewer custom claim.</p>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error ? <p className="tag err">{error}</p> : null}
        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  );
}
