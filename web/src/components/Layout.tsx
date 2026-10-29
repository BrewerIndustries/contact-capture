import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';

type Theme = 'system' | 'light' | 'dark';

function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try { return (localStorage.getItem('cc_theme') as Theme) || 'system'; } catch { return 'system'; }
  });
  useEffect(() => {
    const cl = document.documentElement.classList;
    cl.toggle('theme-light', theme === 'light');
    cl.toggle('theme-dark', theme === 'dark');
    try { localStorage.setItem('cc_theme', theme); } catch { /* ignore */ }
  }, [theme]);
  const next = () => setTheme((t) => (t === 'system' ? 'light' : t === 'light' ? 'dark' : 'system'));
  return [theme, next];
}

export function Logo() {
  return (
    <span className="flex items-center gap-2 font-semibold tracking-tight">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <circle cx="9" cy="11" r="2.5" />
        <path d="M5.5 17c.8-1.8 2-2.5 3.5-2.5s2.7.7 3.5 2.5M15 9h3M15 13h3" />
      </svg>
      Contact Capture
    </span>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [theme, nextTheme] = useTheme();
  const isDev = import.meta.env.BASE_URL !== '/';
  const link = ({ isActive }: { isActive: boolean }) =>
    `flex-1 sm:flex-none text-center rounded-md px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-accent/15 text-ink' : 'text-ink/60 hover:text-ink'}`;

  return (
    <div className="min-h-screen">
      <header className="border-b border-ink/10 bg-panel">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Logo />
          {isDev && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-black">Dev</span>}
          <div className="ml-auto flex items-center gap-1">
            <span className="hidden max-w-48 truncate text-xs text-ink/50 sm:inline">{user?.display_name || user?.email}</span>
            <button onClick={nextTheme} title="Theme" className="rounded-md px-2 py-1.5 text-xs text-ink/60 hover:text-ink">
              {theme === 'system' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark'}
            </button>
            <button onClick={logout} className="rounded-md px-2 py-1.5 text-sm text-ink/60 hover:text-ink">Sign out</button>
          </div>
          <nav className="flex w-full gap-1 sm:order-none sm:w-auto">
            <NavLink to="/" end className={link}><span className="sm:hidden">Capture</span><span className="hidden sm:inline">Contact Capture</span></NavLink>
            <NavLink to="/settings" className={link}>Settings</NavLink>
            <NavLink to="/report" className={link}>Report</NavLink>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
