import { type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Backdrop, HeaderWave, Logo } from './Brand';

export { Logo };

const TABS = [
  { to: '/', label: 'Contact Capture', short: 'Capture', end: true,
    icon: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="11" r="2.5" /><path d="M5.5 17c.8-1.8 2-2.5 3.5-2.5s2.7.7 3.5 2.5M15 9h3M15 13h3" /></> },
  { to: '/settings', label: 'Settings', short: 'Settings',
    icon: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></> },
  { to: '/report', label: 'Report', short: 'Report',
    icon: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></> },
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const isDev = import.meta.env.BASE_URL !== '/';
  const topLink = ({ isActive }: { isActive: boolean }) =>
    `rounded-full px-4 py-1.5 text-sm font-medium transition ${isActive ? 'bg-primary text-on-primary' : 'text-ink/65 hover:bg-ink/5 hover:text-ink'}`;
  const bottomLink = ({ isActive }: { isActive: boolean }) =>
    `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${isActive ? 'text-accent' : 'text-ink/55'}`;

  return (
    <div className="relative min-h-screen">
      <Backdrop />
      <header className="sticky top-0 z-30 bg-panel">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <Logo />
          {isDev && <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-black">Dev</span>}
          <nav className="ml-6 hidden gap-1 md:flex">
            {TABS.map((t) => <NavLink key={t.to} to={t.to} end={t.end} className={topLink}>{t.label}</NavLink>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden max-w-48 truncate text-xs text-ink/50 lg:inline">{user?.display_name || user?.email}</span>
            <button onClick={logout} className="rounded-full px-3 py-2 text-sm text-ink/60 hover:bg-ink/5 hover:text-ink">Sign out</button>
          </div>
        </div>
        <HeaderWave />
      </header>

      <main className="relative mx-auto max-w-5xl px-4 pb-28 pt-5 md:pb-10 md:pt-6">{children}</main>

      {/* Phone / tablet: thumb-reach tab bar. */}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-ink/10 bg-panel md:hidden">
        <div className="mx-auto flex max-w-md">
          {TABS.map((t) => (
            <NavLink key={t.to} to={t.to} end={t.end} className={bottomLink}>
              <Icon>{t.icon}</Icon>
              {t.short}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
