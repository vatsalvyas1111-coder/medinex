import { useEffect } from 'react';
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './api';
import { useUI } from './store';
import { useClockStore } from './time';
import type { AlertItem, User } from './types';

export const fetchMe = async (): Promise<User | null> => {
  try { return (await api.get<{ user: User }>('/auth/me')).user; }
  catch (e) { if (e instanceof ApiError && e.status === 401) return null; throw e; }
};
export const useMe = () => useQuery({ queryKey: ['me'], queryFn: fetchMe, staleTime: Infinity, retry: false });
export const homeFor = (role: User['role']) => (role === 'patient' ? '/today' : role === 'tracker' ? '/dashboard' : '/queue');

/** Warm the cache for the first screen so the loader can hide behind real data readiness. */
export async function prefetchFor(qc: QueryClient, user: User) {
  const jobs: Promise<unknown>[] = [];
  if (user.role === 'patient') jobs.push(qc.prefetchQuery({ queryKey: ['today'], queryFn: () => api.get('/doses/today') }));
  if (user.role === 'tracker') jobs.push(qc.prefetchQuery({ queryKey: ['tracker-patients'], queryFn: () => api.get('/trackers/patients') }));
  if (user.role === 'reviewer') jobs.push(qc.prefetchQuery({ queryKey: ['requests'], queryFn: () => api.get('/requests') }));
  jobs.push(qc.prefetchQuery({ queryKey: ['alerts'], queryFn: () => api.get('/alerts') }));
  await Promise.allSettled(jobs);
}

export const useAlerts = () => useQuery({ queryKey: ['alerts'], queryFn: () => api.get<{ alerts: AlertItem[]; unread: number }>('/alerts'), refetchInterval: 60000 });

/** Opens the SSE stream and turns server events into cache invalidations + toasts. */
export function useLiveEvents(user: User | null | undefined) {
  const qc = useQueryClient();
  const { toast, setLive } = useUI();
  useEffect(() => {
    if (!user) return;
    const es = new EventSource('/api/events');
    const refresh = (keys: string[]) => keys.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    const DATA = ['today', 'history', 'summary', 'tracker-patients', 'stats', 'compare', 'insight', 'medicines', 'requests', 'request', 'audit'];
    es.addEventListener('hello', (e) => { setLive(true); try { useClockStore.getState().sync(JSON.parse((e as MessageEvent).data).now); } catch { /* */ } });
    es.onerror = () => setLive(false);
    es.addEventListener('dose', (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      refresh(['today', 'summary', 'tracker-patients', 'stats', 'compare', 'history', 'insight']);
      if (user.role === 'tracker' && d.status === 'taken') {
        toast({ kind: 'success', title: `${d.patientName?.split(' ')[0] ?? 'Patient'} took ${d.medicine}`, body: d.allDone ? 'All doses done for today' : d.late ? 'Logged a little late' : 'Logged on time', duration: 4500 });
      }
    });
    es.addEventListener('alert', (e) => {
      const a = JSON.parse((e as MessageEvent).data) as AlertItem;
      refresh(['alerts']);
      toast({ kind: a.type === 'missed_dose' ? 'alert' : a.type === 'low_stock' ? 'warn' : 'info', title: a.message, duration: 7000 });
    });
    es.addEventListener('request', (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      refresh(['requests', 'request', 'summary', 'audit']);
      if (user.role === 'patient' && d.status !== 'pending') toast({ kind: d.status === 'approved' ? 'success' : 'warn', title: d.status === 'approved' ? 'Request approved' : 'Request not approved', body: 'Open Requests to read the reviewer’s note.' });
    });
    es.addEventListener('medicine', (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      refresh(['today', 'medicines', 'summary', 'tracker-patients', 'stats']);
      if (user.role === 'patient' && d.viaRequest) toast({ kind: 'success', title: `${d.name} was added to your day`, body: 'Approved by your reviewer. Check Today.', duration: 6000 });
    });
    es.addEventListener('clock', (e) => { try { useClockStore.getState().sync(JSON.parse((e as MessageEvent).data).now); } catch { /* */ } refresh(DATA.concat('alerts')); });
    es.addEventListener('reset', () => { qc.invalidateQueries(); });
    return () => { es.close(); setLive(false); };
  }, [user?.id]);
}
