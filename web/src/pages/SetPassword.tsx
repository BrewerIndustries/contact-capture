import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Logo } from '../components/Layout';
import { Button, ErrorNote, Input, PasswordInput } from '../components/ui';

// Landing page for invite links (/accept) and password-reset links (/reset).
export default function SetPassword({ kind }: { kind: 'invite' | 'reset' }) {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { setUser } = useAuth();
  const navigate = useNavigate();
  const [who, setWho] = useState<{ email: string; display_name: string | null } | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [dead, setDead] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.checkLink(kind, token)
      .then((w) => { setWho(w); setName(w.display_name || ''); })
      .catch((e) => setDead(e.message));
  }, [kind, token]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 10) return setError('Use at least 10 characters.');
    if (password !== confirm) return setError("Passwords don't match.");
    setBusy(true);
    try {
      const user = await api.useLink(kind, { token, password, ...(kind === 'invite' ? { display_name: name } : {}) });
      setUser(user);
      navigate('/', { replace: true });
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-1 text-2xl">
          <Logo />
          <p className="text-sm text-ink/50">{kind === 'invite' ? 'Create your account' : 'Choose a new password'}</p>
        </div>
        <div className="rounded-2xl bg-panel p-6 ring-1 ring-ink/10">
          {dead ? (
            <div className="space-y-4">
              <ErrorNote>{dead}</ErrorNote>
              <Button variant="ghost" className="w-full" onClick={() => navigate('/', { replace: true })}>Go to sign in</Button>
            </div>
          ) : !who ? (
            <p className="text-center text-sm text-ink/50">Checking your link…</p>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div className="rounded-lg bg-ink/5 px-3 py-2 text-sm">
                <span className="text-ink/50">Account: </span>{who.email}
              </div>
              {kind === 'invite' && (
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/60">Your name</span>
                  <Input autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Shown on contacts you capture" />
                </label>
              )}
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink/60">Password (10+ characters)</span>
                <PasswordInput autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-ink/60">Confirm password</span>
                <PasswordInput autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </label>
              <ErrorNote>{error}</ErrorNote>
              <Button type="submit" disabled={busy} className="w-full py-2.5">
                {busy ? 'Saving…' : kind === 'invite' ? 'Create account' : 'Set password'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
