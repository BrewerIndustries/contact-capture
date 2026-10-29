import { useEffect, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

export const inputCls =
  'w-full rounded-lg bg-field px-3 py-2.5 text-base sm:text-sm ring-1 ring-ink/15 outline-none focus:ring-2 focus:ring-accent/60';

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className || ''}`} />;
}

// Password field with an eye button that reveals what you're typing.
export function PasswordInput(props: Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input {...props} type={show ? 'text' : 'password'} className={`${inputCls} pr-10 ${props.className || ''}`} />
      <button type="button" onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'} title={show ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-ink/40 hover:text-ink/80">
        {show ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

export function Button({ variant = 'primary', className = '', ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }) {
  const v = {
    primary: 'bg-primary text-on-primary font-semibold shadow-sm hover:brightness-110',
    ghost: 'text-ink/80 ring-1 ring-ink/15 hover:bg-ink/5',
    danger: 'text-red-500 ring-1 ring-red-500/30 hover:bg-red-500/10',
  }[variant];
  return (
    <button {...rest}
      className={`min-h-10 rounded-lg px-4 py-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50 ${v} ${className}`} />
  );
}

export function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="relative rounded-2xl bg-panel p-4 shadow-sm ring-1 ring-ink/10 sm:p-5">
      {(title || right) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          {title && <h2 className="text-sm font-semibold uppercase tracking-wider text-ink/60">{title}</h2>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <div className="rounded-lg bg-red-500/15 px-3 py-2 text-sm text-red-500">{children}</div>;
}

export function Note({ tone = 'ok', children }: { tone?: 'ok' | 'warn'; children: ReactNode }) {
  if (!children) return null;
  const cls = tone === 'ok'
    ? 'bg-accent/15 text-ink'
    : 'bg-amber-500/15 text-amber-600';
  return <div className={`rounded-lg px-3 py-2 text-sm ${cls}`}>{children}</div>;
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-panel p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] ring-1 ring-ink/10 sm:rounded-2xl sm:pb-5"
        onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full text-2xl leading-none text-ink/50 hover:bg-ink/5 hover:text-ink">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const fmtDate = (ms: number) =>
  new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
