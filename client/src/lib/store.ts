import { create } from 'zustand';

export interface Toast {
  id: number; kind: 'success' | 'info' | 'warn' | 'error' | 'alert'; title: string; body?: string; duration?: number;
  action?: { label: string; onClick: () => void };
}
interface UI {
  theme: 'light' | 'dark'; toggleTheme: () => void;
  toasts: Toast[]; toast: (t: Omit<Toast, 'id'>) => number; dismiss: (id: number) => void;
  mediOpen: boolean; setMediOpen: (v: boolean) => void; mediUnread: boolean; setMediUnread: (v: boolean) => void;
  mediPrompt: string | null; askMedi: (q: string) => void; clearPrompt: () => void;
  demoOpen: boolean; setDemoOpen: (v: boolean) => void;
  paletteOpen: boolean; setPaletteOpen: (v: boolean) => void;
  celebrate: boolean; setCelebrate: (v: boolean) => void;
  live: boolean; setLive: (v: boolean) => void;
}
let tid = 1;
export const useUI = create<UI>((set, get) => ({
  theme: (document.documentElement.dataset.theme as 'light' | 'dark') || 'light',
  toggleTheme: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    root.classList.add('theme-anim'); root.dataset.theme = next;
    try { localStorage.setItem('medinex_theme', next); } catch { /* */ }
    setTimeout(() => root.classList.remove('theme-anim'), 700);
    set({ theme: next });
  },
  toasts: [],
  toast: (t) => {
    const id = tid++;
    set((s) => ({ toasts: [...s.toasts.slice(-3), { ...t, id }] }));
    const d = t.duration ?? 5000;
    if (d > 0) setTimeout(() => get().dismiss(id), d);
    return id;
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
  mediOpen: false, setMediOpen: (v) => set({ mediOpen: v, mediUnread: v ? false : get().mediUnread }),
  mediUnread: true, setMediUnread: (v) => set({ mediUnread: v }),
  mediPrompt: null, askMedi: (q) => set({ mediPrompt: q, mediOpen: true, mediUnread: false }), clearPrompt: () => set({ mediPrompt: null }),
  demoOpen: false, setDemoOpen: (v) => set({ demoOpen: v }),
  paletteOpen: false, setPaletteOpen: (v) => set({ paletteOpen: v }),
  celebrate: false, setCelebrate: (v) => set({ celebrate: v }),
  live: false, setLive: (v) => set({ live: v }),
}));
