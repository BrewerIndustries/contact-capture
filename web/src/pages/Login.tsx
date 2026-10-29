import { useState, type FormEvent } from 'react';
import { useAuth } from '../lib/auth';
import { api } from '../lib/api';
import { Backdrop, Logo } from '../components/Brand';
import { Button, ErrorNote, Input, Note, PasswordInput } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (mode === 'login') await login(email, password);
      else { await api.forgot(email); setSent(true); }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  const swap = (m: 'login' | 'forgot') => { setMode(m); setError(''); setSent(false); };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <Backdrop />
      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <Logo size="lg" />
          <p className="text-sm text-ink/50">{mode === 'login' ? 'Sign in to continue' : 'Reset your password'}</p>
        </div>
        <form onSubmit={submit} className="space-y-3 rounded-2xl bg-panel p-6 shadow-lg ring-1 ring-ink/10">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink/60">Email</span>
            <Input type="email" autoComplete="username" autoCapitalize="none" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          {mode === 'login' && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-ink/60">Password</span>
              <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
          )}
          <ErrorNote>{error}</ErrorNote>
          {sent && <Note>If that email has an account, a reset link is on its way. It expires in an hour.</Note>}
          <Button type="submit" disabled={busy} className="w-full py-2.5">
            {mode === 'login' ? (busy ? 'Signing in…' : 'Sign in') : (busy ? 'Sending…' : 'Email me a reset link')}
          </Button>
          <button type="button" onClick={() => swap(mode === 'login' ? 'forgot' : 'login')}
            className="block w-full text-center text-xs text-ink/50 hover:text-ink">
            {mode === 'login' ? 'Forgot password?' : 'Back to sign in'}
          </button>
        </form>
        <p className="mt-4 text-center text-xs text-ink/40">Accounts are invite-only. Ask an admin for an invite.</p>
      </div>
    </div>
  );
}
