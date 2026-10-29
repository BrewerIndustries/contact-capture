import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './lib/auth';
import Layout from './components/Layout';
import Login from './pages/Login';
import SetPassword from './pages/SetPassword';
import Capture from './pages/Capture';
import Report from './pages/Report';
import Settings from './pages/Settings';

export default function App() {
  const { user, loading } = useAuth();
  const { pathname } = useLocation();

  // Invite and reset links work whether or not someone is already signed in here.
  if (pathname === '/accept') return <SetPassword kind="invite" />;
  if (pathname === '/reset') return <SetPassword kind="reset" />;

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-ink/40">Loading…</div>;
  }

  // Everything else is gated: nothing that touches the API mounts until we have a user.
  if (!user) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Capture />} />
        <Route path="/report" element={<Report />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
