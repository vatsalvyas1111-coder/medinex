import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './lib/api';
import { fetchMe, homeFor, prefetchFor, useLiveEvents, useMe } from './lib/hooks';
import { useClockStore } from './lib/time';
import type { Role } from './lib/types';
import { Background } from './components/Background';
import { Loader } from './components/Loader';
import { Shell } from './components/Shell';
import { Toasts } from './components/Toasts';
import { CommandPalette } from './components/CommandPalette';
import { MediWidget } from './medi/MediWidget';
import { DemoPanel } from './demo/DemoPanel';
import { PageSkeleton } from './components/Skeleton';
import Login from './pages/Login';
import Today from './pages/Today';

const History = lazy(() => import('./pages/History'));
const Medicines = lazy(() => import('./pages/Medicines'));
const Requests = lazy(() => import('./pages/Requests'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Emergency = lazy(() => import('./pages/Emergency'));
const Links = lazy(() => import('./pages/Links'));
const Dashboard = lazy(() => import('./pages/TrackerDashboard'));
const PatientDetail = lazy(() => import('./pages/PatientDetail'));
const Alerts = lazy(() => import('./pages/Alerts'));
const Queue = lazy(() => import('./pages/ReviewerQueue'));
const Audit = lazy(() => import('./pages/AuditTrail'));
const NotFound = lazy(() => import('./pages/NotFound'));

function Guard({ roles, children }: { roles?: Role[]; children: React.ReactNode }) {
  const { data: me } = useMe();
  if (!me) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(me.role)) return <Navigate to={homeFor(me.role)} replace />;
  return <>{children}</>;
}
const Home = () => { const { data: me } = useMe(); return <Navigate to={me ? homeFor(me.role) : '/login'} replace />; };

export default function App() {
  const qc = useQueryClient(); const loc = useLocation();
  const [loaderDone, setLoaderDone] = useState(false);
  // Real loading runs underneath the loader: auth check + first data fetch. The loader never ends before this is ready.
  const boot = useQuery({
    queryKey: ['boot'], staleTime: Infinity, retry: false,
    queryFn: async () => {
      const [user, demo] = await Promise.all([fetchMe(), api.get<{ now: string }>('/demo/state').catch(() => null)]);
      if (demo?.now) useClockStore.getState().sync(demo.now);
      qc.setQueryData(['me'], user);
      if (user) await prefetchFor(qc, user);
      return user;
    },
  });
  const { data: me } = useMe();
  useLiveEvents(me);
  useEffect(() => { document.title = 'Medinex — Never miss a dose'; }, [loc.pathname]);
  const booted = useRef(false); if (!boot.isLoading) booted.current = true;
  const ready = booted.current;

  return (
    <>
      <Background />
      {ready && (
        <Suspense fallback={<div className="relative z-10 mx-auto max-w-4xl p-8"><PageSkeleton /></div>}>
          <Routes>
            <Route path="/login" element={me ? <Navigate to={homeFor(me.role)} replace /> : <Login />} />
            <Route element={<Guard><Shell /></Guard>}>
              <Route path="/" element={<Home />} />
              <Route path="/today" element={<Guard roles={['patient']}><Today /></Guard>} />
              <Route path="/history" element={<Guard roles={['patient']}><History /></Guard>} />
              <Route path="/medicines" element={<Guard roles={['patient']}><Medicines /></Guard>} />
              <Route path="/requests" element={<Guard roles={['patient']}><Requests /></Guard>} />
              <Route path="/analytics" element={<Guard roles={['patient']}><Analytics /></Guard>} />
              <Route path="/emergency" element={<Guard roles={['patient']}><Emergency /></Guard>} />
              <Route path="/links" element={<Guard roles={['patient', 'tracker']}><Links /></Guard>} />
              <Route path="/dashboard" element={<Guard roles={['tracker']}><Dashboard /></Guard>} />
              <Route path="/patients/:id" element={<Guard roles={['tracker']}><PatientDetail /></Guard>} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/queue" element={<Guard roles={['reviewer']}><Queue /></Guard>} />
              <Route path="/queue/:id" element={<Guard roles={['reviewer']}><Queue /></Guard>} />
              <Route path="/audit" element={<Guard roles={['reviewer']}><Audit /></Guard>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </Suspense>
      )}
      {ready && <><MediWidget /><CommandPalette /></>}
      {ready && <DemoPanel />}
      <Toasts />
      {!loaderDone && <Loader ready={ready} onDone={() => setLoaderDone(true)} />}
    </>
  );
}
